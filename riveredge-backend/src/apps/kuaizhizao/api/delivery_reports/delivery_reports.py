"""交付项目报表 API"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.delivery_project import (
    DeliveryProgressSummaryEnvelope,
    DeliveryProcessProgressEnvelope,
    DeliveryIssueProgressEnvelope,
)
from apps.kuaizhizao.services.delivery_project_service import DeliveryProjectService
from core.api.deps import get_current_tenant

router = APIRouter(
    prefix="/delivery-reports",
    tags=["App - Kuaige Zhizao - Delivery Reports"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-report"))],
)

_service = DeliveryProjectService()


@router.get(
    "/progress-summary",
    response_model=DeliveryProgressSummaryEnvelope,
    summary="Delivery project progress summary report",
)
async def progress_summary_report(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_progress_summary(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        status=status,
        customer_id=customer_id,
    )


@router.get(
    "/process-progress",
    response_model=DeliveryProcessProgressEnvelope,
    summary="Delivery project process progress report",
)
async def process_progress_report(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_process_progress(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        status=status,
        project_id=project_id,
    )


@router.get(
    "/issue-progress",
    response_model=DeliveryIssueProgressEnvelope,
    summary="Delivery project issue progress report",
)
async def issue_progress_report(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_issue_progress(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        status=status,
        project_id=project_id,
    )
