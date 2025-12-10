"""
生产订单服务模块

提供生产订单的 CRUD 操作。
"""

from typing import List
from tortoise.exceptions import IntegrityError

from kuaimes.models.order import Order
from kuaimes.schemas.order import OrderCreate, OrderUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OrderService:
    """
    生产订单服务类
    
    提供生产订单的 CRUD 操作。
    """
    
    @staticmethod
    async def create_order(
        tenant_id: int,
        data: OrderCreate
    ) -> Order:
        """
        创建生产订单
        
        Args:
            tenant_id: 组织ID
            data: 订单创建数据
            
        Returns:
            Order: 创建的订单对象
            
        Raises:
            ValidationError: 当订单编号已存在时抛出
        """
        try:
            order = Order(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await order.save()
            return order
        except IntegrityError:
            raise ValidationError(f"订单编号 {data.order_no} 已存在")
    
    @staticmethod
    async def get_order_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> Order:
        """
        根据UUID获取订单
        
        Args:
            tenant_id: 组织ID
            uuid: 订单UUID
            
        Returns:
            Order: 订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await Order.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError("订单不存在")
        
        return order
    
    @staticmethod
    async def list_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[Order]:
        """
        获取订单列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            
        Returns:
            List[Order]: 订单列表
        """
        return await Order.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).offset(skip).limit(limit).order_by("-created_at")

