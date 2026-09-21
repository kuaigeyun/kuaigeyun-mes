"""业务适配：生产工单 → 金蝶生产订单（PRD_MO）。

通用编排见 core.services.integration.document_push_pipeline。
本模块只负责工单字段映射与门禁；其它页面可按同样方式接入 Pipeline。
"""

from __future__ import annotations

import copy
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from loguru import logger

from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.work_order import WorkOrder
from core.services.integration.document_push_codes import (
    DEFAULT_UNIT_NUMBER,
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
    PRD_MO_DEFAULT_BILL_TYPE,
    PRD_MO_FORM_ID,
)
from core.utils.timezone_utils import to_api_isoformat
from infra.exceptions.exceptions import BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

DEFAULT_FORM_ID = PRD_MO_FORM_ID
TARGET_TYPE = "kingdee_production_order"
TARGET_PROFILE = "kingdee_prd_mo"
SOURCE_TYPE = "work_order"
WORK_ORDER_PUSH_STATUSES = frozenset({"released", "in_progress"})
PUSH_DISABLED_MESSAGE = "金蝶生产订单推送未启用"

def work_order_push_skip_reason(
    work_order: WorkOrder,
    *,
    already_pushed: bool = False,
) -> Optional[str]:
    """工单是否可推：门禁逻辑留在业务适配层。"""
    if getattr(work_order, "external_sync_at", None) is not None:
        return "金蝶拉取导入的工单不可回推"
    if already_pushed:
        return "已推送过金蝶生产订单"
    status = str(getattr(work_order, "status", None) or "").strip()
    if status not in WORK_ORDER_PUSH_STATUSES:
        return f"工单状态 {status or '-'} 不可推送（须已下达或执行中）"
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


def _force_entry_units(model: Dict[str, Any], unit_number: str, base_unit_number: str) -> None:
    """PRD_MO 明细单位必填：覆盖模板空值。"""
    unit = str(unit_number or "").strip()
    if not unit:
        return
    base = str(base_unit_number or unit).strip() or unit
    entities = model.get("FTreeEntity")
    if not isinstance(entities, list) or not entities:
        model["FTreeEntity"] = [{}]
        entities = model["FTreeEntity"]
    entry = entities[0] if isinstance(entities[0], dict) else {}
    entities[0] = entry
    entry["FUnitId"] = {"FNumber": unit}
    entry["FBaseUnitId"] = {"FNumber": base}


def _resolve_local_value(key: str, *, work_order: WorkOrder, cfg: Dict[str, Any]) -> Any:
    if key == "bill_date":
        return _date_string(work_order.planned_start_date or work_order.created_at)
    if key == "bill_no":
        if cfg.get("use_local_bill_no", True):
            return work_order.code
        return None
    if key == "bill_type_number":
        return cfg.get("bill_type_number") or PRD_MO_DEFAULT_BILL_TYPE
    if key == "prd_org_number":
        return cfg.get("prd_org_number") or cfg.get("org_number")
    if key == "stock_org_number":
        return cfg.get("stock_org_number") or cfg.get("prd_org_number") or cfg.get("org_number")
    if key == "workshop_number":
        return cfg.get("workshop_number")
    if key == "unit_number":
        return cfg.get("unit_number") or cfg.get("base_unit_number")
    if key == "base_unit_number":
        return cfg.get("base_unit_number") or cfg.get("unit_number")
    if key == "product_code":
        return work_order.product_code
    if key == "quantity":
        return _to_float(work_order.quantity)
    if key == "planned_start_date":
        return _date_string(work_order.planned_start_date or work_order.created_at)
    if key == "planned_end_date":
        return _date_string(
            work_order.planned_end_date or work_order.planned_start_date or work_order.created_at
        )
    if key == "sales_order_code":
        return work_order.sales_order_code
    if key == "remarks":
        parts = ["快格云工单", work_order.code, work_order.name, work_order.remarks]
        return " ".join(str(p).strip() for p in parts if str(p or "").strip())
    if key == "owner_type_id":
        return cfg.get("owner_type_id") or "BD_OwnerOrg"
    if key == "ppbom_type":
        return cfg.get("ppbom_type") or "1"
    if key == "product_type":
        return cfg.get("product_type") or "1"
    if key == "create_type":
        return cfg.get("create_type") or "1"
    if key == "req_type":
        return cfg.get("req_type") or "1"
    if key == "schedule_status":
        return cfg.get("schedule_status") or "1"
    if key == "first_inspect_status":
        return cfg.get("first_inspect_status") or "0"
    if key == "first_qc_control_type":
        return cfg.get("first_qc_control_type") or "1"
    return getattr(work_order, key, None)


def build_kingdee_production_order_model(
    *,
    work_order: WorkOrder,
    cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """组装金蝶 PRD_MO Save Model（工单适配）。"""
    config = cfg or {}
    template = config.get("model_template")
    if isinstance(template, dict) and template:
        model = copy.deepcopy(template)
    else:
        model = {
            "FID": 0,
            "FDate": _date_string(work_order.planned_start_date or work_order.created_at),
            "FTreeEntity": [{"FEntryID": 0}],
        }

    default_field_map = {
        "bill_no": "FBillNo",
        "bill_date": "FDate",
        "bill_type_number": "FBillType.FNUMBER",
        "prd_org_number": "FPrdOrgId.FNumber",
        "owner_type_id": "FOwnerTypeId",
        "ppbom_type": "FPPBOMType",
        "remarks": "FDescription",
        "product_code": "FTreeEntity.0.FMaterialId.FNumber",
        "product_type": "FTreeEntity.0.FProductType",
        "quantity": "FTreeEntity.0.FQty",
        "unit_number": "FTreeEntity.0.FUnitId.FNumber",
        "base_unit_number": "FTreeEntity.0.FBaseUnitId.FNumber",
        "workshop_number": "FTreeEntity.0.FWorkShopID.FNumber",
        "planned_start_date": "FTreeEntity.0.FPlanStartDate",
        "planned_end_date": "FTreeEntity.0.FPlanFinishDate",
        "stock_org_number": "FTreeEntity.0.FStockInOrgId.FNumber",
        "create_type": "FTreeEntity.0.FCreateType",
        "req_type": "FTreeEntity.0.FReqType",
        "schedule_status": "FTreeEntity.0.FScheduleStatus",
        "first_inspect_status": "FTreeEntity.0.FFirstInspectStatus",
        "first_qc_control_type": "FTreeEntity.0.FFirstQCControlType",
        "sales_order_code": "FTreeEntity.0.FSaleOrderNo",
    }
    field_map = dict(default_field_map)

    apply_field_map(
        model,
        field_map,
        lambda local_key: _resolve_local_value(local_key, work_order=work_order, cfg=config),
    )

    fixed_values = config.get("fixed_values")
    if isinstance(fixed_values, dict):
        for target_path, value in fixed_values.items():
            set_path(model, str(target_path), value)

    return model


class KingdeeProductionOrderPushService:
    """工单 → 金蝶 PRD_MO 业务适配（薄壳，编排走 DocumentPushPipeline）。"""

    TARGET_PROFILE = TARGET_PROFILE

    async def push_work_order(
        self,
        *,
        tenant_id: int,
        work_order_id: int,
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

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            return None

        already_pushed = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=SOURCE_TYPE,
            source_id=work_order_id,
            target_type=TARGET_TYPE,
        ).exists()
        skip_reason = work_order_push_skip_reason(
            work_order,
            already_pushed=already_pushed,
        )
        if skip_reason:
            return {"success": True, "skipped": True, "message": skip_reason}

        try:
            result = await self._push_now(
                tenant_id=tenant_id,
                work_order=work_order,
                acting_user_id=acting_user_id,
                config=config,
                dry_run=dry_run,
            )
            if not result.get("dry_run"):
                logger.info(
                    "工单已推送金蝶生产订单 tenant_id={} work_order_id={} bill_no={}",
                    tenant_id,
                    work_order_id,
                    result.get("bill_no"),
                )
            return result
        except Exception as exc:
            logger.warning(
                "工单推送金蝶生产订单失败 tenant_id={} work_order_id={} err={}",
                tenant_id,
                work_order_id,
                exc,
            )
            if bool(config.get("fail_on_error", False)):
                raise BusinessLogicError(f"推送金蝶生产订单失败：{exc}")
            return {"success": False, "message": str(exc)}

    async def get_push_config(self, tenant_id: int) -> Dict[str, Any]:
        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        work_order = (biz_config.get("parameters", {}) or {}).get("work_order", {}) or {}
        raw = work_order.get("kingdee_production_order_push") or {}
        return dict(raw) if isinstance(raw, dict) else {}

    async def _push_now(
        self,
        *,
        tenant_id: int,
        work_order: WorkOrder,
        acting_user_id: int,
        config: Dict[str, Any],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        form_id = str(config.get("form_id") or DEFAULT_FORM_ID).strip() or DEFAULT_FORM_ID
        unit_code_map = await load_save_api_unit_code_map(
            tenant_id, str(config.get("save_api_uuid") or "").strip() or None
        )
        units = await resolve_unit_for_push(
            tenant_id,
            product_code=work_order.product_code,
            unit_code_map=unit_code_map,
        )
        config = {**config, **units, "api_unit_code_map": unit_code_map}
        logger.info(
            "工单推送金蝶单位映射 work_order_id={} product_code={} FUnitId={}",
            getattr(work_order, "id", None),
            work_order.product_code,
            units.get("unit_number"),
        )

        model = build_kingdee_production_order_model(work_order=work_order, cfg=config)
        _force_entry_units(
            model,
            str(units.get("unit_number") or DEFAULT_UNIT_NUMBER),
            str(units.get("base_unit_number") or units.get("unit_number") or DEFAULT_UNIT_NUMBER),
        )

        request = DocumentPushRequest(
            source_type=SOURCE_TYPE,
            source_id=int(work_order.id),
            target_profile=TARGET_PROFILE,
            source_code=work_order.code,
            source_name=work_order.name or work_order.code,
            connection_code=str(config.get("connection_code") or "").strip() or None,
            save_api_uuid=str(config.get("save_api_uuid") or "").strip() or None,
            dry_run=dry_run,
        )
        prepared = DocumentPushPrepared(
            form_id=form_id,
            model=model,
            target_type=TARGET_TYPE,
            target_name="金蝶生产订单",
            relation_desc="生产工单推送金蝶生产订单",
            connector_type="kingdee_galaxy",
            config=config,
        )

        async def _persist(result: Dict[str, Any]) -> None:
            await DocumentRelation.create(
                tenant_id=tenant_id,
                source_type=str(result.get("source_type") or SOURCE_TYPE),
                source_id=int(result.get("source_id") or work_order.id),
                source_code=result.get("source_code") or work_order.code,
                source_name=result.get("source_name") or work_order.name or work_order.code,
                target_type=str(result.get("target_type") or TARGET_TYPE),
                target_id=int(result.get("bill_id") or 0),
                target_code=(result.get("bill_no") or None),
                target_name=str(result.get("target_name") or "金蝶生产订单"),
                relation_type="source",
                relation_mode="push",
                relation_desc=str(result.get("relation_desc") or "生产工单推送金蝶生产订单"),
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
