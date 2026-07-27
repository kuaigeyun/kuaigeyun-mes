"""滚动计划 REST API。"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Path, Query

from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError
from apps.kuaizhizao.schemas.rolling_schedule import (
    RollingScheduleCloseDayRequest,
    RollingScheduleGenerateRequest,
    RollingScheduleNextWorkdayResponse,
    RollingSchedulePlanResponse,
    RollingSchedulePublishResult,
    RollingScheduleSyncFromApsRequest,
    RollingScheduleUpdateLinesRequest,
)
from apps.kuaizhizao.services.rolling_schedule_service import RollingScheduleService

router = APIRouter(prefix="/rolling-schedules", tags=["App - Kuaige Zhizao - Rolling Plan"])

_service = RollingScheduleService()


@router.get(
    "/next-workday",
    response_model=RollingScheduleNextWorkdayResponse,
    summary="Get next workday after base date",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-rolling-scheduling:read"))],
)
async def get_next_workday(
    base_date: Optional[date] = Query(None, description="基准日，默认今天"),
    tenant_id: int = Depends(get_current_tenant),
) -> RollingScheduleNextWorkdayResponse:
    anchor = base_date or date.today()
    next_day = await _service.get_next_workday(tenant_id, anchor)
    return RollingScheduleNextWorkdayResponse(base_date=anchor, next_workday=next_day)


@router.get(
    "/by-date/{plan_date}",
    response_model=Optional[RollingSchedulePlanResponse],
    summary="Get rolling schedule plan by plan date",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-rolling-scheduling:read"))],
)
async def get_plan_by_date(
    plan_date: date = Path(..., description="计划工作日"),
    tenant_id: int = Depends(get_current_tenant),
) -> Optional[RollingSchedulePlanResponse]:
    plan = await _service.get_plan_by_date(tenant_id, plan_date)
    return plan


@router.post(
    "/close-day",
    response_model=RollingSchedulePlanResponse,
    summary="Close day-end for a published plan date",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-rolling-scheduling:close"))],
)
async def close_day(
    body: RollingScheduleCloseDayRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> RollingSchedulePlanResponse:
    try:
        return await _service.close_day(tenant_id, body.plan_date, current_user.id)
    except (NotFoundError, ValidationError):
        raise


@router.post(
    "/generate",
    response_model=RollingSchedulePlanResponse,
    summary="Generate draft plan for next workday",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-rolling-scheduling:create"))],
)
async def generate_plan(
    body: RollingScheduleGenerateRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> RollingSchedulePlanResponse:
    try:
        return await _service.generate_plan(
            tenant_id,
            base_date=body.base_date,
            backlog_readiness_threshold=body.backlog_readiness_threshold,
            created_by=current_user.id,
        )
    except ValidationError:
        raise


@router.post(
    "/sync-from-aps",
    response_model=RollingSchedulePlanResponse,
    summary="Sync APS confirmed work orders into rolling day plan lines",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def sync_from_aps(
    body: RollingScheduleSyncFromApsRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> RollingSchedulePlanResponse:
    try:
        return await _service.sync_from_aps_confirm(
            tenant_id,
            body.plan_date,
            body.work_order_ids,
            int(current_user.id),
        )
    except ValidationError:
        raise


@router.put(
    "/{plan_id}/lines",
    response_model=RollingSchedulePlanResponse,
    summary="Update plan lines (draft only)",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-rolling-scheduling:update"))],
)
async def update_plan_lines(
    body: RollingScheduleUpdateLinesRequest,
    plan_id: int = Path(..., description="计划ID"),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> RollingSchedulePlanResponse:
    try:
        return await _service.update_lines(
            tenant_id,
            plan_id,
            body.lines,
            current_user.id,
        )
    except (NotFoundError, ValidationError):
        raise


@router.post(
    "/{plan_id}/publish",
    response_model=RollingSchedulePublishResult,
    summary="Publish plan and write work order planned dates",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-rolling-scheduling:publish"))],
)
async def publish_plan(
    plan_id: int = Path(..., description="计划ID"),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> RollingSchedulePublishResult:
    try:
        plan, batch_result = await _service.publish_plan(tenant_id, plan_id, current_user.id)
        return RollingSchedulePublishResult(plan=plan, batch_update=batch_result)
    except (NotFoundError, ValidationError):
        raise
