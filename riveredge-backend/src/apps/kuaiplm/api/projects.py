"""
研发项目 API

Author: RiverEdge Team
Date: 2026-05-28
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger

from apps.kuaiplm.schemas.rd_project import (
    PushTrialWorkOrderRequest,
    PushTrialWorkOrderResponse,
    RdProjectCreate,
    RdProjectDeliverableCreate,
    RdProjectDeliverableResponse,
    RdProjectDeliverableUpdate,
    RdProjectGateResponse,
    RdProjectGateUpdate,
    RdProjectLinkCreate,
    RdProjectLinkResponse,
    RdProjectResponse,
    RdProjectTaskCreate,
    RdProjectTaskResponse,
    RdProjectTaskUpdate,
    RdProjectUpdate,
    RdProjectWorkbenchResponse,
)
from apps.kuaiplm.services.rd_project_service import RdProjectService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/rd-projects", tags=["App - Kuaiplm - RD Projects"])
service = RdProjectService()


def _err(status_code: int, message: str, route: str, tenant_id: Optional[int] = None) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaiplm_projects_api_error trace_id={} route={} message={}", trace_id, route, message)
    return HTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


@router.get("", summary="List projects")
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    project_type: Optional[str] = Query(None, description="RD | DELIVERY"),
    project_code: Optional[str] = Query(None),
    project_name: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None, description="asc | desc"),
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    _auth=Depends(require_access("kuaiplm.project", "read", required_permissions=["kuaiplm:project:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await service.list_projects(
        tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        keyword=keyword,
        project_type=project_type,
        project_code=project_code,
        project_name=project_name,
        sort_field=sort_field,
        sort_order=sort_order,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
    )
    return {"data": rows, "total": total, "success": True}


@router.post("", response_model=RdProjectResponse, status_code=status.HTTP_201_CREATED, summary="Create project")
async def create_project(
    data: RdProjectCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "create", required_permissions=["kuaiplm:project:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_project(tenant_id, data, current_user.id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})


@router.get("/{project_id}", response_model=RdProjectResponse, summary="Get RD project")
async def get_project(
    project_id: int = Path(...),
    _auth=Depends(require_access("kuaiplm.project", "read", required_permissions=["kuaiplm:project:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_project(tenant_id, project_id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}", tenant_id)


@router.get("/{project_id}/workbench", response_model=RdProjectWorkbenchResponse, summary="Get project workbench")
async def get_workbench(
    project_id: int = Path(...),
    _auth=Depends(require_access("kuaiplm.project", "read", required_permissions=["kuaiplm:project:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_workbench(tenant_id, project_id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/workbench", tenant_id)


@router.put("/{project_id}", response_model=RdProjectResponse, summary="Update RD project")
async def update_project(
    data: RdProjectUpdate,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_project(tenant_id, project_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}", tenant_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete RD project")
async def delete_project(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "delete", required_permissions=["kuaiplm:project:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_project(tenant_id, project_id, current_user.id)
    except (NotFoundError, BusinessLogicError) as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}", tenant_id)


@router.put("/{project_id}/gates/{gate_id}", response_model=RdProjectGateResponse, summary="Update gate")
async def update_gate(
    data: RdProjectGateUpdate,
    project_id: int = Path(...),
    gate_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_gate(tenant_id, project_id, gate_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/gates/{gate_id}", tenant_id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})


@router.post("/{project_id}/tasks", response_model=RdProjectTaskResponse, summary="Create task")
async def create_task(
    data: RdProjectTaskCreate,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "create", required_permissions=["kuaiplm:project:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_task(tenant_id, project_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/tasks", tenant_id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": str(e)})


@router.put("/{project_id}/tasks/{task_id}", response_model=RdProjectTaskResponse, summary="Update task")
async def update_task(
    data: RdProjectTaskUpdate,
    project_id: int = Path(...),
    task_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_task(tenant_id, project_id, task_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/tasks/{task_id}", tenant_id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": str(e)})


@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete task")
async def delete_task(
    project_id: int = Path(...),
    task_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "delete", required_permissions=["kuaiplm:project:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_task(tenant_id, project_id, task_id, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/tasks/{task_id}", tenant_id)


@router.post("/{project_id}/deliverables", response_model=RdProjectDeliverableResponse, summary="Create deliverable")
async def create_deliverable(
    data: RdProjectDeliverableCreate,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "create", required_permissions=["kuaiplm:project:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_deliverable(tenant_id, project_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/deliverables", tenant_id)


@router.put(
    "/{project_id}/deliverables/{deliverable_id}",
    response_model=RdProjectDeliverableResponse,
    summary="Update deliverable",
)
async def update_deliverable(
    data: RdProjectDeliverableUpdate,
    project_id: int = Path(...),
    deliverable_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_deliverable(tenant_id, project_id, deliverable_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}", tenant_id)


@router.delete(
    "/{project_id}/deliverables/{deliverable_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete deliverable",
)
async def delete_deliverable(
    project_id: int = Path(...),
    deliverable_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "delete", required_permissions=["kuaiplm:project:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_deliverable(tenant_id, project_id, deliverable_id, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}", tenant_id)


@router.post("/{project_id}/links", response_model=RdProjectLinkResponse, summary="Create project link")
async def create_link(
    data: RdProjectLinkCreate,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "create", required_permissions=["kuaiplm:project:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_link(tenant_id, project_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/links", tenant_id)


@router.delete("/{project_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete link")
async def delete_link(
    project_id: int = Path(...),
    link_id: int = Path(...),
    _auth=Depends(require_access("kuaiplm.project", "delete", required_permissions=["kuaiplm:project:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_link(tenant_id, project_id, link_id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/links/{link_id}", tenant_id)


@router.post(
    "/{project_id}/push-trial-work-order",
    response_model=PushTrialWorkOrderResponse,
    summary="Push trial work order to kuaizhizao",
)
async def push_trial_work_order(
    data: PushTrialWorkOrderRequest,
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "create", required_permissions=["kuaiplm:project:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.push_trial_work_order(tenant_id, project_id, data, current_user.id)
    except (NotFoundError, BusinessLogicError) as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/push-trial-work-order", tenant_id)
