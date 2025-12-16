"""
审批流程 API 模块

提供审批流程的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaioa.services.approval_process_service import ApprovalProcessService
from apps.kuaioa.schemas.approval_process_schemas import (
    ApprovalProcessCreate, ApprovalProcessUpdate, ApprovalProcessResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/approval-process", tags=["审批流程"])


@router.post("", response_model=ApprovalProcessResponse, summary="创建审批流程")
async def create_approvalprocess(
    data: ApprovalProcessCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建审批流程"""
    try:
        return await ApprovalProcessService.create_approvalprocess(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ApprovalProcessResponse], summary="获取审批流程列表")
async def list_approvalprocesss(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取审批流程列表"""
    return await ApprovalProcessService.list_approvalprocesss(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ApprovalProcessResponse, summary="获取审批流程详情")
async def get_approvalprocess(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取审批流程详情"""
    try:
        return await ApprovalProcessService.get_approvalprocess_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ApprovalProcessResponse, summary="更新审批流程")
async def update_approvalprocess(
    obj_uuid: str,
    data: ApprovalProcessUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新审批流程"""
    try:
        return await ApprovalProcessService.update_approvalprocess(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除审批流程")
async def delete_approvalprocess(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除审批流程（软删除）"""
    try:
        await ApprovalProcessService.delete_approvalprocess(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
