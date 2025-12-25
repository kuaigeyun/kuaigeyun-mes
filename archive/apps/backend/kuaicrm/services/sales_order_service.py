"""
销售订单服务模块

提供销售订单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional, Dict
from datetime import datetime
from apps.kuaicrm.models.sales_order import SalesOrder
from apps.kuaicrm.schemas.sales_order_schemas import (
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SalesOrderService:
    """销售订单服务"""
    
    @staticmethod
    async def create_sales_order(
        tenant_id: int,
        data: SalesOrderCreate
    ) -> SalesOrderResponse:
        """
        创建销售订单
        
        Args:
            tenant_id: 租户ID
            data: 订单创建数据
            
        Returns:
            SalesOrderResponse: 创建的订单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SalesOrder.filter(
            tenant_id=tenant_id,
            order_no=data.order_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"订单编号 {data.order_no} 已存在")
        
        # 创建订单
        order = await SalesOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SalesOrderResponse.model_validate(order)
    
    @staticmethod
    async def get_sales_order_by_uuid(
        tenant_id: int,
        order_uuid: str
    ) -> SalesOrderResponse:
        """
        根据UUID获取销售订单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Returns:
            SalesOrderResponse: 订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await SalesOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        return SalesOrderResponse.model_validate(order)
    
    @staticmethod
    async def list_sales_orders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        customer_id: Optional[int] = None
    ) -> List[SalesOrderResponse]:
        """
        获取销售订单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 订单状态（过滤）
            customer_id: 客户ID（过滤）
            
        Returns:
            List[SalesOrderResponse]: 订单列表
        """
        query = SalesOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        
        orders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SalesOrderResponse.model_validate(order) for order in orders]
    
    @staticmethod
    async def update_sales_order(
        tenant_id: int,
        order_uuid: str,
        data: SalesOrderUpdate
    ) -> SalesOrderResponse:
        """
        更新销售订单
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            data: 订单更新数据
            
        Returns:
            SalesOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await SalesOrder.filter(
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
        
        return SalesOrderResponse.model_validate(order)
    
    @staticmethod
    async def track_order(
        tenant_id: int,
        order_uuid: str
    ) -> Dict:
        """
        订单跟踪
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Returns:
            Dict: 订单跟踪信息（状态历史、进度信息）
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await SalesOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        # TODO: 查询生产进度（与MES集成）
        # TODO: 查询交付进度（与WMS集成）
        # TODO: 查询状态历史
        
        return {
            "order_uuid": order.uuid,
            "order_no": order.order_no,
            "status": order.status,
            "created_at": order.created_at.isoformat(),
            "updated_at": order.updated_at.isoformat(),
            # TODO: 添加生产进度、交付进度、状态历史等信息
        }
    
    @staticmethod
    async def change_order(
        tenant_id: int,
        order_uuid: str,
        change_data: dict,
        change_reason: str
    ) -> SalesOrderResponse:
        """
        订单变更
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            change_data: 变更数据
            change_reason: 变更原因
            
        Returns:
            SalesOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await SalesOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        # 更新订单字段
        for key, value in change_data.items():
            if hasattr(order, key):
                setattr(order, key, value)
        
        # TODO: 分析变更影响（生产计划、采购计划等）
        # TODO: 发送变更通知
        
        await order.save()
        
        return SalesOrderResponse.model_validate(order)
    
    @staticmethod
    async def deliver_order(
        tenant_id: int,
        order_uuid: str
    ) -> SalesOrderResponse:
        """
        订单交付
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            delivery_date: 交付日期（可选，默认当前时间）
            
        Returns:
            SalesOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await SalesOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        from datetime import datetime
        order.status = "已交付"
        # TODO: 记录实际交付日期
        
        await order.save()
        
        # TODO: 通知财务模块生成发票
        
        return SalesOrderResponse.model_validate(order)
    
    @staticmethod
    async def submit_for_approval(
        tenant_id: int,
        order_uuid: str,
        process_code: str,
        user_id: int
    ) -> SalesOrderResponse:
        """
        提交订单审批
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            process_code: 审批流程代码
            user_id: 提交人ID
            
        Returns:
            SalesOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单或审批流程不存在时抛出
            ValidationError: 当订单已提交审批时抛出
        """
        order = await SalesOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        # 检查是否已经提交审批
        if order.approval_instance_id:
            raise ValidationError("订单已提交审批，无法重复提交")
        
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
            title=f"销售订单审批：{order.order_no}",
            content=f"订单编号：{order.order_no}\n订单金额：{order.total_amount}\n客户ID：{order.customer_id}",
            data={
                "order_uuid": order_uuid,
                "order_no": order.order_no,
                "order_amount": float(order.total_amount),
                "customer_id": order.customer_id,
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
        
        return SalesOrderResponse.model_validate(order)
    
    @staticmethod
    async def get_approval_status(
        tenant_id: int,
        order_uuid: str
    ) -> Dict:
        """
        获取订单审批状态
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Returns:
            Dict: 审批状态信息
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await SalesOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        if not order.approval_instance_id:
            return {
                "has_approval": False,
                "approval_status": None,
                "approval_instance": None
            }
        
        # 获取审批实例
        from core.models.approval_instance import ApprovalInstance
        approval_instance = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            id=order.approval_instance_id,
            deleted_at__isnull=True
        ).prefetch_related("process").first()
        
        if not approval_instance:
            return {
                "has_approval": False,
                "approval_status": None,
                "approval_instance": None
            }
        
        # 获取审批历史
        from core.models.approval_history import ApprovalHistory
        histories = await ApprovalHistory.filter(
            tenant_id=tenant_id,
            approval_instance_id=approval_instance.id,
            deleted_at__isnull=True
        ).order_by("-action_at").all()
        
        return {
            "has_approval": True,
            "approval_status": approval_instance.status,
            "approval_instance": {
                "uuid": str(approval_instance.uuid),
                "title": approval_instance.title,
                "status": approval_instance.status,
                "current_node": approval_instance.current_node,
                "current_approver_id": approval_instance.current_approver_id,
                "submitter_id": approval_instance.submitter_id,
                "submitted_at": approval_instance.submitted_at.isoformat() if approval_instance.submitted_at else None,
                "completed_at": approval_instance.completed_at.isoformat() if approval_instance.completed_at else None,
            },
            "process": {
                "uuid": str(approval_instance.process.uuid),
                "name": approval_instance.process.name,
                "code": approval_instance.process.code,
            },
            "histories": [
                {
                    "action": h.action,
                    "action_by": h.action_by,
                    "action_at": h.action_at.isoformat() if h.action_at else None,
                    "comment": h.comment,
                    "from_node": h.from_node,
                    "to_node": h.to_node,
                }
                for h in histories
            ]
        }
    
    @staticmethod
    async def cancel_approval(
        tenant_id: int,
        order_uuid: str,
        user_id: int
    ) -> SalesOrderResponse:
        """
        取消订单审批
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            user_id: 操作人ID
            
        Returns:
            SalesOrderResponse: 更新后的订单对象
            
        Raises:
            NotFoundError: 当订单或审批实例不存在时抛出
            ValidationError: 当审批已完成时抛出
        """
        order = await SalesOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        if not order.approval_instance_id:
            raise ValidationError("订单未提交审批，无法取消")
        
        # 获取审批实例
        from core.models.approval_instance import ApprovalInstance
        approval_instance = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            id=order.approval_instance_id,
            deleted_at__isnull=True
        ).first()
        
        if not approval_instance:
            raise NotFoundError("审批实例不存在")
        
        # 如果审批已完成，无法取消
        if approval_instance.status not in ["pending"]:
            raise ValidationError(f"审批状态为 {approval_instance.status}，无法取消")
        
        # 执行取消操作
        from core.services.approval_instance_service import ApprovalInstanceService
        from core.schemas.approval_instance import ApprovalInstanceAction
        
        cancel_action = ApprovalInstanceAction(
            action="cancel",
            comment="订单审批已取消"
        )
        
        await ApprovalInstanceService.perform_approval_action(
            tenant_id=tenant_id,
            uuid=str(approval_instance.uuid),
            user_id=user_id,
            action=cancel_action
        )
        
        # 更新订单状态
        order.approval_status = "cancelled"
        order.status = "已关闭"
        await order.save()
        
        return SalesOrderResponse.model_validate(order)
    
    @staticmethod
    async def delete_sales_order(
        tenant_id: int,
        order_uuid: str
    ) -> None:
        """
        删除销售订单（软删除）
        
        Args:
            tenant_id: 租户ID
            order_uuid: 订单UUID
            
        Raises:
            NotFoundError: 当订单不存在时抛出
        """
        order = await SalesOrder.filter(
            tenant_id=tenant_id,
            uuid=order_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not order:
            raise NotFoundError(f"订单 {order_uuid} 不存在")
        
        from datetime import datetime
        order.deleted_at = datetime.utcnow()
        await order.save()
