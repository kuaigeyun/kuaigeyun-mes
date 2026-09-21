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
    SpawnDeliveryProjectResponse,
    RdProjectCreate,
    RdProjectDeliverableCreate,
    RdProjectDeliverableRejectRequest,
    RdProjectDeliverableResponse,
    RdProjectDeliverableReviseRequest,
    RdProjectDeliverableUpdate,
    RdProjectDeliverableVersionListResponse,
    RdProjectGateResponse,
    RdProjectGateUpdate,
    RdProjectLinkCreate,
    RdProjectLinkResponse,
    RdProjectResponse,
    RdProjectSystemArchiveAcceptRequest,
    RdProjectSystemArchiveItemResponse,
    RdProjectSystemArchiveLinkRequest,
    RdProjectSystemArchiveListResponse,
    RdProjectSystemArchiveMissingRequest,
    RdProjectSystemArchiveRejectRequest,
    RdProjectSystemArchiveUploadRequest,
    RdProjectTaskCreate,
    RdProjectTaskResponse,
    RdProjectTaskUpdate,
    RdProjectUpdate,
    RdProjectWorkbenchResponse,
)
from apps.kuaiplm.services.rd_project_service import RdProjectService
from apps.kuaiplm.services.rd_project_system_archive_service import RdProjectSystemArchiveService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from core.services.authorization.user_permission_service import UserPermissionService
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User
router = APIRouter(prefix="/rd-projects", tags=["App - Kuaiplm - RD Projects"])
service = RdProjectService()
archive_service = RdProjectSystemArchiveService()


def _err(status_code: int, message: str, route: str, tenant_id: Optional[int] = None) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaiplm_projects_api_error trace_id={} route={} message={}", trace_id, route, message)
    return HTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


async def _permission_codes(user: User, tenant_id: int) -> list[str]:
    return sorted(
        await UserPermissionService.get_user_permissions(
            user_id=user.id,
            tenant_id=tenant_id,
        )
    )


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


@router.post("/{project_id}/withdraw", response_model=RdProjectResponse, summary="Withdraw RD project to draft")
async def withdraw_project(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.withdraw_project(tenant_id, project_id, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/withdraw", tenant_id)
    except BusinessLogicError as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/withdraw", tenant_id)


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
        codes = await _permission_codes(current_user, tenant_id)
        return await service.create_deliverable(
            tenant_id, project_id, data, current_user.id, permission_codes=codes
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/deliverables", tenant_id)
    except BusinessLogicError as e:
        raise _err(422, str(e), f"/rd-projects/{project_id}/deliverables", tenant_id)


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
        codes = await _permission_codes(current_user, tenant_id)
        return await service.update_deliverable(
            tenant_id,
            project_id,
            deliverable_id,
            data,
            current_user.id,
            permission_codes=codes,
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}", tenant_id)
    except BusinessLogicError as e:
        raise _err(422, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}", tenant_id)


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


@router.get(
    "/{project_id}/deliverables/{deliverable_id}/versions",
    response_model=RdProjectDeliverableVersionListResponse,
    summary="List deliverable versions (INF-05 filtered)",
)
async def list_deliverable_versions(
    project_id: int = Path(...),
    deliverable_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "read", required_permissions=["kuaiplm:project:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        permission_codes = sorted(
            await UserPermissionService.get_user_permissions(
                user_id=current_user.id,
                tenant_id=tenant_id,
            )
        )
        return await service.list_deliverable_versions(
            tenant_id,
            project_id,
            deliverable_id,
            current_user_id=current_user.id,
            permission_codes=permission_codes,
        )
    except NotFoundError as e:
        raise _err(
            404,
            str(e),
            f"/rd-projects/{project_id}/deliverables/{deliverable_id}/versions",
            tenant_id,
        )


@router.post(
    "/{project_id}/deliverables/{deliverable_id}/revise",
    response_model=RdProjectDeliverableResponse,
    summary="Revise approved deliverable to new draft version",
)
async def revise_deliverable(
    data: RdProjectDeliverableReviseRequest,
    project_id: int = Path(...),
    deliverable_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.revise_deliverable(
            tenant_id,
            project_id,
            deliverable_id,
            data,
            actor_id=current_user.id,
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}/revise", tenant_id)
    except BusinessLogicError as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}/revise", tenant_id)


@router.post(
    "/{project_id}/deliverables/{deliverable_id}/submit",
    response_model=RdProjectDeliverableResponse,
    summary="Submit deliverable for approval",
)
async def submit_deliverable(
    project_id: int = Path(...),
    deliverable_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.project",
            "submit",
            required_permissions=["kuaiplm:project:submit"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit_deliverable(
            tenant_id, project_id, deliverable_id, current_user
        )
    except NotFoundError as e:
        raise _err(
            404, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}/submit", tenant_id
        )
    except (BusinessLogicError, ValidationError) as e:
        raise _err(
            400, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}/submit", tenant_id
        )


@router.post(
    "/{project_id}/deliverables/{deliverable_id}/approve",
    response_model=RdProjectDeliverableResponse,
    summary="Approve submitted deliverable",
)
async def approve_deliverable(
    project_id: int = Path(...),
    deliverable_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(
        require_access(
            "kuaiplm.project",
            "approve",
            required_permissions=["kuaiplm:project:approve"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve_deliverable(
            tenant_id, project_id, deliverable_id, current_user
        )
    except NotFoundError as e:
        raise _err(
            404,
            str(e),
            f"/rd-projects/{project_id}/deliverables/{deliverable_id}/approve",
            tenant_id,
        )
    except BusinessLogicError as e:
        raise _err(
            400,
            str(e),
            f"/rd-projects/{project_id}/deliverables/{deliverable_id}/approve",
            tenant_id,
        )


@router.post(
    "/{project_id}/deliverables/{deliverable_id}/reject",
    response_model=RdProjectDeliverableResponse,
    summary="Reject pending deliverable revision",
)
async def reject_deliverable(
    data: RdProjectDeliverableRejectRequest,
    project_id: int = Path(...),
    deliverable_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject_deliverable(
            tenant_id,
            project_id,
            deliverable_id,
            data,
            actor_id=current_user.id,
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}/reject", tenant_id)
    except BusinessLogicError as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/deliverables/{deliverable_id}/reject", tenant_id)


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


@router.post(
    "/{project_id}/spawn-delivery-project",
    response_model=SpawnDeliveryProjectResponse,
    summary="Spawn delivery project in kuaizhizao",
)
async def spawn_delivery_project(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "create", required_permissions=["kuaiplm:project:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.spawn_delivery_project(tenant_id, project_id, current_user)
    except (NotFoundError, BusinessLogicError) as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/spawn-delivery-project", tenant_id)


@router.get(
    "/{project_id}/system-archive",
    response_model=RdProjectSystemArchiveListResponse,
    summary="List project system archive checklist (R-01 #70)",
)
async def list_system_archive(
    project_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "read", required_permissions=["kuaiplm:project:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    del current_user
    return RdProjectSystemArchiveListResponse.model_validate(
        await archive_service.list_for_project(tenant_id, project_id)
    )


@router.post(
    "/{project_id}/system-archive/{item_id}/upload",
    response_model=RdProjectSystemArchiveItemResponse,
    summary="Upload file for system archive item",
)
async def upload_system_archive(
    data: RdProjectSystemArchiveUploadRequest,
    project_id: int = Path(...),
    item_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        actor_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
        return RdProjectSystemArchiveItemResponse.model_validate(
            await archive_service.upload_file(
                tenant_id,
                project_id,
                item_id,
                file_uuid=data.file_uuid,
                file_name=data.file_name,
                file_url=data.file_url,
                actor_id=current_user.id,
                actor_name=actor_name,
                notes=data.notes,
            )
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/upload", tenant_id)
    except BusinessLogicError as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/upload", tenant_id)


@router.post(
    "/{project_id}/system-archive/{item_id}/link",
    response_model=RdProjectSystemArchiveItemResponse,
    summary="Link existing document for system archive item",
)
async def link_system_archive(
    data: RdProjectSystemArchiveLinkRequest,
    project_id: int = Path(...),
    item_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        actor_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
        return RdProjectSystemArchiveItemResponse.model_validate(
            await archive_service.link_target(
                tenant_id,
                project_id,
                item_id,
                linked_target_type=data.linked_target_type,
                linked_target_id=data.linked_target_id,
                linked_target_uuid=data.linked_target_uuid,
                linked_target_code=data.linked_target_code,
                linked_target_name=data.linked_target_name,
                actor_id=current_user.id,
                actor_name=actor_name,
                notes=data.notes,
            )
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/link", tenant_id)
    except BusinessLogicError as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/link", tenant_id)


@router.post(
    "/{project_id}/system-archive/{item_id}/mark-missing",
    response_model=RdProjectSystemArchiveItemResponse,
    summary="Mark system archive item as pending supplement",
)
async def mark_system_archive_missing(
    data: RdProjectSystemArchiveMissingRequest,
    project_id: int = Path(...),
    item_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        actor_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
        return RdProjectSystemArchiveItemResponse.model_validate(
            await archive_service.mark_missing(
                tenant_id,
                project_id,
                item_id,
                missing_notes=data.missing_notes,
                actor_id=current_user.id,
                actor_name=actor_name,
            )
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/mark-missing", tenant_id)
    except BusinessLogicError as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/mark-missing", tenant_id)


@router.post(
    "/{project_id}/system-archive/{item_id}/clear",
    response_model=RdProjectSystemArchiveItemResponse,
    summary="Clear system archive item content",
)
async def clear_system_archive(
    project_id: int = Path(...),
    item_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        actor_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
        return RdProjectSystemArchiveItemResponse.model_validate(
            await archive_service.clear_content(
                tenant_id,
                project_id,
                item_id,
                actor_id=current_user.id,
                actor_name=actor_name,
            )
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/clear", tenant_id)


@router.post(
    "/{project_id}/system-archive/{item_id}/accept",
    response_model=RdProjectSystemArchiveItemResponse,
    summary="Accept system archive item",
)
async def accept_system_archive(
    data: RdProjectSystemArchiveAcceptRequest,
    project_id: int = Path(...),
    item_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        actor_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
        return RdProjectSystemArchiveItemResponse.model_validate(
            await archive_service.accept_item(
                tenant_id,
                project_id,
                item_id,
                acceptance_notes=data.acceptance_notes,
                actor_id=current_user.id,
                actor_name=actor_name,
            )
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/accept", tenant_id)
    except BusinessLogicError as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/accept", tenant_id)


@router.post(
    "/{project_id}/system-archive/{item_id}/reject",
    response_model=RdProjectSystemArchiveItemResponse,
    summary="Reject system archive item acceptance",
)
async def reject_system_archive(
    data: RdProjectSystemArchiveRejectRequest,
    project_id: int = Path(...),
    item_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.project", "update", required_permissions=["kuaiplm:project:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        actor_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
        return RdProjectSystemArchiveItemResponse.model_validate(
            await archive_service.reject_item(
                tenant_id,
                project_id,
                item_id,
                acceptance_notes=data.acceptance_notes,
                actor_id=current_user.id,
                actor_name=actor_name,
            )
        )
    except NotFoundError as e:
        raise _err(404, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/reject", tenant_id)
    except BusinessLogicError as e:
        raise _err(400, str(e), f"/rd-projects/{project_id}/system-archive/{item_id}/reject", tenant_id)
