"""
模具运营报表 API（只读）。
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant

from apps.kuaizhizao.schemas.mold_ops import (
    MoldTrialRecordReportResponse,
    MoldTrialRecordReportItem,
    MoldMaintenanceAlertReportResponse,
    MoldMaintenanceAlertReportItem,
    MoldBorrowReturnLogReportResponse,
    MoldBorrowReturnLogItem,
    MoldRepairAnalysisReportResponse,
    MoldRepairAnalysisItem,
)
from apps.kuaizhizao.services.mold_ops_service import MoldOpsService

router = APIRouter()
svc = MoldOpsService()


@router.get(
    "/reports/mold-trial-records",
    response_model=MoldTrialRecordReportResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-report-trial-records:read"))],
)
async def report_mold_trial_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await svc.report_service.trial_records(
        tenant_id, skip, limit, mold_id, date_from, date_to
    )
    return MoldTrialRecordReportResponse(
        items=[MoldTrialRecordReportItem.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/reports/mold-maintenance-alerts",
    response_model=MoldMaintenanceAlertReportResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-report-maintenance-alerts:read"))],
)
async def report_mold_maintenance_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    reminder_type: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await svc.report_service.maintenance_alerts(
        tenant_id, skip, limit, reminder_type
    )
    return MoldMaintenanceAlertReportResponse(
        items=[MoldMaintenanceAlertReportItem.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/reports/mold-borrow-return-log",
    response_model=MoldBorrowReturnLogReportResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-report-borrow-return-log:read"))],
)
async def report_mold_borrow_return_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    mold_id: Optional[int] = Query(None, ge=1),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await svc.report_service.borrow_return_log(
        tenant_id, skip, limit, mold_id, date_from, date_to
    )
    return MoldBorrowReturnLogReportResponse(
        items=[MoldBorrowReturnLogItem.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/reports/mold-repair-analysis",
    response_model=MoldRepairAnalysisReportResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-report-repair-analysis:read"))],
)
async def report_mold_repair_analysis(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await svc.report_service.repair_analysis(
        tenant_id, skip, limit, date_from, date_to
    )
    return MoldRepairAnalysisReportResponse(
        items=[MoldRepairAnalysisItem.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )
