"""
审批历史记录 API 路由

提供审批历史记录的查询功能。
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.approval_history import ApprovalHistoryResponse
from core.services.approval_history_service import ApprovalHistoryService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/approval-histories", tags=["ApprovalHistories"])


@router.get("", response_model=List[ApprovalHistoryResponse])
async def list_approval_histories(
    approval_instance_id: int = Query(..., description="审批实例ID"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审批历史记录列表
    
    获取指定审批实例的历史记录列表，支持分页。
    
    Args:
        approval_instance_id: 审批实例ID（必填）
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[ApprovalHistoryResponse]: 审批历史记录列表
    """
    histories = await ApprovalHistoryService.get_approval_histories(
        tenant_id=tenant_id,
        approval_instance_id=approval_instance_id,
        skip=skip,
        limit=limit
    )
    return histories


@router.get("/{uuid}", response_model=ApprovalHistoryResponse)
async def get_approval_history(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取审批历史记录详情
    
    根据UUID获取审批历史记录详情。
    
    Args:
        uuid: 审批历史记录UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ApprovalHistoryResponse: 审批历史记录对象
        
    Raises:
        HTTPException: 当审批历史记录不存在时抛出
    """
    try:
        history = await ApprovalHistoryService.get_approval_history_by_uuid(
            tenant_id=tenant_id,
            history_uuid=uuid
        )
        return history
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
