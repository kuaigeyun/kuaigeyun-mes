"""
生产订单服务模块

提供生产订单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimes.models.order import Order
from apps.kuaimes.schemas.order_schemas import (
    OrderCreate, OrderUpdate, OrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OrderService:
    """生产订单服务"""
    
    @staticmethod
    async def create_order(
        tenant_id: int,
        data: OrderCreate
    ) -> OrderResponse:
        """
        创建生产订单
        
        Args:
            tenant_id: 租户ID
            data: 订单创建数据
            
        Returns:
            OrderResponse: 创建的订单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Order.filter(
            tenant_id=tenant_id,
            order_no=data.order_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"订单编号 {data.order_no} 已存在")
        
        # 创建订单
        order = await Order.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OrderResponse.model_validate(order)
    
    @staticmethod
    async def get_order_by_uuid(
        tenant_id: int,
        order_uuid: str
    ) -> OrderResponse:
        """
        根据UUID获取生产订单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Returns:
            OrderResponse: 订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await Order.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        return OrderResponse.model_validate(order)
    
    @staticmethod
    async def list_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        order_type: Optional[str] = None,
        product_id: Optional[int] = None
    ) -> List[OrderResponse]:
        """
        获取生产订单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 订单状态（过滤）
            order_type: 订单类型（过滤）
            product_id: 产品ID（过滤）
            
        Returns:
            List[OrderResponse]: 订单列表
        """
        query = Order.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if order_type:
            query = query.filter(order_type=order_type)
        if product_id:
            query = query.filter(product_id=product_id)
        
        orders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [OrderResponse.model_validate(order) for order in orders]
    
    @staticmethod
    async def update_order(
        tenant_id: int,
        order_uuid: str,
        data: OrderUpdate
    ) -> OrderResponse:
        """
        更新生产订单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            data: 订单更新数据
            
        Returns:
            OrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await Order.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(order, key, value)
        
        await order.save()
        
        return OrderResponse.model_validate(order)
    
    @staticmethod
    async def delete_order(
        tenant_id: int,
        order_uuid: str
    ) -> None:
        """
        删除生产订单（软删除）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await Order.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        order.deleted_at = datetime.utcnow()
        await order.save()
    
    @staticmethod
    async def confirm_order(
        tenant_id: int,
        order_uuid: str
    ) -> OrderResponse:
        """
        确认生产订单（下发到车间）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Returns:
            OrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
            ValidationError: 当订单状态不允许确认时抛出
        """
        order = await Order.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        # 检查状态
        if order.status not in ["草稿", "已确认"]:
            raise ValidationError(f"订单状态为 {order.status}，无法确认")
        
        # 更新状态
        order.status = "已下发"
        await order.save()
        
        return OrderResponse.model_validate(order)
