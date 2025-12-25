"""
采购订单服务模块

提供采购订单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaisrm.models.purchase_order import PurchaseOrder
from apps.kuaisrm.schemas.purchase_order_schemas import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PurchaseOrderService:
    """采购订单服务"""
    
    @staticmethod
    async def create_purchase_order(
        tenant_id: int,
        data: PurchaseOrderCreate
    ) -> PurchaseOrderResponse:
        """
        创建采购订单
        
        Args:
            tenant_id: 租户ID
            data: 订单创建数据
            
        Returns:
            PurchaseOrderResponse: 创建的订单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            order_no=data.order_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"订单编号 {data.order_no} 已存在")
        
        # 创建订单
        order = await PurchaseOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return PurchaseOrderResponse.model_validate(order)
    
    @staticmethod
    async def get_purchase_order_by_uuid(
        tenant_id: int,
        order_uuid: str
    ) -> PurchaseOrderResponse:
        """
        根据UUID获取采购订单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Returns:
            PurchaseOrderResponse: 订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"采购订单 {order_uuid} 不存在")
        
        return PurchaseOrderResponse.model_validate(order)
    
    @staticmethod
    async def list_purchase_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        supplier_id: Optional[int] = None
    ) -> List[PurchaseOrderResponse]:
        """
        获取采购订单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 订单状态（过滤）
            supplier_id: 供应商ID（过滤）
            
        Returns:
            List[PurchaseOrderResponse]: 订单列表
        """
        query = PurchaseOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        
        orders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [PurchaseOrderResponse.model_validate(order) for order in orders]
    
    @staticmethod
    async def update_purchase_order(
        tenant_id: int,
        order_uuid: str,
        data: PurchaseOrderUpdate
    ) -> PurchaseOrderResponse:
        """
        更新采购订单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            data: 订单更新数据
            
        Returns:
            PurchaseOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"采购订单 {order_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(order, key, value)
        
        await order.save()
        
        return PurchaseOrderResponse.model_validate(order)
    
    @staticmethod
    async def delete_purchase_order(
        tenant_id: int,
        order_uuid: str
    ) -> None:
        """
        删除采购订单（软删除）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"采购订单 {order_uuid} 不存在")
        
        order.deleted_at = datetime.utcnow()
        await order.save()
    
    @staticmethod
    async def submit_for_approval(
        tenant_id: int,
        order_uuid: str,
        process_code: str,
        user_id: int
    ) -> PurchaseOrderResponse:
        """
        提交采购订单审批
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            process_code: 审批流程代码
            user_id: 提交人ID
            
        Returns:
            PurchaseOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单或审批流程不存在时抛出
            ValidationError: 当订单已提交审批时抛出
        """
        order = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"采购订单 {order_uuid} 不存在")
        
        # 检查是否已经提交审批
        if order.approval_instance_id:
            raise ValidationError("采购订单已提交审批，无法重复提交")
        
        # 获取审批流程
        from core.models.approval_process import ApprovalProcess
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=process_code,
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        if not process:
            raise NotFoundError(f"审批流程 {process_code} 不存在或未启用")
        
        # 创建审批实例
        from core.services.approval_instance_service import ApprovalInstanceService
        from core.schemas.approval_instance import ApprovalInstanceCreate
        
        approval_data = ApprovalInstanceCreate(
            process_uuid=str(process.uuid),
            title=f"采购订单审批：{order.order_no}",
            content=f"订单编号：{order.order_no}\n供应商ID：{order.supplier_id}\n订单金额：{order.total_amount}",
            data={
                "order_uuid": order_uuid,
                "order_no": order.order_no,
                "supplier_id": order.supplier_id,
                "total_amount": str(order.total_amount),
            }
        )
        
        approval_instance = await ApprovalInstanceService.create_approval_instance(
            tenant_id=tenant_id,
            user_id=user_id,
            data=approval_data
        )
        
        # 更新订单状态
        order.approval_instance_id = approval_instance.id
        order.approval_status = "pending"
        order.status = "待审批"
        await order.save()
        
        return PurchaseOrderResponse.model_validate(order)
