"""
出库单服务模块

提供出库单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiwms.models.outbound_order import OutboundOrder
from apps.kuaiwms.schemas.outbound_order_schemas import (
    OutboundOrderCreate, OutboundOrderUpdate, OutboundOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OutboundOrderService:
    """出库单服务"""
    
    @staticmethod
    async def create_outbound_order(
        tenant_id: int,
        data: OutboundOrderCreate
    ) -> OutboundOrderResponse:
        """
        创建出库单
        
        Args:
            tenant_id: 租户ID
            data: 出库单创建数据
            
        Returns:
            OutboundOrderResponse: 创建的出库单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await OutboundOrder.filter(
            tenant_id=tenant_id,
            order_no=data.order_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"出库单编号 {data.order_no} 已存在")
        
        # 创建出库单
        order = await OutboundOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OutboundOrderResponse.model_validate(order)
    
    @staticmethod
    async def get_outbound_order_by_uuid(
        tenant_id: int,
        order_uuid: str
    ) -> OutboundOrderResponse:
        """
        根据UUID获取出库单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 出库单UUID
            
        Returns:
            OutboundOrderResponse: 出库单对象
            
        Raises:
            NotFoundError: 当出库单不存在时抛出
        """
        order = await OutboundOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"出库单 {order_uuid} 不存在")
        
        return OutboundOrderResponse.model_validate(order)
    
    @staticmethod
    async def list_outbound_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        order_type: Optional[str] = None,
        warehouse_id: Optional[int] = None
    ) -> List[OutboundOrderResponse]:
        """
        获取出库单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 出库状态（过滤）
            order_type: 出库类型（过滤）
            warehouse_id: 仓库ID（过滤）
            
        Returns:
            List[OutboundOrderResponse]: 出库单列表
        """
        query = OutboundOrder.filter(
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
        
        return [OutboundOrderResponse.model_validate(order) for order in orders]
    
    @staticmethod
    async def update_outbound_order(
        tenant_id: int,
        order_uuid: str,
        data: OutboundOrderUpdate
    ) -> OutboundOrderResponse:
        """
        更新出库单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 出库单UUID
            data: 出库单更新数据
            
        Returns:
            OutboundOrderResponse: 更新后的出库单对象
            
        Raises:
            NotFoundError: 当出库单不存在时抛出
        """
        order = await OutboundOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"出库单 {order_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(order, key, value)
        
        await order.save()
        
        return OutboundOrderResponse.model_validate(order)
    
    @staticmethod
    async def delete_outbound_order(
        tenant_id: int,
        order_uuid: str
    ) -> None:
        """
        删除出库单（软删除）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 出库单UUID
            
        Raises:
            NotFoundError: 当出库单不存在时抛出
        """
        order = await OutboundOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"出库单 {order_uuid} 不存在")
        
        order.deleted_at = datetime.utcnow()
        await order.save()
    
    @staticmethod
    async def confirm_outbound(
        tenant_id: int,
        order_uuid: str
    ) -> OutboundOrderResponse:
        """
        确认出库（更新库存）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 出库单UUID
            
        Returns:
            OutboundOrderResponse: 更新后的出库单对象
            
        Raises:
            NotFoundError: 当出库单不存在时抛出
            ValidationError: 当出库单状态不允许确认时抛出
        """
        order = await OutboundOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"出库单 {order_uuid} 不存在")
        
        # 检查状态
        if order.status in ["已完成", "已关闭", "已取消"]:
            raise ValidationError(f"出库单状态为 {order.status}，无法确认出库")
        
        # TODO: 实现库存更新逻辑
        # 这里应该根据出库明细更新Inventory表
        
        # 更新状态
        order.status = "已完成"
        await order.save()
        
        return OutboundOrderResponse.model_validate(order)
