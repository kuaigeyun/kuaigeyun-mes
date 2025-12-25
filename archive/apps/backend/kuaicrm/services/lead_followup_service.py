"""
线索跟进记录服务模块

提供线索跟进记录的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.lead_followup import LeadFollowUp
from apps.kuaicrm.models.lead import Lead
from apps.kuaicrm.schemas.lead_followup_schemas import (
    LeadFollowUpCreate, LeadFollowUpUpdate, LeadFollowUpResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class LeadFollowUpService:
    """线索跟进记录服务"""
    
    @staticmethod
    async def create_followup(
        tenant_id: int,
        data: LeadFollowUpCreate
    ) -> LeadFollowUpResponse:
        """
        创建线索跟进记录
        
        Args:
            tenant_id: 租户ID
            data: 跟进记录创建数据
            
        Returns:
            LeadFollowUpResponse: 创建的跟进记录对象
            
        Raises:
            NotFoundError: 当线索不存在时抛出
        """
        # 验证线索是否存在
        lead = await Lead.filter(
            tenant_id=tenant_id,
            id=data.lead_id,
            deleted_at__isnull=True
        ).first()
        
        if not lead:
            raise NotFoundError(f"线索 {data.lead_id} 不存在")
        
        # 创建跟进记录
        followup = await LeadFollowUp.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        # 更新线索状态为"跟进中"（如果还是"新线索"）
        if lead.status == "新线索":
            lead.status = "跟进中"
            await lead.save()
        
        return LeadFollowUpResponse.model_validate(followup)
    
    @staticmethod
    async def get_followup_by_uuid(
        tenant_id: int,
        followup_uuid: str
    ) -> LeadFollowUpResponse:
        """
        根据UUID获取线索跟进记录
        
        Args:
            tenant_id: 租户ID
            followup_uuid: 跟进记录UUID
            
        Returns:
            LeadFollowUpResponse: 跟进记录对象
            
        Raises:
            NotFoundError: 当跟进记录不存在时抛出
        """
        followup = await LeadFollowUp.filter(
            tenant_id=tenant_id,
            uuid=followup_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not followup:
            raise NotFoundError(f"跟进记录 {followup_uuid} 不存在")
        
        return LeadFollowUpResponse.model_validate(followup)
    
    @staticmethod
    async def list_followups(
        tenant_id: int,
        lead_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[LeadFollowUpResponse]:
        """
        获取线索跟进记录列表
        
        Args:
            tenant_id: 租户ID
            lead_id: 线索ID（过滤）
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            List[LeadFollowUpResponse]: 跟进记录列表
        """
        query = LeadFollowUp.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if lead_id:
            query = query.filter(lead_id=lead_id)
        
        followups = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [LeadFollowUpResponse.model_validate(f) for f in followups]
    
    @staticmethod
    async def update_followup(
        tenant_id: int,
        followup_uuid: str,
        data: LeadFollowUpUpdate
    ) -> LeadFollowUpResponse:
        """
        更新线索跟进记录
        
        Args:
            tenant_id: 租户ID
            followup_uuid: 跟进记录UUID
            data: 跟进记录更新数据
            
        Returns:
            LeadFollowUpResponse: 更新后的跟进记录对象
            
        Raises:
            NotFoundError: 当跟进记录不存在时抛出
        """
        followup = await LeadFollowUp.filter(
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
        
        return LeadFollowUpResponse.model_validate(followup)
    
    @staticmethod
    async def delete_followup(
        tenant_id: int,
        followup_uuid: str
    ) -> None:
        """
        删除线索跟进记录（软删除）
        
        Args:
            tenant_id: 租户ID
            followup_uuid: 跟进记录UUID
            
        Raises:
            NotFoundError: 当跟进记录不存在时抛出
        """
        followup = await LeadFollowUp.filter(
            tenant_id=tenant_id,
            uuid=followup_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not followup:
            raise NotFoundError(f"跟进记录 {followup_uuid} 不存在")
        
        from datetime import datetime
        followup.deleted_at = datetime.utcnow()
        await followup.save()
