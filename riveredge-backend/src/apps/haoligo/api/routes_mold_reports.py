"""好力 GO — 模具统计报表 API。"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from apps.haoligo.services.maintenance_reminder import list_mold_maintenance_reminders

from apps.haoligo.services.maintenance_last_upkeep import fetch_last_upkeep_by_mold
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/molds/reports",
    tags=["App - HaoliGO - 模具报表"],
    dependencies=[Depends(require_haoligo_module_access("molds-reports-maintenance-alert"))],
)


class MaintenanceUpkeepLastByMoldOut(BaseModel):
    items: dict[str, datetime] = Field(
        default_factory=dict,
        description="模具代号 → 最近一次保养完修时间（厂内 + 外协已通过，ISO 8601）",
    )


@router.get(
    "/maintenance-upkeep-last-by-mold",
    response_model=MaintenanceUpkeepLastByMoldOut,
    summary="各模具最近保养完修时间（保养预警表聚合）",
)
async def get_maintenance_upkeep_last_by_mold(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MaintenanceUpkeepLastByMoldOut:
    out = await fetch_last_upkeep_by_mold(tenant_id, current_user)
    return MaintenanceUpkeepLastByMoldOut(items=out)


class MoldMaintenanceReminderSummaryOut(BaseModel):
    total_ledger: int = 0
    actionable: int = 0
    filtered_total: int = 0
    by_kind: dict[str, int] = Field(default_factory=dict)
    by_level: dict[str, int] = Field(default_factory=dict)


class MoldMaintenanceReminderItemOut(BaseModel):
    id: int
    mold_code: str
    name: str
    status: str | None = None
    maintenance_cycle_by_yield: str | None = None
    used_yield: str | None = None
    total_manufacture_qty: str | None = None
    usable_yield: str | None = None
    alert_level: Literal["critical", "warning", "ok"]
    alert_reasons: list[str] = Field(default_factory=list)
    reminder_kind: Literal[
        "manual_maintenance",
        "cycle_plan",
        "setup_no_cycle",
        "setup_no_baseline",
    ]
    dominant_dimension: Literal["yield", "yield_total"] | None = None
    dominant_ratio: float = 0.0
    last_upkeep_at: str | None = None
    yield_usage_pct: float | None = None
    total_yield_usage_pct: float | None = None
    remaining_yield_pct: float | None = None


class MoldMaintenanceRemindersOut(BaseModel):
    items: list[MoldMaintenanceReminderItemOut] = Field(default_factory=list)
    summary: MoldMaintenanceReminderSummaryOut


@router.get(
    "/maintenance-reminders",
    response_model=MoldMaintenanceRemindersOut,
    summary="模具保养提醒列表（保养预警表 / 工作台）",
)
async def get_mold_maintenance_reminders(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
    keyword: Annotated[str | None, Query()] = None,
    severity_min: Annotated[str | None, Query(description="all | warning | critical")] = None,
    actionable_only: Annotated[bool, Query()] = False,
    reminder_kinds: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query(description="模具台账状态")] = None,
    limit: Annotated[int | None, Query(ge=1, le=500)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    preview: Annotated[
        bool,
        Query(description="工作台预览：仅返回 Top N 与 actionable 汇总，跳过分项统计与全量排序"),
    ] = False,
) -> MoldMaintenanceRemindersOut:
    items_raw, summary = await list_mold_maintenance_reminders(
        tenant_id,
        current_user,
        keyword=keyword,
        severity_min=severity_min,
        actionable_only=actionable_only,
        reminder_kinds=reminder_kinds,
        status=status,
        limit=limit,
        offset=offset,
        preview=preview,
    )
    items = [MoldMaintenanceReminderItemOut.model_validate(i) for i in items_raw]
    return MoldMaintenanceRemindersOut(
        items=items,
        summary=MoldMaintenanceReminderSummaryOut.model_validate(summary),
    )
