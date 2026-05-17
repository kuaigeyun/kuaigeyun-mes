"""好力 GO — 设备统计报表（产能查询：口径为设备产出单）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from tortoise.expressions import Q
from tortoise.functions import Count, Sum

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api.routes_equipment_documents import (
    OutputRecordOut,
    _parse_dt,
    _serialize_output_record,
)
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_operations import HaoligoEquipmentOutputRecord
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/equipment/reports", tags=["App · HaoliGO · 设备报表"])


def _apply_output_record_filters(
    qs,
    *,
    equipment_id: Optional[int],
    sheet_no: Optional[str],
    work_order_no: Optional[str],
    recorded_from: Optional[str],
    recorded_to: Optional[str],
    keyword: Optional[str],
):
    if equipment_id is not None:
        qs = qs.filter(equipment_id=equipment_id)
    if sheet_no and sheet_no.strip():
        qs = qs.filter(sheet_no__icontains=sheet_no.strip())
    if work_order_no and work_order_no.strip():
        qs = qs.filter(work_order_no__icontains=work_order_no.strip())
    rf = _parse_dt(recorded_from)
    rt = _parse_dt(recorded_to)
    if rf:
        qs = qs.filter(recorded_at__gte=rf)
    if rt:
        qs = qs.filter(recorded_at__lte=rt)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(sheet_no__icontains=k)
            | Q(work_order_no__icontains=k)
            | Q(customer_name__icontains=k)
            | Q(product_name__icontains=k)
            | Q(finished_product_code__icontains=k)
            | Q(finished_product_name__icontains=k)
            | Q(equipment__asset_code__icontains=k)
            | Q(equipment__name__icontains=k)
        )
    return qs


def _achievement_rate_pct(planned: Optional[Decimal], completed: Optional[Decimal]) -> Optional[float]:
    if planned is None or completed is None:
        return None
    try:
        p = Decimal(planned)
        c = Decimal(completed)
    except Exception:
        return None
    if p <= 0:
        return None
    return float(round((c / p) * 100, 2))


async def _summary_for_qs(qs) -> "CapacitySummary":
    record_count = await qs.count()
    agg = (
        await qs.annotate(
            planned_total=Sum("planned_qty"),
            completed_total=Sum("completed_qty"),
        )
        .group_by("tenant_id")
        .values("planned_total", "completed_total")
    )
    planned_total = agg[0]["planned_total"] if agg else None
    completed_total = agg[0]["completed_total"] if agg else Decimal("0")
    if completed_total is None:
        completed_total = Decimal("0")
    return CapacitySummary(
        record_count=record_count,
        planned_qty_total=planned_total,
        completed_qty_total=completed_total,
        achievement_rate_pct=_achievement_rate_pct(planned_total, completed_total),
    )


class CapacitySummary(BaseModel):
    record_count: int = Field(description="产出单条数")
    planned_qty_total: Optional[Decimal] = Field(None, description="计划数量合计")
    completed_qty_total: Decimal = Field(description="完成数量合计")
    achievement_rate_pct: Optional[float] = Field(None, description="达成率（完成/计划×100）")


class CapacityByEquipmentRow(BaseModel):
    equipment_id: int
    equipment_asset_code: str = ""
    equipment_name: str = ""
    record_count: int
    planned_qty_total: Optional[Decimal] = None
    completed_qty_total: Decimal
    achievement_rate_pct: Optional[float] = None


class CapacityReportOut(BaseModel):
    summary: CapacitySummary
    group_by: str
    items: List[OutputRecordOut] = Field(default_factory=list)
    equipment_items: List[CapacityByEquipmentRow] = Field(default_factory=list)
    total: int = 0
    skip: int = 0
    limit: int = 20


@router.get("/capacity", response_model=CapacityReportOut, summary="产能查询（设备产出单）")
async def capacity_report(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    equipment_id: Optional[int] = Query(None, ge=1),
    sheet_no: Optional[str] = None,
    work_order_no: Optional[str] = None,
    recorded_from: Optional[str] = None,
    recorded_to: Optional[str] = None,
    keyword: Optional[str] = None,
    group_by: str = Query("detail", description="detail=产出明细；equipment=按设备汇总"),
):
    qs = tenant_alive(HaoligoEquipmentOutputRecord, tenant_id)
    qs = _apply_output_record_filters(
        qs,
        equipment_id=equipment_id,
        sheet_no=sheet_no,
        work_order_no=work_order_no,
        recorded_from=recorded_from,
        recorded_to=recorded_to,
        keyword=keyword,
    )
    summary = await _summary_for_qs(qs)
    mode = (group_by or "detail").strip().lower()
    if mode == "equipment":
        agg_rows = (
            await qs.annotate(
                record_count=Count("id"),
                planned_total=Sum("planned_qty"),
                completed_total=Sum("completed_qty"),
            )
            .group_by("equipment_id")
            .order_by("-completed_total")
            .values("equipment_id", "record_count", "planned_total", "completed_total")
        )
        total = len(agg_rows)
        page = agg_rows[skip : skip + limit]
        eq_ids = [int(r["equipment_id"]) for r in page if r.get("equipment_id") is not None]
        eq_map: dict[int, HaoligoEquipment] = {}
        if eq_ids:
            eqs = await tenant_alive(HaoligoEquipment, tenant_id).filter(id__in=eq_ids)
            eq_map = {e.id: e for e in eqs}
        equipment_items: List[CapacityByEquipmentRow] = []
        for r in page:
            eid = int(r["equipment_id"])
            eq = eq_map.get(eid)
            planned = r.get("planned_total")
            completed = r.get("completed_total") or Decimal("0")
            equipment_items.append(
                CapacityByEquipmentRow(
                    equipment_id=eid,
                    equipment_asset_code=eq.asset_code if eq else "",
                    equipment_name=eq.name if eq else "",
                    record_count=int(r.get("record_count") or 0),
                    planned_qty_total=planned,
                    completed_qty_total=completed,
                    achievement_rate_pct=_achievement_rate_pct(planned, completed),
                )
            )
        return CapacityReportOut(
            summary=summary,
            group_by="equipment",
            equipment_items=equipment_items,
            total=total,
            skip=skip,
            limit=limit,
        )

    total = await qs.count()
    rows = await qs.prefetch_related("equipment").order_by("-recorded_at", "-id").offset(skip).limit(limit)
    items = [await _serialize_output_record(r) for r in rows]
    return CapacityReportOut(
        summary=summary,
        group_by="detail",
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )
