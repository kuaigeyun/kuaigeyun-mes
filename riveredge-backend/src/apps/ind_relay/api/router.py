"""继电器制造行业插件 API。"""

from datetime import date as date_cls
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from apps.ind_relay.models.changeover_matrix import RelayChangeoverMatrix
from apps.ind_relay.models.line_capacity import RelayLineCapacity
from apps.kuaizhizao.services.output_basis_service import OutputBasisService
from apps.master_data.models.factory import ProductionLine
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.utils.timezone_utils import (
    resolve_business_datetime,
    site_day_bounds_utc,
    to_site_date,
)
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="", tags=["App - Industry Relay"])


class LineCapacityCreate(BaseModel):
    production_line_id: int
    takt_seconds: float = 0
    daily_capacity_qty: float = 0
    changeover_minutes_default: float = 0
    remarks: Optional[str] = None


class LineCapacityUpdate(BaseModel):
    takt_seconds: Optional[float] = None
    daily_capacity_qty: Optional[float] = None
    changeover_minutes_default: Optional[float] = None
    is_active: Optional[bool] = None
    remarks: Optional[str] = None


class LineCapacityResponse(BaseModel):
    id: int
    production_line_id: int
    production_line_code: Optional[str] = None
    production_line_name: Optional[str] = None
    takt_seconds: float
    daily_capacity_qty: float
    changeover_minutes_default: float
    is_active: bool
    remarks: Optional[str] = None


class ChangeoverCreate(BaseModel):
    from_family: str = Field(..., max_length=100)
    to_family: str = Field(..., max_length=100)
    changeover_minutes: float = 0
    forbid_same_line: bool = False
    remarks: Optional[str] = None


class ChangeoverUpdate(BaseModel):
    changeover_minutes: Optional[float] = None
    forbid_same_line: Optional[bool] = None
    remarks: Optional[str] = None


class ChangeoverResponse(BaseModel):
    id: int
    from_family: str
    to_family: str
    changeover_minutes: float
    forbid_same_line: bool
    remarks: Optional[str] = None


class LineOutputRow(BaseModel):
    production_line_id: int
    production_line_code: Optional[str] = None
    production_line_name: Optional[str] = None
    daily_capacity_qty: float
    planned_quantity: float = 0
    output_qualified: float
    achievement_rate: float
    plan_achievement_rate: float = 0


async def _planned_qty_by_line(
    tenant_id: int,
    start_day: date_cls,
    end_day: date_cls,
    range_start: datetime,
    range_end: datetime,
) -> dict:
    """按产线汇总计划量：优先滚动计划行，否则用工单计划量（按窗内已排工序归属产线）。"""
    from collections import defaultdict

    from apps.kuaizhizao.models.rolling_schedule_plan import (
        RollingSchedulePlan,
        RollingSchedulePlanLine,
    )
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
    from apps.master_data.models.factory import Workstation

    result: dict = defaultdict(float)
    station_to_line = {
        int(r["id"]): int(r.get("production_line_id") or 0)
        for r in await Workstation.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).values("id", "production_line_id")
        if int(r.get("production_line_id") or 0) > 0
    }

    plans = await RollingSchedulePlan.filter(
        tenant_id=tenant_id,
        plan_date__gte=start_day,
        plan_date__lte=end_day,
        deleted_at__isnull=True,
    ).all()
    if plans:
        plan_ids = [int(p.id) for p in plans]
        plan_lines = await RollingSchedulePlanLine.filter(
            tenant_id=tenant_id, plan_id__in=plan_ids
        ).all()
        wo_ids = list({int(ln.work_order_id) for ln in plan_lines if ln.work_order_id})
        wo_to_line: dict = {}
        if wo_ids:
            ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id__in=wo_ids,
                deleted_at__isnull=True,
                assigned_station_id__gt=0,
            ).all()
            for op in ops:
                wid = int(op.work_order_id or 0)
                if wid in wo_to_line:
                    continue
                lid = station_to_line.get(int(op.assigned_station_id or 0), 0)
                if lid > 0:
                    wo_to_line[wid] = lid
        for ln in plan_lines:
            lid = wo_to_line.get(int(ln.work_order_id or 0), 0)
            if lid > 0:
                result[lid] += float(ln.planned_quantity or 0)
        if result:
            return dict(result)

    # fallback：窗内已排工序归属产线的工单计划量（同 WO 只计一次）
    ops = await WorkOrderOperation.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        assigned_station_id__gt=0,
        planned_start_date__gte=range_start,
        planned_start_date__lte=range_end,
    ).all()
    wo_to_line = {}
    for op in ops:
        wid = int(op.work_order_id or 0)
        if wid in wo_to_line:
            continue
        lid = station_to_line.get(int(op.assigned_station_id or 0), 0)
        if lid > 0:
            wo_to_line[wid] = lid
    if not wo_to_line:
        return {}
    for row in await WorkOrder.filter(
        tenant_id=tenant_id, id__in=list(wo_to_line.keys()), deleted_at__isnull=True
    ).values("id", "quantity"):
        lid = wo_to_line.get(int(row["id"]), 0)
        if lid > 0:
            result[lid] += float(row.get("quantity") or 0)
    return dict(result)


def _capacity_response(row: RelayLineCapacity) -> LineCapacityResponse:
    return LineCapacityResponse(
        id=row.id,
        production_line_id=row.production_line_id,
        production_line_code=row.production_line_code,
        production_line_name=row.production_line_name,
        takt_seconds=float(row.takt_seconds or 0),
        daily_capacity_qty=float(row.daily_capacity_qty or 0),
        changeover_minutes_default=float(row.changeover_minutes_default or 0),
        is_active=bool(row.is_active),
        remarks=row.remarks,
    )


def _changeover_response(row: RelayChangeoverMatrix) -> ChangeoverResponse:
    return ChangeoverResponse(
        id=row.id,
        from_family=row.from_family,
        to_family=row.to_family,
        changeover_minutes=float(row.changeover_minutes or 0),
        forbid_same_line=bool(row.forbid_same_line),
        remarks=row.remarks,
    )


@router.get(
    "/health",
    dependencies=[Depends(require_permission_codes("ind-relay:entry:read"))],
)
async def health(tenant_id: int = Depends(get_current_tenant)) -> dict:
    return {"ok": True, "app": "ind-relay", "tenant_id": tenant_id}


@router.get(
    "/status",
    dependencies=[Depends(require_permission_codes("ind-relay:entry:read"))],
)
async def module_status(tenant_id: int = Depends(get_current_tenant)) -> dict:
    """行业包生效状态：产量口径、排程资源模式、主数据就绪情况。"""
    from apps.ind_relay.extension_hooks import SNAPSHOT_KEY
    from apps.kuaizhizao.services.scheduling_config_service import SchedulingConfigService
    from infra.models.tenant import Tenant

    basis = await OutputBasisService.get_output_basis(tenant_id)
    cfg = await SchedulingConfigService().get_default_config(tenant_id)
    constraints = {}
    if cfg and cfg.constraints is not None:
        raw = cfg.constraints
        constraints = raw.model_dump() if hasattr(raw, "model_dump") else dict(raw or {})
    tenant = await Tenant.get_or_none(id=tenant_id)
    settings = dict(tenant.settings or {}) if tenant else {}
    has_snapshot = SNAPSHOT_KEY in settings
    line_cap_count = 0
    changeover_count = 0
    tables_ready = True
    try:
        line_cap_count = await RelayLineCapacity.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).count()
        changeover_count = await RelayChangeoverMatrix.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        ).count()
    except Exception:
        tables_ready = False

    return {
        "output_basis": basis,
        "resource_mode": constraints.get("resource_mode") or "workstation",
        "line_exclusive": bool(constraints.get("line_exclusive", True)),
        "host_defaults_applied": has_snapshot
        or (
            basis == "last_operation_effective_qualified"
            and constraints.get("resource_mode") == "production_line"
        ),
        "tables_ready": tables_ready,
        "line_capacity_count": line_cap_count,
        "changeover_count": changeover_count,
        "hints": [
            "侧栏「行业包」→「继电器制造」可见菜单后即表示模块已挂载",
            "配置中心 → 实现产能口径应为「仅末道有效合格」",
            "可视排产设置 → 排程资源维度应为「按产线」",
            "若口径未变，可在本页点击「重新应用默认配置」（需入口更新权限）",
            "换型矩阵已接入排程引擎与拖拽校验（按料号族；无矩阵时回退全局换型小时）",
        ],
    }


@router.post(
    "/status/reapply-defaults",
    dependencies=[Depends(require_permission_codes("ind-relay:entry:update"))],
)
async def reapply_host_defaults(tenant_id: int = Depends(get_current_tenant)) -> dict:
    """已启用租户可手动重放启停种子（产量口径 + 产线排程）；不覆盖首次快照。"""
    from apps.ind_relay.extension_hooks import HOST_DEFAULTS_EXT, apply_standalone

    await apply_standalone(tenant_id, HOST_DEFAULTS_EXT)
    return await module_status(tenant_id)


@router.get(
    "/line-capacities",
    response_model=List[LineCapacityResponse],
    dependencies=[Depends(require_permission_codes("ind-relay:line-capacity:read"))],
)
async def list_line_capacities(
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    rows = (
        await RelayLineCapacity.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        .order_by("-id")
        .offset(skip)
        .limit(limit)
    )
    return [_capacity_response(r) for r in rows]


@router.post(
    "/line-capacities",
    response_model=LineCapacityResponse,
    dependencies=[Depends(require_permission_codes("ind-relay:line-capacity:create"))],
)
async def create_line_capacity(
    body: LineCapacityCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    line = await ProductionLine.get_or_none(
        tenant_id=tenant_id, id=body.production_line_id, deleted_at__isnull=True
    )
    if not line:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="产线不存在")
    existing = await RelayLineCapacity.get_or_none(
        tenant_id=tenant_id,
        production_line_id=body.production_line_id,
        deleted_at__isnull=True,
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该产线已配置节拍产能")
    row = await RelayLineCapacity.create(
        tenant_id=tenant_id,
        production_line_id=body.production_line_id,
        production_line_code=line.code,
        production_line_name=line.name,
        takt_seconds=Decimal(str(body.takt_seconds or 0)),
        daily_capacity_qty=Decimal(str(body.daily_capacity_qty or 0)),
        changeover_minutes_default=Decimal(str(body.changeover_minutes_default or 0)),
        is_active=True,
        remarks=body.remarks,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    return _capacity_response(row)


@router.patch(
    "/line-capacities/{row_id}",
    response_model=LineCapacityResponse,
    dependencies=[Depends(require_permission_codes("ind-relay:line-capacity:update"))],
)
async def update_line_capacity(
    row_id: int,
    body: LineCapacityUpdate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    row = await RelayLineCapacity.get_or_none(
        tenant_id=tenant_id, id=row_id, deleted_at__isnull=True
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        if key in ("takt_seconds", "daily_capacity_qty", "changeover_minutes_default") and val is not None:
            setattr(row, key, Decimal(str(val)))
        else:
            setattr(row, key, val)
    row.updated_by = current_user.id
    await row.save()
    return _capacity_response(row)


@router.get(
    "/changeovers",
    response_model=List[ChangeoverResponse],
    dependencies=[Depends(require_permission_codes("ind-relay:changeover:read"))],
)
async def list_changeovers(
    tenant_id: int = Depends(get_current_tenant),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    rows = (
        await RelayChangeoverMatrix.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        .order_by("-id")
        .offset(skip)
        .limit(limit)
    )
    return [_changeover_response(r) for r in rows]


@router.post(
    "/changeovers",
    response_model=ChangeoverResponse,
    dependencies=[Depends(require_permission_codes("ind-relay:changeover:create"))],
)
async def create_changeover(
    body: ChangeoverCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    from_family = body.from_family.strip()
    to_family = body.to_family.strip()
    if not from_family or not to_family:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="料号族不能为空")
    existing = await RelayChangeoverMatrix.get_or_none(
        tenant_id=tenant_id,
        from_family=from_family,
        to_family=to_family,
        deleted_at__isnull=True,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该料号族换型规则已存在",
        )
    row = await RelayChangeoverMatrix.create(
        tenant_id=tenant_id,
        from_family=from_family,
        to_family=to_family,
        changeover_minutes=Decimal(str(body.changeover_minutes or 0)),
        forbid_same_line=bool(body.forbid_same_line),
        remarks=body.remarks,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    return _changeover_response(row)


@router.patch(
    "/changeovers/{row_id}",
    response_model=ChangeoverResponse,
    dependencies=[Depends(require_permission_codes("ind-relay:changeover:update"))],
)
async def update_changeover(
    row_id: int,
    body: ChangeoverUpdate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    row = await RelayChangeoverMatrix.get_or_none(
        tenant_id=tenant_id, id=row_id, deleted_at__isnull=True
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    data = body.model_dump(exclude_unset=True)
    if "changeover_minutes" in data and data["changeover_minutes"] is not None:
        row.changeover_minutes = Decimal(str(data.pop("changeover_minutes")))
    for key, val in data.items():
        setattr(row, key, val)
    row.updated_by = current_user.id
    await row.save()
    return _changeover_response(row)


@router.delete(
    "/changeovers/{row_id}",
    dependencies=[Depends(require_permission_codes("ind-relay:changeover:update"))],
)
async def delete_changeover(
    row_id: int,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    """软删除换型规则。"""
    row = await RelayChangeoverMatrix.get_or_none(
        tenant_id=tenant_id, id=row_id, deleted_at__isnull=True
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    row.deleted_at = resolve_business_datetime()
    row.updated_by = current_user.id
    await row.save(update_fields=["deleted_at", "updated_by", "updated_at"])
    return {"ok": True}


@router.get(
    "/line-output",
    response_model=List[LineOutputRow],
    dependencies=[Depends(require_permission_codes("ind-relay:line-output:read"))],
)
async def line_output_dashboard(
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_end: Optional[str] = Query(None, description="YYYY-MM-DD"),
):
    """按产线展示实现产能达成（分子走 output_basis）。"""
    today = to_site_date(resolve_business_datetime())
    try:
        end_day = date_cls.fromisoformat(date_end[:10]) if date_end else today
        start_day = date_cls.fromisoformat(date_start[:10]) if date_start else end_day
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="日期格式须为 YYYY-MM-DD",
        ) from exc
    if start_day > end_day:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="开始日期不能晚于结束日期",
        )
    start_utc, _ = site_day_bounds_utc(start_day)
    _, end_excl = site_day_bounds_utc(end_day)
    range_start = start_utc
    range_end = end_excl - timedelta(microseconds=1)
    planned_by_line = await _planned_qty_by_line(
        tenant_id, start_day, end_day, range_start, range_end
    )

    caps = await RelayLineCapacity.filter(
        tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
    ).all()
    if not caps:
        lines = await ProductionLine.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
        ).all()
        result: List[LineOutputRow] = []
        for line in lines:
            stats = await OutputBasisService.sum_output_quantities(
                tenant_id,
                date_start=range_start,
                date_end=range_end,
                production_line_id=int(line.id),
            )
            out_q = float(stats.get("qualified_quantity") or 0)
            plan_q = float(planned_by_line.get(int(line.id), 0))
            plan_rate = round(out_q / plan_q * 100, 2) if plan_q > 0 else 0.0
            result.append(
                LineOutputRow(
                    production_line_id=int(line.id),
                    production_line_code=line.code,
                    production_line_name=line.name,
                    daily_capacity_qty=0,
                    planned_quantity=plan_q,
                    output_qualified=out_q,
                    achievement_rate=0,
                    plan_achievement_rate=plan_rate,
                )
            )
        return result

    result = []
    for cap in caps:
        stats = await OutputBasisService.sum_output_quantities(
            tenant_id,
            date_start=range_start,
            date_end=range_end,
            production_line_id=int(cap.production_line_id),
        )
        out_q = float(stats.get("qualified_quantity") or 0)
        cap_q = float(cap.daily_capacity_qty or 0)
        # 日产能按区间天数放大，便于多日对比
        day_count = max(1, (end_day - start_day).days + 1)
        capacity_q = cap_q * day_count
        plan_q = float(planned_by_line.get(int(cap.production_line_id), 0))
        rate = round(out_q / capacity_q * 100, 2) if capacity_q > 0 else 0.0
        plan_rate = round(out_q / plan_q * 100, 2) if plan_q > 0 else 0.0
        result.append(
            LineOutputRow(
                production_line_id=int(cap.production_line_id),
                production_line_code=cap.production_line_code,
                production_line_name=cap.production_line_name,
                daily_capacity_qty=capacity_q,
                planned_quantity=plan_q,
                output_qualified=out_q,
                achievement_rate=rate,
                plan_achievement_rate=plan_rate,
            )
        )
    return result
