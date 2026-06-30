"""
工装运营报表 API（只读）。
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant

from apps.kuaizhizao.schemas.tool_ops import (
    ToolCalibrationAlertReportResponse,
    ToolCalibrationAlertReportItem,
    ToolMaintenanceAlertReportResponse,
    ToolMaintenanceAlertReportItem,
    ToolBorrowReturnLogReportResponse,
    ToolBorrowReturnLogItem,
    ToolRepairAnalysisReportResponse,
    ToolRepairAnalysisItem,
)
from apps.kuaizhizao.services.tool_ops_service import ToolOpsService

router = APIRouter()
svc = ToolOpsService()


@router.get(
    "/reports/tool-calibration-alerts",
    response_model=ToolCalibrationAlertReportResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-report-calibration-alerts:read"))],
)
async def report_tool_calibration_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    reminder_type: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await svc.report_service.calibration_alerts(
        tenant_id, skip, limit, reminder_type
    )
    return ToolCalibrationAlertReportResponse(
        items=[ToolCalibrationAlertReportItem.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/reports/tool-maintenance-alerts",
    response_model=ToolMaintenanceAlertReportResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-report-maintenance-alerts:read"))],
)
async def report_tool_maintenance_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    reminder_type: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await svc.report_service.maintenance_alerts(
        tenant_id, skip, limit, reminder_type
    )
    return ToolMaintenanceAlertReportResponse(
        items=[ToolMaintenanceAlertReportItem.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/reports/tool-borrow-return-log",
    response_model=ToolBorrowReturnLogReportResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-report-borrow-return-log:read"))],
)
async def report_tool_borrow_return_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tool_id: Optional[int] = Query(None, ge=1),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await svc.report_service.borrow_return_log(
        tenant_id, skip, limit, tool_id, date_from, date_to
    )
    return ToolBorrowReturnLogReportResponse(
        items=[ToolBorrowReturnLogItem.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/reports/tool-repair-analysis",
    response_model=ToolRepairAnalysisReportResponse,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-report-repair-analysis:read"))],
)
async def report_tool_repair_analysis(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await svc.report_service.repair_analysis(
        tenant_id, skip, limit, date_from, date_to
    )
    return ToolRepairAnalysisReportResponse(
        items=[ToolRepairAnalysisItem.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit,
    )
