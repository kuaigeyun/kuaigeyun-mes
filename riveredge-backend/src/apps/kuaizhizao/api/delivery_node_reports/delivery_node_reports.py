"""交付节点汇报 API"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.delivery_project import (
    DeliveryNodeReportCreate,
    DeliveryNodeReportListEnvelope,
    DeliveryNodeReportResponse,
    DeliveryNodeReportReviewRequest,
    DeliveryNodeReportUpdate,
)
from apps.kuaizhizao.services.delivery_node_report_service import (
    DELIVERY_NODE_REPORT_SORTABLE_FIELDS,
    DeliveryNodeReportService,
)
from core.api.deps import get_current_user, get_current_tenant
from core.api.deps.access import require_permission_codes
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/delivery-node-reports",
    tags=["App - Kuaige Zhizao - Delivery Node Reports"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-node-report"))],
)

_service = DeliveryNodeReportService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": uuid.uuid4().hex},
    )


@router.post("", response_model=DeliveryNodeReportResponse, summary="Create node report")
async def create_report(
    body: DeliveryNodeReportCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create_report(tenant_id, body, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("", response_model=DeliveryNodeReportListEnvelope, summary="List node reports")
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    project_id: Optional[int] = Query(None),
    node_id: Optional[int] = Query(None),
    node_key: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in DELIVERY_NODE_REPORT_SORTABLE_FIELDS:
            safe_order_by = order_by
    return await _service.list_reports(
        tenant_id,
        skip=skip,
        limit=limit,
        project_id=project_id,
        node_id=node_id,
        node_key=node_key,
        status=status,
        order_by=safe_order_by,
    )


@router.get("/{report_id:int}", response_model=DeliveryNodeReportResponse, summary="Get node report")
async def get_report(
    report_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get_report(tenant_id, report_id)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.put("/{report_id:int}", response_model=DeliveryNodeReportResponse, summary="Update node report")
async def update_report(
    body: DeliveryNodeReportUpdate,
    report_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update_report(tenant_id, report_id, body, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{report_id:int}/submit", response_model=DeliveryNodeReportResponse, summary="Submit node report")
async def submit_report(
    report_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.submit_report(tenant_id, report_id, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post(
    "/{report_id:int}/review",
    response_model=DeliveryNodeReportResponse,
    summary="Review node report",
    dependencies=[Depends(require_permission_codes("kuaizhizao:delivery-node-report:approve"))],
)
async def review_report(
    body: DeliveryNodeReportReviewRequest,
    report_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.review_report(tenant_id, report_id, body, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.delete("/{report_id:int}", summary="Delete node report")
async def delete_report(
    report_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete_report(tenant_id, report_id, current_user)
        return {"success": True}
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))
