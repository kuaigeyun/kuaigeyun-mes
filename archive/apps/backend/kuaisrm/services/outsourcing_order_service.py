"""
委外订单服务模块

提供委外订单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaisrm.models.outsourcing_order import OutsourcingOrder
from apps.kuaisrm.schemas.outsourcing_order_schemas import (
    OutsourcingOrderCreate, OutsourcingOrderUpdate, OutsourcingOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OutsourcingOrderService:
    """委外订单服务"""
    
    @staticmethod
    async def create_outsourcing_order(
        tenant_id: int,
        data: OutsourcingOrderCreate
    ) -> OutsourcingOrderResponse:
        """
        创建委外订单
        
        Args:
            tenant_id: 租户ID
            data: 订单创建数据
            
        Returns:
            OutsourcingOrderResponse: 创建的订单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await OutsourcingOrder.filter(
            tenant_id=tenant_id,
            order_no=data.order_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"订单编号 {data.order_no} 已存在")
        
        # 创建订单
        order = await OutsourcingOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OutsourcingOrderResponse.model_validate(order)
    
    @staticmethod
    async def get_outsourcing_order_by_uuid(
        tenant_id: int,
        order_uuid: str
    ) -> OutsourcingOrderResponse:
        """
        根据UUID获取委外订单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Returns:
            OutsourcingOrderResponse: 订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await OutsourcingOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"委外订单 {order_uuid} 不存在")
        
        return OutsourcingOrderResponse.model_validate(order)
    
    @staticmethod
    async def list_outsourcing_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        supplier_id: Optional[int] = None
    ) -> List[OutsourcingOrderResponse]:
        """
        获取委外订单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 订单状态（过滤）
            supplier_id: 供应商ID（过滤）
            
        Returns:
            List[OutsourcingOrderResponse]: 订单列表
        """
        query = OutsourcingOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        
        orders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [OutsourcingOrderResponse.model_validate(order) for order in orders]
    
    @staticmethod
    async def update_outsourcing_order(
        tenant_id: int,
        order_uuid: str,
        data: OutsourcingOrderUpdate
    ) -> OutsourcingOrderResponse:
        """
        更新委外订单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            data: 订单更新数据
            
        Returns:
            OutsourcingOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await OutsourcingOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"委外订单 {order_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(order, key, value)
        
        await order.save()
        
        return OutsourcingOrderResponse.model_validate(order)
    
    @staticmethod
    async def delete_outsourcing_order(
        tenant_id: int,
        order_uuid: str
    ) -> None:
        """
        删除委外订单（软删除）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await OutsourcingOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"委外订单 {order_uuid} 不存在")
        
        order.deleted_at = datetime.utcnow()
        await order.save()
    
    @staticmethod
    async def update_progress(
        tenant_id: int,
        order_uuid: str,
        progress: int
    ) -> OutsourcingOrderResponse:
        """
        更新委外订单进度
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            progress: 完成进度（0-100）
            
        Returns:
            OutsourcingOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
            ValidationError: 当进度值无效时抛出
        """
        if progress < 0 or progress > 100:
            raise ValidationError("进度值必须在0-100之间")
        
        order = await OutsourcingOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"委外订单 {order_uuid} 不存在")
        
        order.progress = progress
        if progress == 100:
            order.status = "已完成"
        elif progress > 0:
            order.status = "执行中"
        
        await order.save()
        
        return OutsourcingOrderResponse.model_validate(order)
