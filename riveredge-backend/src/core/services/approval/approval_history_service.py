"""
审批历史记录服务模块

提供审批历史记录的业务逻辑处理。
"""

from typing import List, Optional
from core.models.approval_history import ApprovalHistory
from core.schemas.approval_history import ApprovalHistoryResponse
from infra.exceptions.exceptions import NotFoundError


class ApprovalHistoryService:
    """审批历史记录服务"""
    
    @staticmethod
    async def get_approval_histories(
        tenant_id: int,
        approval_instance_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[ApprovalHistoryResponse]:
        """
        获取审批历史记录列表
        
        Args:
            tenant_id: 组织ID
            approval_instance_id: 审批实例ID
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            List[ApprovalHistoryResponse]: 审批历史记录列表
        """
        histories = await ApprovalHistory.filter(
            tenant_id=tenant_id,
            approval_instance_id=approval_instance_id,
            deleted_at__isnull=True
        ).order_by("-action_at").offset(skip).limit(limit).all()
        
        return [ApprovalHistoryResponse.model_validate(h) for h in histories]
    
    @staticmethod
    async def get_approval_history_by_uuid(
        tenant_id: int,
        history_uuid: str
    ) -> ApprovalHistoryResponse:
        """
        根据UUID获取审批历史记录
        
        Args:
            tenant_id: 组织ID
            history_uuid: 审批历史记录UUID
            
        Returns:
            ApprovalHistoryResponse: 审批历史记录对象
            
        Raises:
            NotFoundError: 当审批历史记录不存在时抛出
        """
        history = await ApprovalHistory.filter(
            tenant_id=tenant_id,
            uuid=history_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not history:
            raise NotFoundError(f"审批历史记录 {history_uuid} 不存在")
        
        return ApprovalHistoryResponse.model_validate(history)
