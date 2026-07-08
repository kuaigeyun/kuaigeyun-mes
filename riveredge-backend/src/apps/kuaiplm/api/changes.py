"""
变更工作台 API

Author: RiverEdge Team
Date: 2026-05-28
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger

from apps.kuaiplm.schemas.change_desk import (
    ChangeApproveRequest,
    ChangeBatchActionResponse,
    ChangeBatchApproveRequest,
    ChangeBatchDeleteRequest,
    ChangeBatchExecuteRequest,
    ChangeDeskListResponse,
    ChangeExecuteRequest,
    ChangeSubmitRequest,
)
from apps.kuaiplm.services.change_desk_service import ChangeDeskService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(prefix="/changes", tags=["App · Kuaiplm · Change Desk"])
service = ChangeDeskService()


def _err(status_code: int, message: str, route: str) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaiplm_changes_api_error trace_id={} route={} message={}", trace_id, route, message)
    return HTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


@router.get("", response_model=ChangeDeskListResponse, summary="List BOM and route changes")
async def list_changes(
    status: Optional[str] = Query(None),
    change_type: Optional[str] = Query(None, description="bom | process_route"),
    keyword: Optional[str] = Query(None),
    change_code: Optional[str] = Query(None),
    target_name: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _auth=Depends(require_access("kuaiplm.change", "read", required_permissions=["kuaiplm:change:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_changes(
        tenant_id,
        status=status,
        change_type=change_type,
        keyword=keyword,
        change_code=change_code,
        target_name=target_name,
        page=page,
        page_size=page_size,
    )


@router.post("/{change_uuid}/submit", summary="Submit change for approval")
async def submit_change(
    data: ChangeSubmitRequest,
    change_uuid: str = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.change", "submit", required_permissions=["kuaiplm:change:submit"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        result = await service.submit_change(tenant_id, change_uuid, data, current_user.id)
        return {"success": True, "data": result}
    except (ValueError, ValidationError) as e:
        raise _err(400, str(e), f"/changes/{change_uuid}/submit")


@router.post("/{change_uuid}/approve", summary="Approve or reject change")
async def approve_change(
    data: ChangeApproveRequest,
    change_uuid: str = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.change", "approve", required_permissions=["kuaiplm:change:approve"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        result = await service.approve_change(tenant_id, change_uuid, data, current_user.id)
        return {"success": True, "data": result}
    except ValueError as e:
        raise _err(400, str(e), f"/changes/{change_uuid}/approve")


@router.post("/{change_uuid}/execute", summary="Execute approved change")
async def execute_change(
    data: ChangeExecuteRequest,
    change_uuid: str = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.change", "update", required_permissions=["kuaiplm:change:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        result = await service.execute_change(tenant_id, change_uuid, data, current_user.id)
        return {"success": True, "data": result}
    except ValueError as e:
        raise _err(400, str(e), f"/changes/{change_uuid}/execute")


@router.delete("/{change_uuid}", summary="Delete change")
async def delete_change(
    change_uuid: str = Path(...),
    change_type: str = Query(..., description="bom | process_route"),
    _auth=Depends(require_access("kuaiplm.change", "update", required_permissions=["kuaiplm:change:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_change(tenant_id, change_uuid, change_type)
        return {"success": True}
    except ValueError as e:
        raise _err(400, str(e), f"/changes/{change_uuid}")


@router.post("/batch/approve", response_model=ChangeBatchActionResponse, summary="Batch approve changes")
async def batch_approve_changes(
    data: ChangeBatchApproveRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.change", "approve", required_permissions=["kuaiplm:change:approve"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.batch_approve_changes(
        tenant_id=tenant_id,
        items=data.items,
        approved=data.approved,
        approval_comment=data.approval_comment,
        user_id=current_user.id,
    )


@router.post("/batch/execute", response_model=ChangeBatchActionResponse, summary="Batch execute changes")
async def batch_execute_changes(
    data: ChangeBatchExecuteRequest,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.change", "update", required_permissions=["kuaiplm:change:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.batch_execute_changes(
        tenant_id=tenant_id,
        items=data.items,
        user_id=current_user.id,
    )


@router.post("/batch/delete", response_model=ChangeBatchActionResponse, summary="Batch delete changes")
async def batch_delete_changes(
    data: ChangeBatchDeleteRequest,
    _auth=Depends(require_access("kuaiplm.change", "update", required_permissions=["kuaiplm:change:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.batch_delete_changes(
        tenant_id=tenant_id,
        items=data.items,
    )
