"""可视排产 API。"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from apps.kuaizhizao.schemas.visual_scheduling import (
    VisualSchedulingScanResponse,
    VisualSchedulingValidateRequest,
    VisualSchedulingValidateResponse,
    SchedulingRateCoverageRequest,
    SchedulingRateCoverageResponse,
    SchedulingAutoRescheduleRequest,
    SchedulingAutoRescheduleResponse,
    SchedulingOperationBackfillRequest,
    SchedulingOperationBackfillResponse,
)
from apps.kuaizhizao.services.visual_scheduling_service import VisualSchedulingService
from apps.kuaizhizao.services.scheduling_rate_coverage_service import check_scheduling_rate_coverage
from apps.kuaizhizao.services.scheduling_engine.registry import get_scheduling_engine
from apps.kuaizhizao.services.scheduling_engine.base import SchedulingPlanRequest

router = APIRouter(prefix="/scheduling", tags=["App - Kuaige Zhizao - Visual Scheduling"])

_service = VisualSchedulingService()


def _parse_work_order_ids(raw: Optional[str]) -> Optional[List[int]]:
    if not raw:
        return None
    ids = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            val = int(part)
            if val > 0:
                ids.append(val)
        except ValueError:
            continue
    return ids or None


@router.get(
    "/board-scan",
    response_model=VisualSchedulingScanResponse,
    summary="Scan visual scheduling board",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:read"))],
)
async def scan_scheduling_board(
    work_order_ids: Optional[str] = Query(None, description="逗号分隔工单 ID"),
    work_center_id: Optional[int] = Query(None),
    horizon_days: int = Query(14, ge=1, le=90),
    plan_date: Optional[date] = Query(None, description="滚动计划日过滤"),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> VisualSchedulingScanResponse:
    del current_user
    raw = await _service.scan_board(
        tenant_id,
        work_order_ids=_parse_work_order_ids(work_order_ids),
        work_center_id=work_center_id,
        horizon_days=horizon_days,
        plan_date=plan_date,
    )
    return VisualSchedulingScanResponse(**raw)


@router.post(
    "/validate-adjustments",
    response_model=VisualSchedulingValidateResponse,
    summary="Validate schedule adjustments before save",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def validate_schedule_adjustments(
    body: VisualSchedulingValidateRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> VisualSchedulingValidateResponse:
    del current_user
    raw = await _service.validate_adjustments(
        tenant_id,
        work_order_updates=[u.model_dump() for u in body.work_order_updates],
        operation_updates=[u.model_dump() for u in body.operation_updates],
        operation_station_updates=[u.model_dump() for u in body.operation_station_updates],
    )
    return VisualSchedulingValidateResponse(**raw)


@router.post(
    "/rate-coverage",
    response_model=SchedulingRateCoverageResponse,
    summary="Check performance rate coverage for dispatch assignments",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:read"))],
)
async def check_rate_coverage(
    body: SchedulingRateCoverageRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> SchedulingRateCoverageResponse:
    del current_user
    raw = await check_scheduling_rate_coverage(
        tenant_id,
        [item.model_dump() for item in body.items],
    )
    return SchedulingRateCoverageResponse(**raw)


@router.post(
    "/backfill-operation-settings",
    response_model=SchedulingOperationBackfillResponse,
    summary="Backfill operation hours/station for visual scheduling",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def backfill_operation_settings(
    body: SchedulingOperationBackfillRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> SchedulingOperationBackfillResponse:
    from fastapi import HTTPException, status
    from infra.exceptions.exceptions import NotFoundError, ValidationError

    try:
        raw = await _service.backfill_operation_settings(
            tenant_id,
            items=[item.model_dump(exclude_unset=True) for item in body.items],
            updated_by=int(current_user.id),
        )
        return SchedulingOperationBackfillResponse(**raw)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e


@router.post(
    "/auto-reschedule",
    response_model=SchedulingAutoRescheduleResponse,
    summary="Auto-reschedule dry-run proposal",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def auto_reschedule(
    body: SchedulingAutoRescheduleRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> SchedulingAutoRescheduleResponse:
    plan_date = None
    if body.plan_date:
        plan_date = date.fromisoformat(str(body.plan_date))
    engine = get_scheduling_engine("greedy")
    raw = await engine.plan(
        SchedulingPlanRequest(
            tenant_id=tenant_id,
            work_order_ids=body.work_order_ids,
            scope=body.scope,
            plan_date=plan_date,
            updated_by=int(current_user.id),
        )
    )
    return SchedulingAutoRescheduleResponse(proposal=raw)
