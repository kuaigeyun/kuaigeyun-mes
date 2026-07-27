"""工序委外判定（计划委外 / 临时委外）与产能占用。"""

from __future__ import annotations

from typing import Any, Optional

OUTSOURCE_KIND_NONE = "none"
OUTSOURCE_KIND_PLANNED = "planned"
OUTSOURCE_KIND_AD_HOC = "ad_hoc"

VALID_OUTSOURCE_KINDS = frozenset(
    {OUTSOURCE_KIND_NONE, OUTSOURCE_KIND_PLANNED, OUTSOURCE_KIND_AD_HOC}
)


def normalize_outsource_kind(value: Any) -> str:
    kind = str(value or OUTSOURCE_KIND_NONE).strip().lower()
    if kind in VALID_OUTSOURCE_KINDS:
        return kind
    return OUTSOURCE_KIND_NONE


def parse_route_step_outsource(extra: Optional[dict]) -> dict:
    """从工艺路线/产品工艺步骤 JSON 解析计划委外字段。"""
    data = extra or {}
    flagged = bool(data.get("is_outsourced") if data.get("is_outsourced") is not None else data.get("isOutsourced"))
    lead_raw = data.get("outsource_lead_time_days")
    if lead_raw is None:
        lead_raw = data.get("outsourceLeadTimeDays")
    lead_days: Optional[int] = None
    if lead_raw is not None and lead_raw != "":
        try:
            lead_days = max(0, int(lead_raw))
        except (TypeError, ValueError):
            lead_days = None
    supplier_id = data.get("outsource_supplier_id")
    if supplier_id is None:
        supplier_id = data.get("outsourceSupplierId")
    try:
        supplier_id_int = int(supplier_id) if supplier_id is not None and int(supplier_id) > 0 else None
    except (TypeError, ValueError):
        supplier_id_int = None
    supplier_name = data.get("outsource_supplier_name") or data.get("outsourceSupplierName")
    supplier_name_str = str(supplier_name).strip() if supplier_name else None
    if not flagged:
        return {
            "outsource_kind": OUTSOURCE_KIND_NONE,
            "outsource_lead_time_days": None,
            "default_outsource_supplier_id": None,
            "default_outsource_supplier_name": None,
        }
    return {
        "outsource_kind": OUTSOURCE_KIND_PLANNED,
        "outsource_lead_time_days": lead_days if lead_days is not None else 1,
        "default_outsource_supplier_id": supplier_id_int,
        "default_outsource_supplier_name": supplier_name_str,
    }


def occupies_factory_capacity(op: Any, *, has_active_outsource_order: bool = False) -> bool:
    """是否占用本厂工位/设备产能。"""
    kind = normalize_outsource_kind(getattr(op, "outsource_kind", None))
    if kind != OUTSOURCE_KIND_NONE:
        return False
    if has_active_outsource_order:
        return False
    return True


def is_outsourced_flag(op: Any, *, has_active_outsource_order: bool = False) -> bool:
    kind = normalize_outsource_kind(getattr(op, "outsource_kind", None))
    return kind != OUTSOURCE_KIND_NONE or has_active_outsource_order
