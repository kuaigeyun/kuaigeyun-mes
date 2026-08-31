"""交付项目问题 API"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.delivery_project import (
    DeliveryIssueCreate,
    DeliveryIssueListEnvelope,
    DeliveryIssueResponse,
    DeliveryIssueUpdate,
)
from apps.kuaizhizao.services.delivery_issue_service import DeliveryIssueService
from core.api.deps import get_current_user, get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/delivery-issues",
    tags=["App - Kuaige Zhizao - Delivery Issues"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-issue"))],
)

_service = DeliveryIssueService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": uuid.uuid4().hex},
    )


@router.post("", response_model=DeliveryIssueResponse, summary="Create delivery issue")
async def create_issue(
    body: DeliveryIssueCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create_issue(tenant_id, body, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("", response_model=DeliveryIssueListEnvelope, summary="List delivery issues")
async def list_issues(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_issues(
        tenant_id,
        skip=skip,
        limit=limit,
        project_id=project_id,
        status=status,
        priority=priority,
        keyword=keyword,
    )


@router.get("/{issue_id:int}", response_model=DeliveryIssueResponse, summary="Get delivery issue")
async def get_issue(
    issue_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get_issue(tenant_id, issue_id)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.put("/{issue_id:int}", response_model=DeliveryIssueResponse, summary="Update delivery issue")
async def update_issue(
    body: DeliveryIssueUpdate,
    issue_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update_issue(tenant_id, issue_id, body, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.delete("/{issue_id:int}", summary="Delete delivery issue")
async def delete_issue(
    issue_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete_issue(tenant_id, issue_id, current_user)
        return {"success": True}
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
