"""业务适配：销售订单 → 金蝶销售订单（SAL_SaleOrder）。"""

from __future__ import annotations

import copy
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from loguru import logger

from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
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
    SAL_SALE_ORDER_DEFAULT_BILL_TYPE,
    SAL_SALE_ORDER_FORM_ID,
)
from core.utils.timezone_utils import to_api_isoformat
from infra.exceptions.exceptions import BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

DEFAULT_FORM_ID = SAL_SALE_ORDER_FORM_ID
TARGET_TYPE = "kingdee_sales_order"
TARGET_PROFILE = "kingdee_sal_saleorder"
SOURCE_TYPE = "sales_order"
PUSHABLE_STATUSES = frozenset({"AUDITED", "CONFIRMED", "APPROVED", "RELEASED", "IN_PROGRESS", "COMPLETED"})
PUSH_DISABLED_MESSAGE = "金蝶销售订单推送未启用"


def sales_order_push_skip_reason(
    order: SalesOrder,
    *,
    already_pushed: bool = False,
    items: Optional[List[SalesOrderItem]] = None,
) -> Optional[str]:
    if getattr(order, "external_sync_at", None) is not None:
        return "金蝶拉取导入的销售订单不可回推"
    if already_pushed:
        return "已推送过金蝶销售订单"
    review = str(getattr(order, "review_status", None) or "").strip().upper()
    status = str(getattr(order, "status", None) or "").strip().upper()
    if review != "APPROVED" and status not in PUSHABLE_STATUSES:
        return f"销售订单状态 {status or '-'} / 审核 {review or '-'} 不可推送"
    if items is not None and not items:
        return "销售订单无明细行"
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


async def _resolve_customer_number(tenant_id: int, order: SalesOrder, cfg: Dict[str, Any]) -> Optional[str]:
    configured = str(cfg.get("customer_number") or cfg.get("cust_number") or "").strip()
    if configured:
        return configured
    try:
        from apps.master_data.models.customer import Customer

        customer = await Customer.get_or_none(
            tenant_id=tenant_id,
            id=int(order.customer_id or 0),
            deleted_at__isnull=True,
        )
        if customer and str(customer.code or "").strip():
            return str(customer.code).strip()
    except Exception as exc:
        logger.warning("resolve customer number failed order_id={} err={}", order.id, exc)
    return None


def build_kingdee_sales_order_model(
    *,
    order: SalesOrder,
    items: List[SalesOrderItem],
    cfg: Optional[Dict[str, Any]] = None,
    customer_number: Optional[str] = None,
) -> Dict[str, Any]:
    config = cfg or {}
    template = config.get("model_template")
    if isinstance(template, dict) and template:
        model = copy.deepcopy(template)
    else:
        model = {
            "FID": 0,
            "FDate": _date_string(order.order_date or order.created_at),
            "FSaleOrderEntry": [],
        }

    entries: List[Dict[str, Any]] = []
    unit_map = (
        config.get("api_unit_code_map")
        if isinstance(config.get("api_unit_code_map"), dict)
        else None
    )
    for idx, item in enumerate(items):
        unit_raw = str(item.material_unit or "").strip()
        unit_number = (
            apply_unit_code_map(unit_raw, unit_map)
            or str(config.get("unit_number") or DEFAULT_UNIT_NUMBER).strip()
            or DEFAULT_UNIT_NUMBER
        )
        entry = {
            "FEntryID": 0,
            "FMaterialId": {"FNumber": item.material_code},
            "FUnitID": {"FNumber": unit_number},
            "FQty": _to_float(item.order_quantity),
            "FPrice": _to_float(item.unit_price),
            "FTaxPrice": _to_float(item.unit_price),
            "FEntryTaxRate": _to_float(item.tax_rate),
            "FDeliveryDate": _date_string(item.delivery_date or order.delivery_date),
        }
        if item.notes:
            entry["FEntryNote"] = str(item.notes)
        entries.append(entry)
        # 供 field_map 按行覆盖时使用局部键
        _ = idx

    if entries:
        model["FSaleOrderEntry"] = entries

    default_field_map = {
        "bill_no": "FBillNo",
        "bill_date": "FDate",
        "bill_type_number": "FBillTypeID.FNUMBER",
        "sale_org_number": "FSaleOrgId.FNumber",
        "customer_number": "FCustId.FNumber",
        "remarks": "FNote",
    }

    def local_value(key: str) -> Any:
        if key == "bill_date":
            return _date_string(order.order_date or order.created_at)
        if key == "bill_no":
            if config.get("use_local_bill_no", True):
                return order.order_code
            return None
        if key == "bill_type_number":
            return config.get("bill_type_number") or SAL_SALE_ORDER_DEFAULT_BILL_TYPE
        if key == "sale_org_number":
            return config.get("sale_org_number") or config.get("org_number")
        if key == "customer_number":
            return customer_number or config.get("customer_number")
        if key == "remarks":
            return _compact_text("快格云销售订单", order.order_code, order.notes)
        return getattr(order, key, None)
    field_map = dict(default_field_map)

    apply_field_map(model, field_map, local_value)

    fixed_values = config.get("fixed_values")
    if isinstance(fixed_values, dict):
        for target_path, value in fixed_values.items():
            set_path(model, str(target_path), value)

    return model


class KingdeeSalesOrderPushService:
    TARGET_PROFILE = TARGET_PROFILE

    async def push_sales_order(
        self,
        *,
        tenant_id: int,
        sales_order_id: int,
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

        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id,
            id=sales_order_id,
            deleted_at__isnull=True,
        )
        if not order:
            return None

        items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            deleted_at__isnull=True,
        ).order_by("id")

        already_pushed = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=SOURCE_TYPE,
            source_id=sales_order_id,
            target_type=TARGET_TYPE,
        ).exists()
        skip_reason = sales_order_push_skip_reason(
            order,
            already_pushed=already_pushed,
            items=list(items),
        )
        if skip_reason:
            return {"success": True, "skipped": True, "message": skip_reason}

        try:
            return await self._push_now(
                tenant_id=tenant_id,
                order=order,
                items=list(items),
                acting_user_id=acting_user_id,
                config=config,
                dry_run=dry_run,
            )
        except Exception as exc:
            logger.warning(
                "销售订单推送金蝶失败 tenant_id={} sales_order_id={} err={}",
                tenant_id,
                sales_order_id,
                exc,
            )
            if bool(config.get("fail_on_error", False)):
                raise BusinessLogicError(f"推送金蝶销售订单失败：{exc}")
            return {"success": False, "message": str(exc)}

    async def get_push_config(self, tenant_id: int) -> Dict[str, Any]:
        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        sales = (biz_config.get("parameters", {}) or {}).get("sales", {}) or {}
        raw = sales.get("kingdee_sales_order_push") or {}
        return dict(raw) if isinstance(raw, dict) else {}

    async def _push_now(
        self,
        *,
        tenant_id: int,
        order: SalesOrder,
        items: List[SalesOrderItem],
        acting_user_id: int,
        config: Dict[str, Any],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        form_id = str(config.get("form_id") or DEFAULT_FORM_ID).strip() or DEFAULT_FORM_ID
        customer_number = await _resolve_customer_number(tenant_id, order, config)
        if not customer_number and not dry_run:
            raise BusinessLogicError("缺少客户编码（Customer.FNumber），无法推送金蝶销售订单")

        # 首行单位兜底（单据行单位 + 物料主数据 + Save 接口转换表）
        first_code = items[0].material_code if items else None
        first_unit = str(getattr(items[0], "material_unit", None) or "").strip() if items else ""
        unit_code_map = await load_save_api_unit_code_map(
            tenant_id, str(config.get("save_api_uuid") or "").strip() or None
        )
        units = await resolve_unit_for_push(
            tenant_id,
            product_code=first_code,
            unit_hint=first_unit or None,
            unit_code_map=unit_code_map,
        )
        config = {**config, **units, "api_unit_code_map": unit_code_map}

        model = build_kingdee_sales_order_model(
            order=order,
            items=items,
            cfg=config,
            customer_number=customer_number,
        )

        request = DocumentPushRequest(
            source_type=SOURCE_TYPE,
            source_id=int(order.id),
            target_profile=TARGET_PROFILE,
            source_code=order.order_code,
            source_name=order.order_code,
            connection_code=str(config.get("connection_code") or "").strip() or None,
            save_api_uuid=str(config.get("save_api_uuid") or "").strip() or None,
            dry_run=dry_run,
        )
        prepared = DocumentPushPrepared(
            form_id=form_id,
            model=model,
            target_type=TARGET_TYPE,
            target_name="金蝶销售订单",
            relation_desc="销售订单推送金蝶销售订单",
            connector_type="kingdee_galaxy",
            config=config,
        )

        async def _persist(result: Dict[str, Any]) -> None:
            await DocumentRelation.create(
                tenant_id=tenant_id,
                source_type=str(result.get("source_type") or SOURCE_TYPE),
                source_id=int(result.get("source_id") or order.id),
                source_code=result.get("source_code") or order.order_code,
                source_name=result.get("source_name") or order.order_code,
                target_type=str(result.get("target_type") or TARGET_TYPE),
                target_id=int(result.get("bill_id") or 0),
                target_code=(result.get("bill_no") or None),
                target_name=str(result.get("target_name") or "金蝶销售订单"),
                relation_type="source",
                relation_mode="push",
                relation_desc=str(result.get("relation_desc") or "销售订单推送金蝶销售订单"),
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
