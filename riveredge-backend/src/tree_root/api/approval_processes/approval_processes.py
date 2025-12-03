"""
审批流程管理 API 路由

提供审批流程的 CRUD 操作。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from tree_root.schemas.approval_process import (
    ApprovalProcessCreate,
    ApprovalProcessUpdate,
    ApprovalProcessResponse,
)
from tree_root.services.approval_process_service import ApprovalProcessService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user as soil_get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/approval-processes", tags=["ApprovalProcesses"])


@router.post("", response_model=ApprovalProcessResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_process(
    data: ApprovalProcessCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建审批流程
    
    创建新的审批流程并自动注册到 Inngest（如果启用）。
    
    Args:
        data: 审批流程创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalProcessResponse: 创建的审批流程对象
        
    Raises:
        HTTPException: 当流程代码已存在时抛出
    """
    try:
        approval_process = await ApprovalProcessService.create_approval_process(
            tenant_id=tenant_id,
            data=data
        )
        return ApprovalProcessResponse.model_validate(approval_process)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[ApprovalProcessResponse])
async def list_approval_processes(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审批流程列表
    
    获取当前组织的审批流程列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[ApprovalProcessResponse]: 审批流程列表
    """
    approval_processes = await ApprovalProcessService.list_approval_processes(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active
    )
    return [ApprovalProcessResponse.model_validate(ap) for ap in approval_processes]


@router.get("/{uuid}", response_model=ApprovalProcessResponse)
async def get_approval_process(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审批流程详情
    
    根据UUID获取审批流程详情。
    
    Args:
        uuid: 审批流程UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalProcessResponse: 审批流程对象
        
    Raises:
        HTTPException: 当审批流程不存在时抛出
    """
    try:
        approval_process = await ApprovalProcessService.get_approval_process_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return ApprovalProcessResponse.model_validate(approval_process)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=ApprovalProcessResponse)
async def update_approval_process(
    uuid: str,
    data: ApprovalProcessUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新审批流程
    
    更新审批流程信息，如果节点配置发生变化，会自动重新注册到 Inngest。
    
    Args:
        uuid: 审批流程UUID
        data: 审批流程更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalProcessResponse: 更新后的审批流程对象
        
    Raises:
        HTTPException: 当审批流程不存在时抛出
    """
    try:
        approval_process = await ApprovalProcessService.update_approval_process(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ApprovalProcessResponse.model_validate(approval_process)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approval_process(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除审批流程
    
    软删除审批流程，如果已注册到 Inngest，会自动注销。
    
    Args:
        uuid: 审批流程UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当审批流程不存在时抛出
    """
    try:
        await ApprovalProcessService.delete_approval_process(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

