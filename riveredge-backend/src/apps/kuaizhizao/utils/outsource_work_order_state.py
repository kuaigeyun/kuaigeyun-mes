"""委外工单状态流转辅助（执行中自动进入、收货满量结案）。"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from core.utils.timezone_utils import resolve_business_datetime


def _dec(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def apply_outsource_work_order_execution_start(record: Any, *, now: datetime | None = None) -> bool:
    """
    首次发料/收货时：released → in_progress，写入 actual_start_date。
    返回是否发生状态变更。
    """
    status = str(getattr(record, "status", "") or "").strip()
    if status != "released":
        return False
    record.status = "in_progress"
    if not getattr(record, "actual_start_date", None):
        record.actual_start_date = now or resolve_business_datetime()
    return True


def apply_outsource_work_order_receipt_completion(record: Any, *, now: datetime | None = None) -> bool:
    """
    收货累计达到计划数量时：→ completed，写入 actual_end_date。
    返回是否发生状态变更。
    """
    if str(getattr(record, "status", "") or "").strip() in ("completed", "cancelled"):
        return False
    qty = _dec(getattr(record, "quantity", 0))
    received = _dec(getattr(record, "received_quantity", 0))
    if qty <= 0 or received < qty:
        return False
    record.status = "completed"
    record.actual_end_date = now or resolve_business_datetime()
    return True


def outsource_work_order_has_execution_activity(record: Any) -> bool:
    """是否已有发料或收货活动。"""
    return _dec(getattr(record, "issued_quantity", 0)) > 0 or _dec(getattr(record, "received_quantity", 0)) > 0


def outsource_work_order_is_fully_received(record: Any) -> bool:
    qty = _dec(getattr(record, "quantity", 0))
    received = _dec(getattr(record, "received_quantity", 0))
    return qty > 0 and received >= qty


async def resolve_outsource_work_order_product_unit(
    tenant_id: int,
    outsource_work_order: Any,
) -> str:
    """委外工单产品单位（模型无 unit 字段，从物料 base_unit 解析）。"""
    default = "件"
    product_id = getattr(outsource_work_order, "product_id", None)
    if product_id is None:
        return default
    from apps.master_data.models.material import Material

    material = await Material.get_or_none(
        tenant_id=tenant_id,
        id=int(product_id),
        deleted_at__isnull=True,
    )
    if material and material.base_unit:
        return str(material.base_unit)
    return default
