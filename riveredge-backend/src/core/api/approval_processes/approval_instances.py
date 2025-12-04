"""
审批实例管理 API 路由

提供审批实例的 CRUD 操作和审批操作功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.approval_instance import (
    ApprovalInstanceCreate,
    ApprovalInstanceUpdate,
    ApprovalInstanceAction,
    ApprovalInstanceResponse,
)
from core.services.approval_instance_service import ApprovalInstanceService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/approval-instances", tags=["ApprovalInstances"])


@router.post("", response_model=ApprovalInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_instance(
    data: ApprovalInstanceCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建审批实例（提交审批）
    
    创建新的审批实例并自动触发 Inngest 工作流。
    
    Args:
        data: 审批实例创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalInstanceResponse: 创建的审批实例对象
        
    Raises:
        HTTPException: 当流程不存在或未启用时抛出
    """
    try:
        approval_instance = await ApprovalInstanceService.create_approval_instance(
            tenant_id=tenant_id,
            user_id=current_user.id,
            data=data
        )
        return ApprovalInstanceResponse.model_validate(approval_instance)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[ApprovalInstanceResponse])
async def list_approval_instances(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="审批状态（可选）"),
    submitter_id: Optional[int] = Query(None, description="提交人ID（可选）"),
    current_approver_id: Optional[int] = Query(None, description="当前审批人ID（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审批实例列表
    
    获取当前组织的审批实例列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        status: 审批状态（可选）
        submitter_id: 提交人ID（可选）
        current_approver_id: 当前审批人ID（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[ApprovalInstanceResponse]: 审批实例列表
    """
    approval_instances = await ApprovalInstanceService.list_approval_instances(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        submitter_id=submitter_id,
        current_approver_id=current_approver_id
    )
    return [ApprovalInstanceResponse.model_validate(ai) for ai in approval_instances]


@router.get("/{uuid}", response_model=ApprovalInstanceResponse)
async def get_approval_instance(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审批实例详情
    
    根据UUID获取审批实例详情。
    
    Args:
        uuid: 审批实例UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalInstanceResponse: 审批实例对象
        
    Raises:
        HTTPException: 当审批实例不存在时抛出
    """
    try:
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return ApprovalInstanceResponse.model_validate(approval_instance)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=ApprovalInstanceResponse)
async def update_approval_instance(
    uuid: str,
    data: ApprovalInstanceUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新审批实例
    
    更新审批实例信息。
    
    Args:
        uuid: 审批实例UUID
        data: 审批实例更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalInstanceResponse: 更新后的审批实例对象
        
    Raises:
        HTTPException: 当审批实例不存在时抛出
    """
    try:
        approval_instance = await ApprovalInstanceService.update_approval_instance(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ApprovalInstanceResponse.model_validate(approval_instance)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_approval_instance(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除审批实例
    
    软删除审批实例。
    
    Args:
        uuid: 审批实例UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当审批实例不存在时抛出
    """
    try:
        await ApprovalInstanceService.delete_approval_instance(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/action", response_model=ApprovalInstanceResponse)
async def perform_approval_action(
    uuid: str,
    action: ApprovalInstanceAction,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    执行审批操作
    
    执行审批操作（同意、拒绝、取消、转交）。
    
    Args:
        uuid: 审批实例UUID
        action: 审批操作
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalInstanceResponse: 更新后的审批实例对象
        
    Raises:
        HTTPException: 当审批实例不存在或操作不合法时抛出
    """
    try:
        approval_instance = await ApprovalInstanceService.perform_approval_action(
            tenant_id=tenant_id,
            uuid=uuid,
            user_id=current_user.id,
            action=action
        )
        return ApprovalInstanceResponse.model_validate(approval_instance)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

