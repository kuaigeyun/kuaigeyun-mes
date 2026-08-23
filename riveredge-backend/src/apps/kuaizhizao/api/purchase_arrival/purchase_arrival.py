"""采购到货预警与延期填报 API"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Path, Query

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.purchase_arrival import (
    ApproveDelayReportRequest,
    PurchaseArrivalDelayReportCreate,
    PurchaseArrivalDelayReportListResponse,
    PurchaseArrivalDelayReportResponse,
    PurchaseArrivalDelayReportUpdate,
    PurchaseArrivalWarningListResponse,
)
from apps.kuaizhizao.services.purchase_arrival_delay_service import PurchaseArrivalDelayService
from apps.kuaizhizao.services.purchase_arrival_warning_service import PurchaseArrivalWarningService
from core.api.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/purchase-arrival", tags=["App - Kuaige Zhizao - Purchase Arrival"])
warning_service = PurchaseArrivalWarningService()
delay_service = PurchaseArrivalDelayService()


@router.get("/warnings", response_model=PurchaseArrivalWarningListResponse)
async def list_arrival_warnings(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    warning_level: Optional[str] = Query(None, description="normal/imminent/overdue"),
    supplier_id: Optional[int] = Query(None),
    supplier_keyword: Optional[str] = Query(None),
    order_code: Optional[str] = Query(None),
    material_keyword: Optional[str] = Query(None),
    processing_status: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_kuaizhizao_module_access("purchase-arrival-warning")),
):
    return await warning_service.list_warnings(
        tenant_id,
        skip=skip,
        limit=limit,
        warning_level=warning_level,
        supplier_id=supplier_id,
        supplier_keyword=supplier_keyword,
        order_code=order_code,
        material_keyword=material_keyword,
        processing_status=processing_status,
        current_user=current_user,
    )


@router.get("/delay-reports", response_model=PurchaseArrivalDelayReportListResponse)
async def list_delay_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    purchase_order_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-arrival-delay")),
):
    return await delay_service.list_reports(
        tenant_id, skip=skip, limit=limit, purchase_order_id=purchase_order_id, status=status
    )


@router.post("/delay-reports", response_model=PurchaseArrivalDelayReportResponse)
async def create_delay_report(
    data: PurchaseArrivalDelayReportCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_kuaizhizao_module_access("purchase-arrival-delay")),
):
    return await delay_service.create_report(tenant_id, data, current_user.id)


@router.get("/delay-reports/{report_id}", response_model=PurchaseArrivalDelayReportResponse)
async def get_delay_report(
    report_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_kuaizhizao_module_access("purchase-arrival-delay")),
):
    return await delay_service.get_by_id(tenant_id, report_id)


@router.put("/delay-reports/{report_id}", response_model=PurchaseArrivalDelayReportResponse)
async def update_delay_report(
    report_id: int,
    data: PurchaseArrivalDelayReportUpdate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_kuaizhizao_module_access("purchase-arrival-delay")),
):
    return await delay_service.update_report(tenant_id, report_id, data, current_user.id)


@router.post("/delay-reports/{report_id}/submit", response_model=PurchaseArrivalDelayReportResponse)
async def submit_delay_report(
    report_id: int,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_kuaizhizao_module_access("purchase-arrival-delay")),
):
    return await delay_service.submit(tenant_id, report_id, current_user.id)


@router.post("/delay-reports/{report_id}/approve", response_model=PurchaseArrivalDelayReportResponse)
async def approve_delay_report(
    report_id: int,
    body: ApproveDelayReportRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_kuaizhizao_module_access("purchase-arrival-delay")),
):
    return await delay_service.approve(tenant_id, report_id, body, current_user.id)
