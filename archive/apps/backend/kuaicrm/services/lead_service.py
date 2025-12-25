"""
线索服务模块

提供线索的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.lead import Lead
from apps.kuaicrm.schemas.lead_schemas import (
    LeadCreate, LeadUpdate, LeadResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class LeadService:
    """线索服务"""
    
    @staticmethod
    async def create_lead(
        tenant_id: int,
        data: LeadCreate
    ) -> LeadResponse:
        """
        创建线索
        
        Args:
            tenant_id: 租户ID
            data: 线索创建数据
            
        Returns:
            LeadResponse: 创建的线索对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Lead.filter(
            tenant_id=tenant_id,
            lead_no=data.lead_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"线索编号 {data.lead_no} 已存在")
        
        # 创建线索
        lead = await Lead.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return LeadResponse.model_validate(lead)
    
    @staticmethod
    async def get_lead_by_uuid(
        tenant_id: int,
        lead_uuid: str
    ) -> LeadResponse:
        """
        根据UUID获取线索
        
        Args:
            tenant_id: 租户ID
            lead_uuid: 线索UUID
            
        Returns:
            LeadResponse: 线索对象
            
        Raises:
            NotFoundError: 当线索不存在时抛出
        """
        lead = await Lead.filter(
            tenant_id=tenant_id,
            uuid=lead_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not lead:
            raise NotFoundError(f"线索 {lead_uuid} 不存在")
        
        return LeadResponse.model_validate(lead)
    
    @staticmethod
    async def list_leads(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        assigned_to: Optional[int] = None,
        lead_source: Optional[str] = None
    ) -> List[LeadResponse]:
        """
        获取线索列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 线索状态（过滤）
            assigned_to: 分配给（过滤）
            lead_source: 线索来源（过滤）
            
        Returns:
            List[LeadResponse]: 线索列表
        """
        query = Lead.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if assigned_to:
            query = query.filter(assigned_to=assigned_to)
        if lead_source:
            query = query.filter(lead_source=lead_source)
        
        leads = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [LeadResponse.model_validate(lead) for lead in leads]
    
    @staticmethod
    async def update_lead(
        tenant_id: int,
        lead_uuid: str,
        data: LeadUpdate
    ) -> LeadResponse:
        """
        更新线索
        
        Args:
            tenant_id: 租户ID
            lead_uuid: 线索UUID
            data: 线索更新数据
            
        Returns:
            LeadResponse: 更新后的线索对象
            
        Raises:
            NotFoundError: 当线索不存在时抛出
        """
        lead = await Lead.filter(
            tenant_id=tenant_id,
            uuid=lead_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not lead:
            raise NotFoundError(f"线索 {lead_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(lead, key, value)
        
        await lead.save()
        
        return LeadResponse.model_validate(lead)
    
    @staticmethod
    async def score_lead(
        tenant_id: int,
        lead_uuid: str,
        score: Optional[int] = None
    ) -> LeadResponse:
        """
        线索评分
        
        Args:
            tenant_id: 租户ID
            lead_uuid: 线索UUID
            score: 评分（可选，如果不提供则自动计算）
            
        Returns:
            LeadResponse: 更新后的线索对象
            
        Raises:
            NotFoundError: 当线索不存在时抛出
        """
        lead = await Lead.filter(
            tenant_id=tenant_id,
            uuid=lead_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not lead:
            raise NotFoundError(f"线索 {lead_uuid} 不存在")
        
        if score is not None:
            # 手动设置评分
            lead.score = score
        else:
            # 自动计算评分（基于多个因素的综合评分）
            base_score = 0
            
            # 1. 线索来源评分（0-40分）
            source_scores = {
                "展会": 35,
                "转介绍": 40,
                "网站": 25,
                "电话营销": 15,
                "社交媒体": 20,
                "广告": 15,
                "其他": 10,
            }
            base_score += source_scores.get(lead.lead_source, 10)
            
            # 2. 跟进次数评分（0-20分）
            from apps.kuaicrm.models.lead_followup import LeadFollowUp
            followup_count = await LeadFollowUp.filter(
                tenant_id=tenant_id,
                lead_id=lead.id,
                deleted_at__isnull=True
            ).count()
            base_score += min(followup_count * 5, 20)  # 每次跟进+5分，最多20分
            
            # 3. 联系信息完整度评分（0-20分）
            info_score = 0
            if lead.contact_name:
                info_score += 5
            if lead.contact_phone:
                info_score += 5
            if lead.contact_email:
                info_score += 5
            if lead.address:
                info_score += 5
            base_score += info_score
            
            # 4. 分配状态评分（0-10分）
            if lead.assigned_to:
                base_score += 10
            
            # 5. 状态评分（0-10分）
            status_scores = {
                "跟进中": 10,
                "已转化": 5,
                "新线索": 0,
                "已关闭": 0,
            }
            base_score += status_scores.get(lead.status, 0)
            
            lead.score = min(base_score, 100)  # 限制在0-100之间
        
        await lead.save()
        
        return LeadResponse.model_validate(lead)
    
    @staticmethod
    async def assign_lead(
        tenant_id: int,
        lead_uuid: str,
        assigned_to: int
    ) -> LeadResponse:
        """
        分配线索
        
        Args:
            tenant_id: 租户ID
            lead_uuid: 线索UUID
            assigned_to: 分配给（用户ID）
            
        Returns:
            LeadResponse: 更新后的线索对象
            
        Raises:
            NotFoundError: 当线索不存在时抛出
        """
        lead = await Lead.filter(
            tenant_id=tenant_id,
            uuid=lead_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not lead:
            raise NotFoundError(f"线索 {lead_uuid} 不存在")
        
        lead.assigned_to = assigned_to
        lead.status = "跟进中"
        await lead.save()
        
        return LeadResponse.model_validate(lead)
    
    @staticmethod
    async def convert_lead(
        tenant_id: int,
        lead_uuid: str,
        convert_type: str,
        convert_reason: Optional[str] = None
    ) -> LeadResponse:
        """
        转化线索
        
        Args:
            tenant_id: 租户ID
            lead_uuid: 线索UUID
            convert_type: 转化类型（opportunity: 转化为商机, customer: 转化为客户）
            convert_reason: 转化原因（可选）
            
        Returns:
            LeadResponse: 更新后的线索对象
            
        Raises:
            NotFoundError: 当线索不存在时抛出
            ValidationError: 当转化类型无效时抛出
        """
        lead = await Lead.filter(
            tenant_id=tenant_id,
            uuid=lead_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not lead:
            raise NotFoundError(f"线索 {lead_uuid} 不存在")
        
        if convert_type not in ["opportunity", "customer"]:
            raise ValidationError(f"无效的转化类型: {convert_type}")
        
        from datetime import datetime
        lead.convert_status = f"已转化为{'商机' if convert_type == 'opportunity' else '客户'}"
        lead.convert_time = datetime.utcnow()
        lead.convert_reason = convert_reason
        lead.status = "已转化"
        await lead.save()
        
        # TODO: 如果转化为商机，创建商机记录
        # TODO: 如果转化为客户，在master-data中创建客户档案
        
        return LeadResponse.model_validate(lead)
    
    @staticmethod
    async def delete_lead(
        tenant_id: int,
        lead_uuid: str
    ) -> None:
        """
        删除线索（软删除）
        
        Args:
            tenant_id: 租户ID
            lead_uuid: 线索UUID
            
        Raises:
            NotFoundError: 当线索不存在时抛出
        """
        lead = await Lead.filter(
            tenant_id=tenant_id,
            uuid=lead_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not lead:
            raise NotFoundError(f"线索 {lead_uuid} 不存在")
        
        from datetime import datetime
        lead.deleted_at = datetime.utcnow()
        await lead.save()
