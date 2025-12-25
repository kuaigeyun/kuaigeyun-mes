"""
报价单服务模块

提供报价单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.quotation import Quotation
from apps.kuaicrm.schemas.quotation_schemas import (
    QuotationCreate, QuotationUpdate, QuotationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class QuotationService:
    """报价单服务"""
    
    @staticmethod
    async def create_quotation(
        tenant_id: int,
        data: QuotationCreate
    ) -> QuotationResponse:
        """
        创建报价单
        
        Args:
            tenant_id: 租户ID
            data: 报价单创建数据
            
        Returns:
            QuotationResponse: 创建的报价单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Quotation.filter(
            tenant_id=tenant_id,
            quotation_no=data.quotation_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"报价单编号 {data.quotation_no} 已存在")
        
        # 创建报价单
        # 使用 model_dump(by_alias=False) 确保使用 snake_case 字段名（数据库字段名）
        quotation = await Quotation.create(
            tenant_id=tenant_id,
            **data.model_dump(by_alias=False)
        )
        
        return QuotationResponse.model_validate(quotation)
    
    @staticmethod
    async def get_quotation_by_uuid(
        tenant_id: int,
        quotation_uuid: str
    ) -> QuotationResponse:
        """
        根据UUID获取报价单
        
        Args:
            tenant_id: 租户ID
            quotation_uuid: 报价单UUID
            
        Returns:
            QuotationResponse: 报价单对象
            
        Raises:
            NotFoundError: 当报价单不存在时抛出
        """
        quotation = await Quotation.filter(
            tenant_id=tenant_id,
            uuid=quotation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not quotation:
            raise NotFoundError(f"报价单 {quotation_uuid} 不存在")
        
        return QuotationResponse.model_validate(quotation)
    
    @staticmethod
    async def list_quotations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        customer_id: Optional[int] = None
    ) -> List[QuotationResponse]:
        """
        获取报价单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 报价单状态（过滤）
            customer_id: 客户ID（过滤）
            
        Returns:
            List[QuotationResponse]: 报价单列表
        """
        query = Quotation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        if customer_id:
            query = query.filter(customer_id=customer_id)
        
        quotations = await query.order_by("-quotation_date", "-id").offset(skip).limit(limit).all()
        
        return [QuotationResponse.model_validate(q) for q in quotations]
    
    @staticmethod
    async def update_quotation(
        tenant_id: int,
        quotation_uuid: str,
        data: QuotationUpdate
    ) -> QuotationResponse:
        """
        更新报价单
        
        Args:
            tenant_id: 租户ID
            quotation_uuid: 报价单UUID
            data: 报价单更新数据
            
        Returns:
            QuotationResponse: 更新后的报价单对象
            
        Raises:
            NotFoundError: 当报价单不存在时抛出
            ValidationError: 当数据验证失败时抛出
        """
        quotation = await Quotation.filter(
            tenant_id=tenant_id,
            uuid=quotation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not quotation:
            raise NotFoundError(f"报价单 {quotation_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(quotation, key, value)
        
        await quotation.save()
        
        return QuotationResponse.model_validate(quotation)
    
    @staticmethod
    async def delete_quotation(
        tenant_id: int,
        quotation_uuid: str
    ) -> None:
        """
        删除报价单（软删除）
        
        Args:
            tenant_id: 租户ID
            quotation_uuid: 报价单UUID
            
        Raises:
            NotFoundError: 当报价单不存在时抛出
        """
        quotation = await Quotation.filter(
            tenant_id=tenant_id,
            uuid=quotation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not quotation:
            raise NotFoundError(f"报价单 {quotation_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        quotation.deleted_at = timezone.now()
        await quotation.save()
    
    @staticmethod
    async def convert_to_order(
        tenant_id: int,
        quotation_uuid: str,
        order_data: Optional[dict] = None
    ) -> dict:
        """
        将报价单转化为销售订单
        
        Args:
            tenant_id: 租户ID
            quotation_uuid: 报价单UUID
            order_data: 订单数据（可选，用于覆盖报价单数据）
            
        Returns:
            dict: 包含订单信息的字典
            
        Raises:
            NotFoundError: 当报价单不存在时抛出
        """
        quotation = await Quotation.filter(
            tenant_id=tenant_id,
            uuid=quotation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not quotation:
            raise NotFoundError(f"报价单 {quotation_uuid} 不存在")
        
        # 构建订单数据
        from apps.kuaicrm.services.sales_order_service import SalesOrderService
        from apps.kuaicrm.schemas.sales_order_schemas import SalesOrderCreate
        from datetime import datetime
        
        order_create_data = SalesOrderCreate(
            order_no=order_data.get("order_no") if order_data and "order_no" in order_data else f"SO-{quotation.quotation_no}",
            order_date=order_data.get("order_date") if order_data and "order_date" in order_data else datetime.now(),
            customer_id=quotation.customer_id,
            opportunity_id=quotation.opportunity_id,
            status="待审批",
            total_amount=quotation.total_amount,
            delivery_date=order_data.get("delivery_date") if order_data and "delivery_date" in order_data else quotation.valid_until,
            priority=order_data.get("priority") if order_data and "priority" in order_data else "普通",
        )
        
        # 创建订单
        order = await SalesOrderService.create_sales_order(tenant_id, order_create_data)
        
        # 更新报价单状态为"已接受"
        quotation.status = "已接受"
        await quotation.save()
        
        return {
            "quotation": QuotationResponse.model_validate(quotation),
            "order": order
        }

