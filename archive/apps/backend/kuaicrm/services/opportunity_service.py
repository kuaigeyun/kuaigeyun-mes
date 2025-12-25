"""
商机服务模块

提供商机的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from decimal import Decimal
from apps.kuaicrm.models.opportunity import Opportunity
from apps.kuaicrm.schemas.opportunity_schemas import (
    OpportunityCreate, OpportunityUpdate, OpportunityResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OpportunityService:
    """商机服务"""
    
    @staticmethod
    async def create_opportunity(
        tenant_id: int,
        data: OpportunityCreate
    ) -> OpportunityResponse:
        """
        创建商机
        
        Args:
            tenant_id: 租户ID
            data: 商机创建数据
            
        Returns:
            OpportunityResponse: 创建的商机对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Opportunity.filter(
            tenant_id=tenant_id,
            oppo_no=data.oppo_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"商机编号 {data.oppo_no} 已存在")
        
        # 创建商机
        opportunity = await Opportunity.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OpportunityResponse.model_validate(opportunity)
    
    @staticmethod
    async def get_opportunity_by_uuid(
        tenant_id: int,
        opportunity_uuid: str
    ) -> OpportunityResponse:
        """
        根据UUID获取商机
        
        Args:
            tenant_id: 租户ID
            opportunity_uuid: 商机UUID
            
        Returns:
            OpportunityResponse: 商机对象
            
        Raises:
            NotFoundError: 当商机不存在时抛出
        """
        opportunity = await Opportunity.filter(
            tenant_id=tenant_id,
            uuid=opportunity_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not opportunity:
            raise NotFoundError(f"商机 {opportunity_uuid} 不存在")
        
        return OpportunityResponse.model_validate(opportunity)
    
    @staticmethod
    async def list_opportunities(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        stage: Optional[str] = None,
        owner_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[OpportunityResponse]:
        """
        获取商机列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            stage: 商机阶段（过滤）
            owner_id: 负责人（过滤）
            status: 商机状态（过滤）
            
        Returns:
            List[OpportunityResponse]: 商机列表
        """
        query = Opportunity.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if stage:
            query = query.filter(stage=stage)
        if owner_id:
            query = query.filter(owner_id=owner_id)
        if status:
            query = query.filter(status=status)
        
        opportunities = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [OpportunityResponse.model_validate(oppo) for oppo in opportunities]
    
    @staticmethod
    async def update_opportunity(
        tenant_id: int,
        opportunity_uuid: str,
        data: OpportunityUpdate
    ) -> OpportunityResponse:
        """
        更新商机
        
        Args:
            tenant_id: 租户ID
            opportunity_uuid: 商机UUID
            data: 商机更新数据
            
        Returns:
            OpportunityResponse: 更新后的商机对象
            
        Raises:
            NotFoundError: 当商机不存在时抛出
        """
        opportunity = await Opportunity.filter(
            tenant_id=tenant_id,
            uuid=opportunity_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not opportunity:
            raise NotFoundError(f"商机 {opportunity_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(opportunity, key, value)
        
        await opportunity.save()
        
        return OpportunityResponse.model_validate(opportunity)
    
    @staticmethod
    async def calculate_probability(
        tenant_id: int,
        opportunity_uuid: str
    ) -> Decimal:
        """
        计算商机成交概率
        
        Args:
            tenant_id: 租户ID
            opportunity_uuid: 商机UUID
            
        Returns:
            Decimal: 成交概率（0-100）
            
        Raises:
            NotFoundError: 当商机不存在时抛出
        """
        opportunity = await Opportunity.filter(
            tenant_id=tenant_id,
            uuid=opportunity_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not opportunity:
            raise NotFoundError(f"商机 {opportunity_uuid} 不存在")
        
        # 基于商机阶段计算基础概率
        stage_probabilities = {
            "初步接触": Decimal("10"),
            "需求确认": Decimal("30"),
            "方案报价": Decimal("50"),
            "商务谈判": Decimal("70"),
            "成交": Decimal("100"),
        }
        
        base_probability = stage_probabilities.get(opportunity.stage, Decimal("0"))
        
        # 1. 跟进次数调整（最多+15分）
        from apps.kuaicrm.models.opportunity_followup import OpportunityFollowUp
        followup_count = await OpportunityFollowUp.filter(
            tenant_id=tenant_id,
            opportunity_id=opportunity.id,
            deleted_at__isnull=True
        ).count()
        followup_bonus = min(followup_count * Decimal("2"), Decimal("15"))  # 每次跟进+2分，最多15分
        
        # 2. 商机金额调整（大单概率略高，最多+10分）
        amount_bonus = Decimal("0")
        if opportunity.amount:
            if opportunity.amount >= Decimal("1000000"):  # 100万以上
                amount_bonus = Decimal("10")
            elif opportunity.amount >= Decimal("500000"):  # 50万以上
                amount_bonus = Decimal("5")
            elif opportunity.amount >= Decimal("100000"):  # 10万以上
                amount_bonus = Decimal("2")
        
        # 3. 预计成交日期调整（有明确日期+5分，临近日期+5分）
        date_bonus = Decimal("0")
        if opportunity.expected_close_date:
            date_bonus += Decimal("5")  # 有明确日期
            from datetime import datetime, timedelta
            days_until_close = (opportunity.expected_close_date - datetime.utcnow()).days
            if 0 <= days_until_close <= 30:  # 30天内
                date_bonus += Decimal("5")
        
        # 4. 负责人调整（有负责人+5分）
        owner_bonus = Decimal("5") if opportunity.owner_id else Decimal("0")
        
        # 5. 来源调整（来自线索转化+5分）
        source_bonus = Decimal("5") if opportunity.source == "线索转化" else Decimal("0")
        
        # 计算最终概率（基础概率 + 各项调整，但不超过100）
        final_probability = min(
            base_probability + followup_bonus + amount_bonus + date_bonus + owner_bonus + source_bonus,
            Decimal("100")
        )
        
        opportunity.probability = final_probability
        await opportunity.save()
        
        return final_probability
    
    @staticmethod
    async def change_stage(
        tenant_id: int,
        opportunity_uuid: str,
        new_stage: str,
        reason: Optional[str] = None
    ) -> OpportunityResponse:
        """
        变更商机阶段
        
        Args:
            tenant_id: 租户ID
            opportunity_uuid: 商机UUID
            new_stage: 新阶段
            reason: 变更原因（可选）
            
        Returns:
            OpportunityResponse: 更新后的商机对象
            
        Raises:
            NotFoundError: 当商机不存在时抛出
            ValidationError: 当阶段无效时抛出
        """
        opportunity = await Opportunity.filter(
            tenant_id=tenant_id,
            uuid=opportunity_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not opportunity:
            raise NotFoundError(f"商机 {opportunity_uuid} 不存在")
        
        valid_stages = ["初步接触", "需求确认", "方案报价", "商务谈判", "成交"]
        if new_stage not in valid_stages:
            raise ValidationError(f"无效的商机阶段: {new_stage}")
        
        opportunity.stage = new_stage
        
        # 更新成交概率
        stage_probabilities = {
            "初步接触": Decimal("10"),
            "需求确认": Decimal("30"),
            "方案报价": Decimal("50"),
            "商务谈判": Decimal("70"),
            "成交": Decimal("100"),
        }
        opportunity.probability = stage_probabilities.get(new_stage, Decimal("0"))
        
        # 如果阶段为成交，更新状态
        if new_stage == "成交":
            opportunity.status = "已成交"
        
        await opportunity.save()
        
        # TODO: 记录阶段变更历史
        
        return OpportunityResponse.model_validate(opportunity)
    
    @staticmethod
    async def convert_opportunity(
        tenant_id: int,
        opportunity_uuid: str,
        order_data: Optional[dict] = None
    ) -> OpportunityResponse:
        """
        转化商机为订单
        
        Args:
            tenant_id: 租户ID
            opportunity_uuid: 商机UUID
            order_data: 订单数据（可选，如果不提供则使用商机数据）
            
        Returns:
            OpportunityResponse: 更新后的商机对象
            
        Raises:
            NotFoundError: 当商机不存在时抛出
        """
        opportunity = await Opportunity.filter(
            tenant_id=tenant_id,
            uuid=opportunity_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not opportunity:
            raise NotFoundError(f"商机 {opportunity_uuid} 不存在")
        
        # 更新商机状态
        opportunity.status = "已成交"
        opportunity.stage = "成交"
        opportunity.probability = Decimal("100")
        await opportunity.save()
        
        # TODO: 创建销售订单
        # if order_data:
        #     from apps.kuaicrm.services.sales_order_service import SalesOrderService
        #     from apps.kuaicrm.schemas.sales_order_schemas import SalesOrderCreate
        #     order_create = SalesOrderCreate(**order_data)
        #     order_create.opportunity_id = opportunity.id
        #     await SalesOrderService.create_sales_order(tenant_id, order_create)
        
        return OpportunityResponse.model_validate(opportunity)
    
    @staticmethod
    async def delete_opportunity(
        tenant_id: int,
        opportunity_uuid: str
    ) -> None:
        """
        删除商机（软删除）
        
        Args:
            tenant_id: 租户ID
            opportunity_uuid: 商机UUID
            
        Raises:
            NotFoundError: 当商机不存在时抛出
        """
        opportunity = await Opportunity.filter(
            tenant_id=tenant_id,
            uuid=opportunity_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not opportunity:
            raise NotFoundError(f"商机 {opportunity_uuid} 不存在")
        
        from datetime import datetime
        opportunity.deleted_at = datetime.utcnow()
        await opportunity.save()
