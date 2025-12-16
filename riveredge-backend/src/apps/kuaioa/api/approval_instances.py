"""
审批实例 API 模块

提供审批实例的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaioa.services.approval_instance_service import ApprovalInstanceService
from apps.kuaioa.schemas.approval_instance_schemas import (
    ApprovalInstanceCreate, ApprovalInstanceUpdate, ApprovalInstanceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/approval-instance", tags=["审批实例"])


@router.post("", response_model=ApprovalInstanceResponse, summary="创建审批实例")
async def create_approvalinstance(
    data: ApprovalInstanceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建审批实例"""
    try:
        return await ApprovalInstanceService.create_approvalinstance(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ApprovalInstanceResponse], summary="获取审批实例列表")
async def list_approvalinstances(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取审批实例列表"""
    return await ApprovalInstanceService.list_approvalinstances(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ApprovalInstanceResponse, summary="获取审批实例详情")
async def get_approvalinstance(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取审批实例详情"""
    try:
        return await ApprovalInstanceService.get_approvalinstance_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ApprovalInstanceResponse, summary="更新审批实例")
async def update_approvalinstance(
    obj_uuid: str,
    data: ApprovalInstanceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新审批实例"""
    try:
        return await ApprovalInstanceService.update_approvalinstance(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除审批实例")
async def delete_approvalinstance(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除审批实例（软删除）"""
    try:
        await ApprovalInstanceService.delete_approvalinstance(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
