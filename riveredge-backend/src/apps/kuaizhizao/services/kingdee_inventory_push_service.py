"""业务适配：物料批次库存 → 金蝶其他入库单（STK_MISCELLANEOUS）。

说明：STK_Inventory 多为查询态，不可 Save；回写库存需走单据（默认其他入库）。
即时库存列表的 balance id 为聚合伪 id，本适配以 MaterialBatch.id 为 source_id。
"""

from __future__ import annotations

import copy
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from loguru import logger

from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.master_data.models.material_batch import MaterialBatch
from core.services.integration.document_push_codes import (
    DEFAULT_UNIT_NUMBER,
    apply_unit_code_map,
    load_save_api_unit_code_map,
    resolve_unit_for_push,
)
from core.services.integration.document_push_mapping import apply_field_map, set_path
from core.services.integration.document_push_pipeline import (
    DocumentPushPipeline,
    DocumentPushPrepared,
    DocumentPushRequest,
)
from core.services.integration.kingdee_galaxy_api_presets import (
    STK_MISCELLANEOUS_DEFAULT_BILL_TYPE,
    STK_MISCELLANEOUS_FORM_ID,
)
from core.utils.timezone_utils import to_api_isoformat
from infra.exceptions.exceptions import BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

DEFAULT_FORM_ID = STK_MISCELLANEOUS_FORM_ID
TARGET_TYPE = "kingdee_stk_miscellaneous"
TARGET_PROFILE = "kingdee_stk_miscellaneous"
SOURCE_TYPE = "material_batch"
PUSH_DISABLED_MESSAGE = "金蝶即时库存推送未启用"


def material_batch_push_skip_reason(
    batch: MaterialBatch,
    *,
    already_pushed: bool = False,
    material_code: Optional[str] = None,
) -> Optional[str]:
    if already_pushed:
        return "已推送过金蝶其他入库单"
    qty = float(batch.quantity or 0)
    if qty <= 0:
        return "库存数量为 0，跳过推送"
    status = str(getattr(batch, "status", None) or "").strip()
    if status and status not in {"in_stock", "在库"}:
        return f"批次状态 {status} 不可推送"
    if not str(material_code or "").strip():
        return "缺少物料编码"
    return None


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _date_string(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return date.today().isoformat()


def _compact_text(*parts: Any) -> str:
    return " ".join(str(part).strip() for part in parts if str(part or "").strip())


async def _resolve_warehouse_number(
    tenant_id: int,
    batch: MaterialBatch,
    cfg: Dict[str, Any],
) -> Optional[str]:
    configured = str(cfg.get("stock_number") or cfg.get("warehouse_number") or "").strip()
    if configured:
        return configured
    wh_id = int(getattr(batch, "warehouse_id", None) or 0)
    if wh_id <= 0:
        return None
    try:
        from apps.master_data.models.warehouse import Warehouse

        warehouse = await Warehouse.get_or_none(
            tenant_id=tenant_id,
            id=wh_id,
            deleted_at__isnull=True,
        )
        if warehouse and str(warehouse.code or "").strip():
            return str(warehouse.code).strip()
    except Exception as exc:
        logger.warning("resolve warehouse number failed batch_id={} err={}", batch.id, exc)
    return None


async def _resolve_material_code(tenant_id: int, batch: MaterialBatch) -> Optional[str]:
    try:
        from apps.master_data.models.material import Material

        material = await Material.get_or_none(
            tenant_id=tenant_id,
            id=int(batch.material_id),
            deleted_at__isnull=True,
        )
        if not material:
            return None
        return str(getattr(material, "main_code", None) or material.code or "").strip() or None
    except Exception as exc:
        logger.warning("resolve material code failed batch_id={} err={}", batch.id, exc)
        return None


def build_kingdee_inventory_misc_in_model(
    *,
    batch: MaterialBatch,
    material_code: str,
    stock_number: Optional[str],
    cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    config = cfg or {}
    template = config.get("model_template")
    if isinstance(template, dict) and template:
        model = copy.deepcopy(template)
    else:
        model = {
            "FID": 0,
            "FDate": _date_string(getattr(batch, "updated_at", None) or getattr(batch, "created_at", None)),
            "FEntity": [{"FEntryID": 0}],
        }

    unit_map = (
        config.get("api_unit_code_map")
        if isinstance(config.get("api_unit_code_map"), dict)
        else None
    )
    unit_number = (
        str(config.get("unit_number") or DEFAULT_UNIT_NUMBER).strip()
        or DEFAULT_UNIT_NUMBER
    )
    unit_number = apply_unit_code_map(unit_number, unit_map) or unit_number

    entity = model.get("FEntity")
    if not isinstance(entity, list) or not entity:
        model["FEntity"] = [{}]
        entity = model["FEntity"]
    entry = entity[0] if isinstance(entity[0], dict) else {}
    entity[0] = entry
    entry["FMATERIALID"] = {"FNumber": material_code}
    entry["FUnitID"] = {"FNumber": unit_number}
    entry["FQty"] = _to_float(batch.quantity)
    if stock_number:
        entry["FSTOCKID"] = {"FNumber": stock_number}
    batch_no = str(batch.batch_no or "").strip()
    if batch_no:
        entry["FLot"] = {"FNumber": batch_no}

    default_field_map = {
        "bill_date": "FDate",
        "bill_type_number": "FBillTypeID.FNUMBER",
        "stock_org_number": "FStockOrgId.FNumber",
        "owner_type_id": "FOwnerTypeIdHead",
        "owner_number": "FOwnerIdHead.FNumber",
        "remarks": "FNote",
    }

    def local_value(key: str) -> Any:
        if key == "bill_date":
            return _date_string(getattr(batch, "updated_at", None) or getattr(batch, "created_at", None))
        if key == "bill_type_number":
            return config.get("bill_type_number") or STK_MISCELLANEOUS_DEFAULT_BILL_TYPE
        if key == "stock_org_number":
            return config.get("stock_org_number") or config.get("org_number")
        if key == "owner_type_id":
            return config.get("owner_type_id") or "BD_OwnerOrg"
        if key == "owner_number":
            return config.get("owner_number") or config.get("stock_org_number") or config.get("org_number")
        if key == "remarks":
            return _compact_text(
                "快格云即时库存",
                material_code,
                batch.batch_no,
                batch.warehouse_name,
                batch.id,
            )
        return getattr(batch, key, None)
    field_map = dict(default_field_map)

    apply_field_map(model, field_map, local_value)

    fixed_values = config.get("fixed_values")
    if isinstance(fixed_values, dict):
        for target_path, value in fixed_values.items():
            set_path(model, str(target_path), value)

    return model


class KingdeeInventoryPushService:
    TARGET_PROFILE = TARGET_PROFILE

    async def push_material_batch(
        self,
        *,
        tenant_id: int,
        material_batch_id: int,
        acting_user_id: int,
        connection_code: Optional[str] = None,
        save_api_uuid: Optional[str] = None,
        dry_run: bool = False,
    ) -> Optional[Dict[str, Any]]:
        config = await self.get_push_config(tenant_id)
        code = str(connection_code or "").strip()
        api_uuid = str(save_api_uuid or "").strip()
        if code or api_uuid:
            config = {
                **config,
                **({"connection_code": code} if code else {}),
                **({"save_api_uuid": api_uuid} if api_uuid else {}),
                "enabled": True,
            }
        if not bool(config.get("enabled", False)):
            return None

        batch = await MaterialBatch.get_or_none(
            tenant_id=tenant_id,
            id=material_batch_id,
            deleted_at__isnull=True,
        )
        if not batch:
            return None

        material_code = await _resolve_material_code(tenant_id, batch)
        already_pushed = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=SOURCE_TYPE,
            source_id=material_batch_id,
            target_type=TARGET_TYPE,
        ).exists()
        skip_reason = material_batch_push_skip_reason(
            batch,
            already_pushed=already_pushed,
            material_code=material_code,
        )
        if skip_reason:
            return {"success": True, "skipped": True, "message": skip_reason}

        try:
            return await self._push_now(
                tenant_id=tenant_id,
                batch=batch,
                material_code=str(material_code),
                acting_user_id=acting_user_id,
                config=config,
                dry_run=dry_run,
            )
        except Exception as exc:
            logger.warning(
                "即时库存推送金蝶失败 tenant_id={} batch_id={} err={}",
                tenant_id,
                material_batch_id,
                exc,
            )
            if bool(config.get("fail_on_error", False)):
                raise BusinessLogicError(f"推送金蝶其他入库单失败：{exc}")
            return {"success": False, "message": str(exc)}

    async def get_push_config(self, tenant_id: int) -> Dict[str, Any]:
        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        warehouse = (biz_config.get("parameters", {}) or {}).get("warehouse", {}) or {}
        raw = warehouse.get("kingdee_inventory_push") or {}
        return dict(raw) if isinstance(raw, dict) else {}

    async def _push_now(
        self,
        *,
        tenant_id: int,
        batch: MaterialBatch,
        material_code: str,
        acting_user_id: int,
        config: Dict[str, Any],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        form_id = str(config.get("form_id") or DEFAULT_FORM_ID).strip() or DEFAULT_FORM_ID
        stock_number = await _resolve_warehouse_number(tenant_id, batch, config)
        if not stock_number and not dry_run and not config.get("allow_missing_stock", False):
            raise BusinessLogicError("缺少仓库编码（Stock.FNumber），无法推送金蝶其他入库单")

        unit_code_map = await load_save_api_unit_code_map(
            tenant_id, str(config.get("save_api_uuid") or "").strip() or None
        )
        units = await resolve_unit_for_push(
            tenant_id,
            product_code=material_code,
            unit_code_map=unit_code_map,
        )
        config = {**config, **units, "api_unit_code_map": unit_code_map}

        model = build_kingdee_inventory_misc_in_model(
            batch=batch,
            material_code=material_code,
            stock_number=stock_number,
            cfg=config,
        )
        source_code = _compact_text(material_code, batch.batch_no) or str(batch.id)

        request = DocumentPushRequest(
            source_type=SOURCE_TYPE,
            source_id=int(batch.id),
            target_profile=TARGET_PROFILE,
            source_code=source_code,
            source_name=source_code,
            connection_code=str(config.get("connection_code") or "").strip() or None,
            save_api_uuid=str(config.get("save_api_uuid") or "").strip() or None,
            dry_run=dry_run,
        )
        prepared = DocumentPushPrepared(
            form_id=form_id,
            model=model,
            target_type=TARGET_TYPE,
            target_name="金蝶其他入库单",
            relation_desc="即时库存推送金蝶其他入库单",
            connector_type="kingdee_galaxy",
            config=config,
        )

        async def _persist(result: Dict[str, Any]) -> None:
            await DocumentRelation.create(
                tenant_id=tenant_id,
                source_type=str(result.get("source_type") or SOURCE_TYPE),
                source_id=int(result.get("source_id") or batch.id),
                source_code=result.get("source_code") or source_code,
                source_name=result.get("source_name") or source_code,
                target_type=str(result.get("target_type") or TARGET_TYPE),
                target_id=int(result.get("bill_id") or 0),
                target_code=(result.get("bill_no") or None),
                target_name=str(result.get("target_name") or "金蝶其他入库单"),
                relation_type="source",
                relation_mode="push",
                relation_desc=str(result.get("relation_desc") or "即时库存推送金蝶其他入库单"),
                notes=to_api_isoformat(datetime.utcnow()),
                created_by=acting_user_id,
            )

        return await DocumentPushPipeline().push(
            tenant_id=tenant_id,
            acting_user_id=acting_user_id,
            request=request,
            prepared=prepared,
            persist_relation=None if dry_run else _persist,
        )
