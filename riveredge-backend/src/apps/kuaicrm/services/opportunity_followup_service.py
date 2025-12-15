"""
商机跟进记录服务模块

提供商机跟进记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.opportunity_followup import OpportunityFollowUp
from apps.kuaicrm.models.opportunity import Opportunity
from apps.kuaicrm.schemas.opportunity_followup_schemas import (
    OpportunityFollowUpCreate, OpportunityFollowUpUpdate, OpportunityFollowUpResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OpportunityFollowUpService:
    """商机跟进记录服务"""
    
    @staticmethod
    async def create_followup(
        tenant_id: int,
        data: OpportunityFollowUpCreate
    ) -> OpportunityFollowUpResponse:
        """
        创建商机跟进记录
        
        Args:
            tenant_id: 租户ID
            data: 跟进记录创建数据
            
        Returns:
            OpportunityFollowUpResponse: 创建的跟进记录对象
            
        Raises:
            NotFoundError: 当商机不存在时抛出
        """
        # 验证商机是否存在
        opportunity = await Opportunity.filter(
            tenant_id=tenant_id,
            id=data.opportunity_id,
            deleted_at__isnull=True
        ).first()
        
        if not opportunity:
            raise NotFoundError(f"商机 {data.opportunity_id} 不存在")
        
        # 创建跟进记录
        followup = await OpportunityFollowUp.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OpportunityFollowUpResponse.model_validate(followup)
    
    @staticmethod
    async def get_followup_by_uuid(
        tenant_id: int,
        followup_uuid: str
    ) -> OpportunityFollowUpResponse:
        """
        根据UUID获取商机跟进记录
        
        Args:
            tenant_id: 租户ID
            followup_uuid: 跟进记录UUID
            
        Returns:
            OpportunityFollowUpResponse: 跟进记录对象
            
        Raises:
            NotFoundError: 当跟进记录不存在时抛出
        """
        followup = await OpportunityFollowUp.filter(
            tenant_id=tenant_id,
            uuid=followup_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not followup:
            raise NotFoundError(f"跟进记录 {followup_uuid} 不存在")
        
        return OpportunityFollowUpResponse.model_validate(followup)
    
    @staticmethod
    async def list_followups(
        tenant_id: int,
        opportunity_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[OpportunityFollowUpResponse]:
        """
        获取商机跟进记录列表
        
        Args:
            tenant_id: 租户ID
            opportunity_id: 商机ID（过滤）
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            List[OpportunityFollowUpResponse]: 跟进记录列表
        """
        query = OpportunityFollowUp.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if opportunity_id:
            query = query.filter(opportunity_id=opportunity_id)
        
        followups = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [OpportunityFollowUpResponse.model_validate(f) for f in followups]
    
    @staticmethod
    async def update_followup(
        tenant_id: int,
        followup_uuid: str,
        data: OpportunityFollowUpUpdate
    ) -> OpportunityFollowUpResponse:
        """
        更新商机跟进记录
        
        Args:
            tenant_id: 租户ID
            followup_uuid: 跟进记录UUID
            data: 跟进记录更新数据
            
        Returns:
            OpportunityFollowUpResponse: 更新后的跟进记录对象
            
        Raises:
            NotFoundError: 当跟进记录不存在时抛出
        """
        followup = await OpportunityFollowUp.filter(
            tenant_id=tenant_id,
            uuid=followup_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not followup:
            raise NotFoundError(f"跟进记录 {followup_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(followup, key, value)
        
        await followup.save()
        
        return OpportunityFollowUpResponse.model_validate(followup)
    
    @staticmethod
    async def delete_followup(
        tenant_id: int,
        followup_uuid: str
    ) -> None:
        """
        删除商机跟进记录（软删除）
        
        Args:
            tenant_id: 租户ID
            followup_uuid: 跟进记录UUID
            
        Raises:
            NotFoundError: 当跟进记录不存在时抛出
        """
        followup = await OpportunityFollowUp.filter(
            tenant_id=tenant_id,
            uuid=followup_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not followup:
            raise NotFoundError(f"跟进记录 {followup_uuid} 不存在")
        
        from datetime import datetime
        followup.deleted_at = datetime.utcnow()
        await followup.save()
