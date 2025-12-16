"""
审批节点 API 模块

提供审批节点的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaioa.services.approval_node_service import ApprovalNodeService
from apps.kuaioa.schemas.approval_node_schemas import (
    ApprovalNodeCreate, ApprovalNodeUpdate, ApprovalNodeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/approval-node", tags=["审批节点"])


@router.post("", response_model=ApprovalNodeResponse, summary="创建审批节点")
async def create_approvalnode(
    data: ApprovalNodeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建审批节点"""
    try:
        return await ApprovalNodeService.create_approvalnode(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ApprovalNodeResponse], summary="获取审批节点列表")
async def list_approvalnodes(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取审批节点列表"""
    return await ApprovalNodeService.list_approvalnodes(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ApprovalNodeResponse, summary="获取审批节点详情")
async def get_approvalnode(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取审批节点详情"""
    try:
        return await ApprovalNodeService.get_approvalnode_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ApprovalNodeResponse, summary="更新审批节点")
async def update_approvalnode(
    obj_uuid: str,
    data: ApprovalNodeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新审批节点"""
    try:
        return await ApprovalNodeService.update_approvalnode(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除审批节点")
async def delete_approvalnode(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除审批节点（软删除）"""
    try:
        await ApprovalNodeService.delete_approvalnode(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
