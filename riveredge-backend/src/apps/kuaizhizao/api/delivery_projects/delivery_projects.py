"""交付项目 API"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.delivery_project import (
    DeliveryProjectChangeTemplateRequest,
    DeliveryProjectCompleteRequest,
    DeliveryProjectCreate,
    DeliveryProjectListEnvelope,
    DeliveryProjectNodeResponse,
    DeliveryProjectNodeTaskCreate,
    DeliveryProjectNodeTaskResponse,
    DeliveryProjectNodeTaskUpdate,
    DeliveryProjectNodeUpdate,
    DeliveryProjectResponse,
    DeliveryProjectUpdate,
    DeliveryProjectWorkbenchResponse,
)
from apps.kuaizhizao.services.delivery_project_service import (
    DELIVERY_PROJECT_SORTABLE_FIELDS,
    DeliveryProjectService,
)
from core.api.deps import get_current_user, get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/delivery-projects",
    tags=["App - Kuaige Zhizao - Delivery Projects"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-project"))],
)

_service = DeliveryProjectService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": uuid.uuid4().hex},
    )


@router.post("", response_model=DeliveryProjectResponse, summary="Create delivery project")
async def create_project(
    body: DeliveryProjectCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create_project(tenant_id, body, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("", response_model=DeliveryProjectListEnvelope, summary="List delivery projects")
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sales_order_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    current_node_key: Optional[str] = Query(None),
    order_by: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in DELIVERY_PROJECT_SORTABLE_FIELDS:
            safe_order_by = order_by
    return await _service.list_projects(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        status=status,
        sales_order_id=sales_order_id,
        customer_id=customer_id,
        current_node_key=current_node_key,
        order_by=safe_order_by,
    )


@router.get("/{project_id:int}/workbench", response_model=DeliveryProjectWorkbenchResponse, summary="Get delivery project workbench")
async def get_project_workbench(
    project_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get_workbench(tenant_id, project_id)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.get("/{project_id:int}", response_model=DeliveryProjectResponse, summary="Get delivery project")
async def get_project(
    project_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get_project(tenant_id, project_id)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.put("/{project_id:int}", response_model=DeliveryProjectResponse, summary="Update delivery project")
async def update_project(
    body: DeliveryProjectUpdate,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update_project(tenant_id, project_id, body, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.delete("/{project_id:int}", summary="Delete delivery project")
async def delete_project(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete_project(tenant_id, project_id, current_user)
        return {"success": True}
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.post("/{project_id:int}/start", response_model=DeliveryProjectResponse, summary="Start delivery project")
async def start_project(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.start_project(tenant_id, project_id, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{project_id:int}/pause", response_model=DeliveryProjectResponse, summary="Pause delivery project")
async def pause_project(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.pause_project(tenant_id, project_id, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{project_id:int}/resume", response_model=DeliveryProjectResponse, summary="Resume delivery project")
async def resume_project(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.resume_project(tenant_id, project_id, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{project_id:int}/cancel", response_model=DeliveryProjectResponse, summary="Cancel delivery project")
async def cancel_project(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.cancel_project(tenant_id, project_id, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post(
    "/{project_id:int}/complete",
    response_model=DeliveryProjectResponse,
    summary="Complete delivery project",
)
async def complete_project(
    body: DeliveryProjectCompleteRequest,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.complete_project(
            tenant_id,
            project_id,
            current_user,
            force=body.force,
            reason=body.reason,
        )
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post(
    "/{project_id:int}/change-template",
    response_model=DeliveryProjectResponse,
    summary="Change delivery project process template",
)
async def change_project_template(
    body: DeliveryProjectChangeTemplateRequest,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.change_template(
            tenant_id, project_id, body.process_template_id, current_user
        )
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.put(
    "/{project_id:int}/nodes/{node_id:int}",
    response_model=DeliveryProjectNodeResponse,
    summary="Update delivery project node",
)
async def update_project_node(
    body: DeliveryProjectNodeUpdate,
    project_id: int = Path(...),
    node_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update_project_node(tenant_id, project_id, node_id, body, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post(
    "/{project_id:int}/node-tasks",
    response_model=DeliveryProjectNodeTaskResponse,
    summary="Create delivery project node task",
)
async def create_node_task(
    body: DeliveryProjectNodeTaskCreate,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create_node_task(tenant_id, project_id, body, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.put(
    "/{project_id:int}/node-tasks/{task_id:int}",
    response_model=DeliveryProjectNodeTaskResponse,
    summary="Update delivery project node task",
)
async def update_node_task(
    body: DeliveryProjectNodeTaskUpdate,
    project_id: int = Path(...),
    task_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update_node_task(tenant_id, project_id, task_id, body, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.delete(
    "/{project_id:int}/node-tasks/{task_id:int}",
    summary="Delete delivery project node task",
)
async def delete_node_task(
    project_id: int = Path(...),
    task_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete_node_task(tenant_id, project_id, task_id, current_user)
        return {"success": True}
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))
