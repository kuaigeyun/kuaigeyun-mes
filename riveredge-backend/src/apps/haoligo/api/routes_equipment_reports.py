"""好力 GO — 设备统计报表（产能查询：口径为设备产出单）。"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from apps.haoligo.services.equipment_operational_status_summary import (
    equipment_operational_status_summary,
)
from apps.haoligo.services.maintenance_reminder import list_equipment_maintenance_reminders
from tortoise.expressions import Q
from tortoise.functions import Count, Sum

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api.routes_equipment_documents import (
    OutputRecordOut,
    _parse_dt,
    _serialize_output_record,
)
from apps.haoligo.utils.equipment_output_qty import normalize_equipment_output_qty
from apps.haoligo.models.equipment import HaoligoEquipment, HaoligoWorkshop
from apps.haoligo.models.equipment_operations import HaoligoEquipmentOutputRecord
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/equipment/reports", tags=["App · HaoliGO · 设备报表"])


class EquipmentOperationalStatusSummaryOut(BaseModel):
    total: int = Field(description="设备台账总数")
    counts: dict[str, int] = Field(
        default_factory=dict,
        description="运行状态 value（小写；空为 _unset）→ 数量",
    )


@router.get(
    "/operational-status-summary",
    response_model=EquipmentOperationalStatusSummaryOut,
    summary="设备运行状态分布（工作台环图）",
    dependencies=[Depends(require_haoligo_module_access( "equipment-dashboard-status"))],
)
async def get_equipment_operational_status_summary(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
) -> EquipmentOperationalStatusSummaryOut:
    raw = await equipment_operational_status_summary(tenant_id)
    return EquipmentOperationalStatusSummaryOut(
        total=int(raw.get("total") or 0),
        counts=dict(raw.get("counts") or {}),
    )


class MaintenanceUpkeepLastByEquipmentOut(BaseModel):
    items: dict[str, datetime] = Field(
        default_factory=dict,
        description="设备代号 → 最近一次保养完修时间（ISO 8601）",
    )


@router.get(
    "/maintenance-upkeep-last-by-equipment",
    response_model=MaintenanceUpkeepLastByEquipmentOut,
    summary="各设备最近保养完修时间（设备保养计划表聚合）",
    dependencies=[Depends(require_haoligo_module_access( "equipment-reports-maintenance-plan"))],
)
async def get_maintenance_upkeep_last_by_equipment(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
) -> MaintenanceUpkeepLastByEquipmentOut:
    from tortoise import connections

    conn = connections.get("default")
    rows = await conn.execute_query_dict(
        """
        SELECT e.asset_code AS asset_code, max(c.created_at) AS last_upkeep_at
        FROM haoligo_equipment_upkeep_complete_sheet c
        INNER JOIN haoligo_equipment_upkeep_sheet s
          ON s.id = c.source_upkeep_sheet_id AND s.tenant_id = c.tenant_id
        INNER JOIN haoligo_equipment e ON e.id = s.equipment_id AND e.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1
          AND c.deleted_at IS NULL
          AND trim(coalesce(c.service_type, '')) = '保养'
        GROUP BY e.asset_code
        """,
        [tenant_id],
    )
    out: dict[str, datetime] = {}
    for r in rows:
        code = str(r.get("asset_code") or "").strip()
        at = r.get("last_upkeep_at")
        if code and at is not None:
            out[code] = at
    return MaintenanceUpkeepLastByEquipmentOut(items=out)


class MaintenanceReminderSummaryOut(BaseModel):
    total_ledger: int = 0
    actionable: int = 0
    filtered_total: int = 0
    by_kind: dict[str, int] = Field(default_factory=dict)
    by_level: dict[str, int] = Field(default_factory=dict)


class EquipmentMaintenanceReminderItemOut(BaseModel):
    id: int
    asset_code: str
    name: str
    operational_status: str | None = None
    maintenance_cycle_by_yield: str | None = None
    maintenance_cycle_by_days: int | None = None
    used_yield: str | None = None
    alert_level: Literal["critical", "warning", "ok"]
    alert_reasons: list[str] = Field(default_factory=list)
    reminder_kind: Literal[
        "manual_maintenance",
        "cycle_plan",
        "setup_no_cycle",
        "setup_no_baseline",
    ]
    dominant_dimension: Literal["yield", "days"] | None = None
    dominant_ratio: float = 0.0
    last_upkeep_at: str | None = None
    days_since_upkeep: int | None = None
    yield_usage_pct: float | None = None
    days_usage_pct: float | None = None
    remaining_days: int | None = None


class EquipmentMaintenanceRemindersOut(BaseModel):
    items: list[EquipmentMaintenanceReminderItemOut] = Field(default_factory=list)
    summary: MaintenanceReminderSummaryOut


@router.get(
    "/maintenance-reminders",
    response_model=EquipmentMaintenanceRemindersOut,
    summary="设备保养提醒列表（保养计划表 / 工作台）",
    dependencies=[Depends(require_haoligo_module_access( "equipment-reports-maintenance-plan"))],
)
async def get_equipment_maintenance_reminders(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    keyword: Annotated[str | None, Query()] = None,
    severity_min: Annotated[str | None, Query(description="all | warning | critical")] = None,
    actionable_only: Annotated[bool, Query()] = False,
    reminder_kinds: Annotated[
        str | None,
        Query(description="逗号分隔：manual_maintenance,setup_no_cycle,setup_no_baseline,cycle_plan"),
    ] = None,
    limit: Annotated[int | None, Query(ge=1, le=500)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    preview: Annotated[
        bool,
        Query(description="工作台预览：仅返回 Top N 与 actionable 汇总，跳过分项统计与全量排序"),
    ] = False,
) -> EquipmentMaintenanceRemindersOut:
    items_raw, summary = await list_equipment_maintenance_reminders(
        tenant_id,
        keyword=keyword,
        severity_min=severity_min,
        actionable_only=actionable_only,
        reminder_kinds=reminder_kinds,
        limit=limit,
        offset=offset,
        preview=preview,
    )
    items = [EquipmentMaintenanceReminderItemOut.model_validate(i) for i in items_raw]
    return EquipmentMaintenanceRemindersOut(
        items=items,
        summary=MaintenanceReminderSummaryOut.model_validate(summary),
    )


def _apply_output_record_filters(
    qs,
    *,
    equipment_id: Optional[int],
    workshop_id: Optional[int] = None,
    sheet_no: Optional[str],
    work_order_no: Optional[str],
    finished_product_code: Optional[str] = None,
    finished_product_name: Optional[str] = None,
    operator_name: Optional[str] = None,
    team_leader_name: Optional[str] = None,
    recorded_from: Optional[str],
    recorded_to: Optional[str],
    startup_from: Optional[str] = None,
    startup_to: Optional[str] = None,
    completed_from: Optional[str] = None,
    completed_to: Optional[str] = None,
    keyword: Optional[str],
):
    if equipment_id is not None:
        qs = qs.filter(equipment_id=equipment_id)
    if workshop_id is not None:
        qs = qs.filter(equipment__workshop_id=workshop_id)
    if sheet_no and sheet_no.strip():
        qs = qs.filter(sheet_no__icontains=sheet_no.strip())
    if work_order_no and work_order_no.strip():
        qs = qs.filter(work_order_no__icontains=work_order_no.strip())
    if finished_product_code and finished_product_code.strip():
        qs = qs.filter(finished_product_code__icontains=finished_product_code.strip())
    if finished_product_name and finished_product_name.strip():
        qs = qs.filter(finished_product_name__icontains=finished_product_name.strip())
    if operator_name and operator_name.strip():
        qs = qs.filter(operator_name__icontains=operator_name.strip())
    if team_leader_name and team_leader_name.strip():
        qs = qs.filter(team_leader_name__icontains=team_leader_name.strip())
    rf = _parse_dt(recorded_from)
    rt = _parse_dt(recorded_to)
    if rf:
        qs = qs.filter(recorded_at__gte=rf)
    if rt:
        qs = qs.filter(recorded_at__lte=rt)
    sf = _parse_dt(startup_from)
    st = _parse_dt(startup_to)
    if sf:
        qs = qs.filter(startup_at__gte=sf)
    if st:
        qs = qs.filter(startup_at__lte=st)
    cf = _parse_dt(completed_from)
    ct = _parse_dt(completed_to)
    if cf:
        qs = qs.filter(completed_at__gte=cf)
    if ct:
        qs = qs.filter(completed_at__lte=ct)
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
        planned_qty_total=normalize_equipment_output_qty(planned_total),
        completed_qty_total=normalize_equipment_output_qty(completed_total, required=True),
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
    period_label: Optional[str] = Field(None, description="周期标签（与 period 维度组合汇总时）")
    record_count: int
    planned_qty_total: Optional[Decimal] = None
    completed_qty_total: Decimal
    achievement_rate_pct: Optional[float] = None


class CapacityByWorkshopRow(BaseModel):
    workshop_id: Optional[int] = None
    workshop_name: str = ""
    period_label: Optional[str] = Field(None, description="周期标签（与 period 维度组合汇总时）")
    record_count: int
    planned_qty_total: Optional[Decimal] = None
    completed_qty_total: Decimal
    achievement_rate_pct: Optional[float] = None


class CapacityByPeriodRow(BaseModel):
    period_label: str = Field(description="周期标签（YYYY-MM / YYYY-Qn / YYYY）")
    record_count: int
    planned_qty_total: Optional[Decimal] = None
    completed_qty_total: Decimal
    achievement_rate_pct: Optional[float] = None


class CapacityReportOut(BaseModel):
    summary: CapacitySummary
    group_by: str
    items: List[OutputRecordOut] = Field(default_factory=list)
    equipment_items: List[CapacityByEquipmentRow] = Field(default_factory=list)
    workshop_items: List[CapacityByWorkshopRow] = Field(default_factory=list)
    period_items: List[CapacityByPeriodRow] = Field(default_factory=list)
    total: int = 0
    skip: int = 0
    limit: int = 20


def _capacity_period_label(recorded_at: datetime, mode: str) -> str:
    if mode == "month":
        return recorded_at.strftime("%Y-%m")
    if mode == "quarter":
        quarter = (recorded_at.month - 1) // 3 + 1
        return f"{recorded_at.year}-Q{quarter}"
    if mode == "year":
        return str(recorded_at.year)
    raise ValueError(f"unsupported period mode: {mode}")


async def _aggregate_capacity_by_period(qs, mode: str, skip: int, limit: int) -> tuple[List[CapacityByPeriodRow], int]:
    rows = await qs.values("recorded_at", "planned_qty", "completed_qty")
    buckets: dict[str, dict[str, object]] = defaultdict(
        lambda: {"count": 0, "planned": Decimal("0"), "completed": Decimal("0")}
    )
    for row in rows:
        recorded_at = row.get("recorded_at")
        if recorded_at is None:
            continue
        key = _capacity_period_label(recorded_at, mode)
        bucket = buckets[key]
        bucket["count"] = int(bucket["count"]) + 1
        planned = row.get("planned_qty")
        completed = row.get("completed_qty")
        if planned is not None:
            bucket["planned"] = Decimal(str(bucket["planned"])) + Decimal(str(planned))
        if completed is not None:
            bucket["completed"] = Decimal(str(bucket["completed"])) + Decimal(str(completed))
    sorted_keys = sorted(buckets.keys(), reverse=True)
    total = len(sorted_keys)
    page_keys = sorted_keys[skip : skip + limit]
    period_items: List[CapacityByPeriodRow] = []
    for key in page_keys:
        bucket = buckets[key]
        planned_raw = bucket["planned"]
        completed_raw = bucket["completed"]
        planned = planned_raw if isinstance(planned_raw, Decimal) and planned_raw > 0 else None
        completed = completed_raw if isinstance(completed_raw, Decimal) else Decimal("0")
        period_items.append(
            CapacityByPeriodRow(
                period_label=key,
                record_count=int(bucket["count"]),
                planned_qty_total=normalize_equipment_output_qty(planned),
                completed_qty_total=normalize_equipment_output_qty(completed, required=True),
                achievement_rate_pct=_achievement_rate_pct(planned, completed),
            )
        )
    return period_items, total


def _bucket_add(bucket: dict[str, object], planned, completed) -> None:
    bucket["count"] = int(bucket["count"]) + 1
    if planned is not None:
        bucket["planned"] = Decimal(str(bucket["planned"])) + Decimal(str(planned))
    if completed is not None:
        bucket["completed"] = Decimal(str(bucket["completed"])) + Decimal(str(completed))


def _bucket_totals(bucket: dict[str, object]) -> tuple[Optional[Decimal], Decimal]:
    planned_raw = bucket["planned"]
    completed_raw = bucket["completed"]
    planned = planned_raw if isinstance(planned_raw, Decimal) and planned_raw > 0 else None
    completed = completed_raw if isinstance(completed_raw, Decimal) else Decimal("0")
    return planned, completed


async def _aggregate_capacity_by_equipment_period(
    qs,
    tenant_id: int,
    period_mode: str,
    skip: int,
    limit: int,
) -> tuple[List[CapacityByEquipmentRow], int]:
    rows = await qs.values("recorded_at", "planned_qty", "completed_qty", "equipment_id")
    buckets: dict[tuple[str, int], dict[str, object]] = defaultdict(
        lambda: {"count": 0, "planned": Decimal("0"), "completed": Decimal("0")}
    )
    for row in rows:
        recorded_at = row.get("recorded_at")
        equipment_id = row.get("equipment_id")
        if recorded_at is None or equipment_id is None:
            continue
        key = (_capacity_period_label(recorded_at, period_mode), int(equipment_id))
        _bucket_add(buckets[key], row.get("planned_qty"), row.get("completed_qty"))
    sorted_keys = sorted(
        buckets.keys(),
        key=lambda item: (item[0], -int(buckets[item]["completed"] if isinstance(buckets[item]["completed"], Decimal) else Decimal("0"))),
        reverse=True,
    )
    total = len(sorted_keys)
    page_keys = sorted_keys[skip : skip + limit]
    eq_ids = list({eid for _, eid in page_keys})
    eq_map: dict[int, HaoligoEquipment] = {}
    if eq_ids:
        eqs = await tenant_alive(HaoligoEquipment, tenant_id).filter(id__in=eq_ids)
        eq_map = {e.id: e for e in eqs}
    equipment_items: List[CapacityByEquipmentRow] = []
    for period_label, eid in page_keys:
        bucket = buckets[(period_label, eid)]
        planned, completed = _bucket_totals(bucket)
        eq = eq_map.get(eid)
        equipment_items.append(
            CapacityByEquipmentRow(
                equipment_id=eid,
                equipment_asset_code=eq.asset_code if eq else "",
                equipment_name=eq.name if eq else "",
                period_label=period_label,
                record_count=int(bucket["count"]),
                planned_qty_total=normalize_equipment_output_qty(planned),
                completed_qty_total=normalize_equipment_output_qty(completed, required=True),
                achievement_rate_pct=_achievement_rate_pct(planned, completed),
            )
        )
    return equipment_items, total


async def _aggregate_capacity_by_workshop_period(
    qs,
    tenant_id: int,
    period_mode: str,
    skip: int,
    limit: int,
) -> tuple[List[CapacityByWorkshopRow], int]:
    rows = await qs.values(
        "recorded_at",
        "planned_qty",
        "completed_qty",
        "equipment__workshop_id",
    )
    buckets: dict[tuple[str, Optional[int]], dict[str, object]] = defaultdict(
        lambda: {"count": 0, "planned": Decimal("0"), "completed": Decimal("0")}
    )
    for row in rows:
        recorded_at = row.get("recorded_at")
        if recorded_at is None:
            continue
        wid = row.get("equipment__workshop_id")
        workshop_id = int(wid) if wid is not None else None
        key = (_capacity_period_label(recorded_at, period_mode), workshop_id)
        _bucket_add(buckets[key], row.get("planned_qty"), row.get("completed_qty"))
    sorted_keys = sorted(
        buckets.keys(),
        key=lambda item: (
            item[0],
            -int(buckets[item]["completed"] if isinstance(buckets[item]["completed"], Decimal) else Decimal("0")),
        ),
        reverse=True,
    )
    total = len(sorted_keys)
    page_keys = sorted_keys[skip : skip + limit]
    ws_ids = [wid for _, wid in page_keys if wid is not None]
    ws_map: dict[int, HaoligoWorkshop] = {}
    if ws_ids:
        wss = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id__in=ws_ids)
        ws_map = {w.id: w for w in wss}
    workshop_items: List[CapacityByWorkshopRow] = []
    for period_label, wid in page_keys:
        bucket = buckets[(period_label, wid)]
        planned, completed = _bucket_totals(bucket)
        ws = ws_map.get(int(wid)) if wid is not None else None
        workshop_items.append(
            CapacityByWorkshopRow(
                workshop_id=wid,
                workshop_name=ws.name if ws else "",
                period_label=period_label,
                record_count=int(bucket["count"]),
                planned_qty_total=normalize_equipment_output_qty(planned),
                completed_qty_total=normalize_equipment_output_qty(completed, required=True),
                achievement_rate_pct=_achievement_rate_pct(planned, completed),
            )
        )
    return workshop_items, total


def _parse_capacity_group_by(mode: str) -> tuple[str, Optional[str]]:
    normalized = (mode or "detail").strip().lower()
    if normalized in ("detail", "equipment", "workshop"):
        return normalized, None
    if normalized in ("month", "quarter", "year"):
        return "period", normalized
    if "_" in normalized:
        dimension, period = normalized.split("_", 1)
        if dimension in ("equipment", "workshop") and period in ("month", "quarter", "year"):
            return dimension, period
    return "detail", None


@router.get(
    "/capacity",
    response_model=CapacityReportOut,
    summary="产能查询（设备产出单）",
    dependencies=[Depends(require_haoligo_module_access( "equipment-reports-capacity"))],
)
async def capacity_report(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    equipment_id: Optional[int] = Query(None, ge=1),
    workshop_id: Optional[int] = Query(None, ge=1),
    sheet_no: Optional[str] = None,
    work_order_no: Optional[str] = None,
    finished_product_code: Optional[str] = None,
    finished_product_name: Optional[str] = None,
    operator_name: Optional[str] = None,
    team_leader_name: Optional[str] = None,
    recorded_from: Optional[str] = None,
    recorded_to: Optional[str] = None,
    startup_from: Optional[str] = None,
    startup_to: Optional[str] = None,
    completed_from: Optional[str] = None,
    completed_to: Optional[str] = None,
    keyword: Optional[str] = None,
    group_by: str = Query(
        "detail",
        description=(
            "detail=产出明细；equipment=按设备；workshop=按车间；"
            "month/quarter/year=按产出时间周期；equipment_month 等=设备/车间+周期组合"
        ),
    ),
):
    qs = tenant_alive(HaoligoEquipmentOutputRecord, tenant_id)
    qs = _apply_output_record_filters(
        qs,
        equipment_id=equipment_id,
        workshop_id=workshop_id,
        sheet_no=sheet_no,
        work_order_no=work_order_no,
        finished_product_code=finished_product_code,
        finished_product_name=finished_product_name,
        operator_name=operator_name,
        team_leader_name=team_leader_name,
        recorded_from=recorded_from,
        recorded_to=recorded_to,
        startup_from=startup_from,
        startup_to=startup_to,
        completed_from=completed_from,
        completed_to=completed_to,
        keyword=keyword,
    )
    summary = await _summary_for_qs(qs)
    dimension, period = _parse_capacity_group_by(group_by)
    if dimension == "equipment" and period:
        equipment_items, total = await _aggregate_capacity_by_equipment_period(qs, tenant_id, period, skip, limit)
        return CapacityReportOut(
            summary=summary,
            group_by=f"equipment_{period}",
            equipment_items=equipment_items,
            total=total,
            skip=skip,
            limit=limit,
        )
    if dimension == "workshop" and period:
        workshop_items, total = await _aggregate_capacity_by_workshop_period(qs, tenant_id, period, skip, limit)
        return CapacityReportOut(
            summary=summary,
            group_by=f"workshop_{period}",
            workshop_items=workshop_items,
            total=total,
            skip=skip,
            limit=limit,
        )
    if dimension == "equipment":
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
                    planned_qty_total=normalize_equipment_output_qty(planned),
                    completed_qty_total=normalize_equipment_output_qty(completed, required=True),
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

    if dimension == "workshop":
        agg_rows = (
            await qs.annotate(
                record_count=Count("id"),
                planned_total=Sum("planned_qty"),
                completed_total=Sum("completed_qty"),
            )
            .group_by("equipment__workshop_id")
            .order_by("-completed_total")
            .values("equipment__workshop_id", "record_count", "planned_total", "completed_total")
        )
        total = len(agg_rows)
        page = agg_rows[skip : skip + limit]
        ws_ids = [
            int(r["equipment__workshop_id"])
            for r in page
            if r.get("equipment__workshop_id") is not None
        ]
        ws_map: dict[int, HaoligoWorkshop] = {}
        if ws_ids:
            wss = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id__in=ws_ids)
            ws_map = {w.id: w for w in wss}
        workshop_items: List[CapacityByWorkshopRow] = []
        for r in page:
            wid = r.get("equipment__workshop_id")
            ws = ws_map.get(int(wid)) if wid is not None else None
            planned = r.get("planned_total")
            completed = r.get("completed_total") or Decimal("0")
            workshop_items.append(
                CapacityByWorkshopRow(
                    workshop_id=int(wid) if wid is not None else None,
                    workshop_name=ws.name if ws else "",
                    record_count=int(r.get("record_count") or 0),
                    planned_qty_total=normalize_equipment_output_qty(planned),
                    completed_qty_total=normalize_equipment_output_qty(completed, required=True),
                    achievement_rate_pct=_achievement_rate_pct(planned, completed),
                )
            )
        return CapacityReportOut(
            summary=summary,
            group_by="workshop",
            workshop_items=workshop_items,
            total=total,
            skip=skip,
            limit=limit,
        )

    if dimension == "period" and period:
        period_items, total = await _aggregate_capacity_by_period(qs, period, skip, limit)
        return CapacityReportOut(
            summary=summary,
            group_by=period,
            period_items=period_items,
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
