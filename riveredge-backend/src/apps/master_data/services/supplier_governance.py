"""
供应商准入与评级：门禁校验 + 周期评分回写。
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any, Dict, Optional

from apps.master_data.models.supplier import Supplier
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import ValidationError

QUALIFICATION_POTENTIAL = "potential"
QUALIFICATION_QUALIFYING = "qualifying"
QUALIFICATION_APPROVED = "approved"
QUALIFICATION_SUSPENDED = "suspended"
QUALIFICATION_ELIMINATED = "eliminated"

QUALIFICATION_LABELS = {
    QUALIFICATION_POTENTIAL: "潜在",
    QUALIFICATION_QUALIFYING: "资质审核中",
    QUALIFICATION_APPROVED: "已准入",
    QUALIFICATION_SUSPENDED: "已暂停",
    QUALIFICATION_ELIMINATED: "已淘汰",
}

ALLOWED_QUALIFICATION_STATUSES = set(QUALIFICATION_LABELS.keys())


async def is_supplier_qualification_required(tenant_id: int) -> bool:
    """业务配置：启用供应商准入。默认 False（创建即准入、采购不校验准入状态）。"""
    from infra.services.business_config_service import BusinessConfigService

    config = await BusinessConfigService().get_business_config(tenant_id)
    return bool(
        (config.get("parameters") or {})
        .get("procurement", {})
        .get("require_supplier_qualification", False)
    )


def normalize_qualification_status(value: Optional[str]) -> str:
    if not value:
        return QUALIFICATION_APPROVED
    s = str(value).strip().lower()
    if s not in ALLOWED_QUALIFICATION_STATUSES:
        raise ValidationError(
            f"准入状态无效，允许：{', '.join(sorted(ALLOWED_QUALIFICATION_STATUSES))}"
        )
    return s


def assert_supplier_purchasable(supplier: Supplier, *, qualification_required: bool = False) -> None:
    """采购选用供应商时的门禁：须启用；开启准入开关时还须已准入。"""
    if getattr(supplier, "deleted_at", None):
        raise ValidationError(f"供应商「{supplier.name}」已删除，不可用于采购")
    if not bool(getattr(supplier, "is_active", True)):
        raise ValidationError(f"供应商「{supplier.name}」已停用，不可用于采购")
    if not qualification_required:
        return
    status = normalize_qualification_status(
        getattr(supplier, "qualification_status", None) or QUALIFICATION_APPROVED
    )
    if status != QUALIFICATION_APPROVED:
        label = QUALIFICATION_LABELS.get(status, status)
        raise ValidationError(
            f"供应商「{supplier.name}」未准入（当前：{label}），不可用于采购下单"
        )


async def assert_supplier_purchasable_for_tenant(tenant_id: int, supplier: Supplier) -> None:
    required = await is_supplier_qualification_required(tenant_id)
    assert_supplier_purchasable(supplier, qualification_required=required)


def _score_to_grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    return "D"


async def recalculate_supplier_rating(
    tenant_id: int,
    supplier: Supplier,
    *,
    lookback_days: int = 90,
) -> Dict[str, Any]:
    """
    按近 lookback_days 天交期达成率 + 来料合格率计算综合分并回写主数据。
    价格维度本期不纳入（避免过度设计），权重：交期 50% + 质量 50%。
    """
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

    days = max(30, min(int(lookback_days or 90), 365))
    today = to_site_date(resolve_business_datetime())
    since = today - timedelta(days=days)

    items = await PurchaseOrderItem.filter(
        tenant_id=tenant_id,
        order__supplier_id=supplier.id,
        order__deleted_at__isnull=True,
        actual_delivery_date__isnull=False,
        actual_delivery_date__gte=since,
    ).all()

    on_time = 0
    for it in items:
        req = it.required_date
        act = it.actual_delivery_date
        if req is None or act is None:
            continue
        if act <= req:
            on_time += 1
    otd_total = len(items)
    otd_rate = (on_time / otd_total * 100.0) if otd_total else None

    inspections = await IncomingInspection.filter(
        tenant_id=tenant_id,
        supplier_id=supplier.id,
        deleted_at__isnull=True,
        created_at__gte=resolve_business_datetime() - timedelta(days=days),
    ).all()
    qty_ok = Decimal("0")
    qty_bad = Decimal("0")
    for insp in inspections:
        qty_ok += Decimal(str(insp.qualified_quantity or 0))
        qty_bad += Decimal(str(insp.unqualified_quantity or 0))
    qty_all = qty_ok + qty_bad
    quality_rate = (float(qty_ok / qty_all) * 100.0) if qty_all > 0 else None

    parts = []
    if otd_rate is not None:
        parts.append(otd_rate)
    if quality_rate is not None:
        parts.append(quality_rate)
    if not parts:
        raise ValidationError("近期内无交期或检验数据，无法评级")

    score = sum(parts) / len(parts)
    grade = _score_to_grade(score)
    now = resolve_business_datetime()
    supplier.rating_score = Decimal(str(round(score, 2)))
    supplier.rating_grade = grade
    supplier.rated_at = now
    await supplier.save()

    return {
        "supplier_id": supplier.id,
        "lookback_days": days,
        "otd_rate": None if otd_rate is None else round(otd_rate, 2),
        "otd_sample_count": otd_total,
        "quality_rate": None if quality_rate is None else round(quality_rate, 2),
        "quality_sample_qty": float(qty_all),
        "rating_score": float(supplier.rating_score),
        "rating_grade": grade,
        "rated_at": now.isoformat() if now else None,
    }
