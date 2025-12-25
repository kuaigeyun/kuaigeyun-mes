"""
入库单服务模块

提供入库单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiwms.models.inbound_order import InboundOrder
from apps.kuaiwms.schemas.inbound_order_schemas import (
    InboundOrderCreate, InboundOrderUpdate, InboundOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class InboundOrderService:
    """入库单服务"""
    
    @staticmethod
    async def create_inbound_order(
        tenant_id: int,
        data: InboundOrderCreate
    ) -> InboundOrderResponse:
        """
        创建入库单
        
        Args:
            tenant_id: 租户ID
            data: 入库单创建数据
            
        Returns:
            InboundOrderResponse: 创建的入库单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await InboundOrder.filter(
            tenant_id=tenant_id,
            order_no=data.order_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"入库单编号 {data.order_no} 已存在")
        
        # 创建入库单
        order = await InboundOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return InboundOrderResponse.model_validate(order)
    
    @staticmethod
    async def get_inbound_order_by_uuid(
        tenant_id: int,
        order_uuid: str
    ) -> InboundOrderResponse:
        """
        根据UUID获取入库单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 入库单UUID
            
        Returns:
            InboundOrderResponse: 入库单对象
            
        Raises:
            NotFoundError: 当入库单不存在时抛出
        """
        order = await InboundOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"入库单 {order_uuid} 不存在")
        
        return InboundOrderResponse.model_validate(order)
    
    @staticmethod
    async def list_inbound_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        order_type: Optional[str] = None,
        warehouse_id: Optional[int] = None
    ) -> List[InboundOrderResponse]:
        """
        获取入库单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 入库状态（过滤）
            order_type: 入库类型（过滤）
            warehouse_id: 仓库ID（过滤）
            
        Returns:
            List[InboundOrderResponse]: 入库单列表
        """
        query = InboundOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if order_type:
            query = query.filter(order_type=order_type)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        
        orders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [InboundOrderResponse.model_validate(order) for order in orders]
    
    @staticmethod
    async def update_inbound_order(
        tenant_id: int,
        order_uuid: str,
        data: InboundOrderUpdate
    ) -> InboundOrderResponse:
        """
        更新入库单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 入库单UUID
            data: 入库单更新数据
            
        Returns:
            InboundOrderResponse: 更新后的入库单对象
            
        Raises:
            NotFoundError: 当入库单不存在时抛出
        """
        order = await InboundOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"入库单 {order_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(order, key, value)
        
        await order.save()
        
        return InboundOrderResponse.model_validate(order)
    
    @staticmethod
    async def delete_inbound_order(
        tenant_id: int,
        order_uuid: str
    ) -> None:
        """
        删除入库单（软删除）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 入库单UUID
            
        Raises:
            NotFoundError: 当入库单不存在时抛出
        """
        order = await InboundOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"入库单 {order_uuid} 不存在")
        
        order.deleted_at = datetime.utcnow()
        await order.save()
    
    @staticmethod
    async def confirm_inbound(
        tenant_id: int,
        order_uuid: str
    ) -> InboundOrderResponse:
        """
        确认入库（更新库存）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 入库单UUID
            
        Returns:
            InboundOrderResponse: 更新后的入库单对象
            
        Raises:
            NotFoundError: 当入库单不存在时抛出
            ValidationError: 当入库单状态不允许确认时抛出
        """
        order = await InboundOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"入库单 {order_uuid} 不存在")
        
        # 检查状态
        if order.status in ["已完成", "已关闭", "已取消"]:
            raise ValidationError(f"入库单状态为 {order.status}，无法确认入库")
        
        # TODO: 实现库存更新逻辑
        # 这里应该根据入库明细更新Inventory表
        
        # 更新状态
        order.status = "已完成"
        await order.save()
        
        return InboundOrderResponse.model_validate(order)
