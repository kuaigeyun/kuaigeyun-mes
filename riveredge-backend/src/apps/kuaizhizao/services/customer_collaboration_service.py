"""
客户协同服务模块

提供客户协同功能，包括销售订单查看、生产进度查看等。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from loguru import logger

from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.master_data.models.customer import Customer
from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class CustomerCollaborationService(BaseService):
    """
    客户协同服务类
    
    提供客户协同相关的业务逻辑处理。
    """
    
    def __init__(self):
        super().__init__(SalesOrder)
    
    async def get_customer_sales_orders(
        self,
        tenant_id: int,
        customer_id: int,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取客户的销售订单列表
        
        客户可以查看自己的销售订单。
        
        Args:
            tenant_id: 组织ID
            customer_id: 客户ID
            status: 订单状态（可选）
        
        Returns:
            List[Dict[str, Any]]: 销售订单列表
        """
        query = SalesOrder.filter(
            tenant_id=tenant_id,
            customer_id=customer_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        orders = await query.order_by('-created_at').all()
        
        return [
            {
                "id": order.id,
                "code": order.order_code,
                "order_date": order.order_date.isoformat() if order.order_date else None,
                "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
                "total_amount": float(order.total_amount) if order.total_amount else 0.0,
                "status": order.status,
            }
            for order in orders
        ]
    
    async def get_sales_order_production_progress(
        self,
        tenant_id: int,
        sales_order_id: int
    ) -> Dict[str, Any]:
        """
        获取销售订单的生产进度
        
        客户可以查看订单关联的生产进度。
        
        Args:
            tenant_id: 组织ID
            sales_order_id: 销售订单ID
        
        Returns:
            Dict[str, Any]: 生产进度信息
        """
        # 获取销售订单
        sales_order = await SalesOrder.filter(
            tenant_id=tenant_id,
            id=sales_order_id,
            deleted_at__isnull=True
        ).first()
        
        if not sales_order:
            raise NotFoundError(f"销售订单ID {sales_order_id} 不存在")
        
        # 查找关联的工单
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            deleted_at__isnull=True
        ).all()
        
        # 计算生产进度
        total_work_orders = len(work_orders)
        completed_work_orders = sum(1 for wo in work_orders if wo.status == 'completed')
        in_progress_work_orders = sum(1 for wo in work_orders if wo.status == 'in_progress')
        
        progress_percentage = (completed_work_orders / total_work_orders * 100) if total_work_orders > 0 else 0
        
        # 获取工单详情
        work_order_details = []
        for wo in work_orders:
            work_order_details.append({
                "work_order_id": wo.id,
                "work_order_code": wo.code,
                "product_code": wo.product_code,
                "product_name": wo.product_name,
                "quantity": float(wo.quantity) if wo.quantity else 0.0,
                "completed_quantity": float(wo.completed_quantity) if wo.completed_quantity else 0.0,
                "status": wo.status,
                "planned_start_date": wo.planned_start_date.isoformat() if wo.planned_start_date else None,
                "planned_end_date": wo.planned_end_date.isoformat() if wo.planned_end_date else None,
                "actual_start_date": wo.actual_start_date.isoformat() if wo.actual_start_date else None,
                "actual_end_date": wo.actual_end_date.isoformat() if wo.actual_end_date else None,
            })
        
        return {
            "sales_order_id": sales_order_id,
            "sales_order_code": sales_order.order_code,
            "total_work_orders": total_work_orders,
            "completed_work_orders": completed_work_orders,
            "in_progress_work_orders": in_progress_work_orders,
            "progress_percentage": progress_percentage,
            "work_orders": work_order_details,
            "updated_at": datetime.now().isoformat(),
        }
    
    async def get_customer_order_summary(
        self,
        tenant_id: int,
        customer_id: int
    ) -> Dict[str, Any]:
        """
        获取客户订单汇总
        
        客户可以查看订单汇总信息。
        
        Args:
            tenant_id: 组织ID
            customer_id: 客户ID
        
        Returns:
            Dict[str, Any]: 订单汇总信息
        """
        # 获取客户信息
        customer = await Customer.filter(
            tenant_id=tenant_id,
            id=customer_id,
            deleted_at__isnull=True
        ).first()
        
        if not customer:
            raise NotFoundError(f"客户ID {customer_id} 不存在")
        
        # 统计订单信息
        all_orders = await SalesOrder.filter(
            tenant_id=tenant_id,
            customer_id=customer_id,
            deleted_at__isnull=True
        ).all()
        
        total_orders = len(all_orders)
        pending_orders = sum(1 for o in all_orders if o.status == 'pending')
        in_progress_orders = sum(1 for o in all_orders if o.status == 'in_progress')
        completed_orders = sum(1 for o in all_orders if o.status == 'completed')
        total_amount = sum(float(o.total_amount) if o.total_amount else 0.0 for o in all_orders)
        
        return {
            "customer_id": customer_id,
            "customer_name": customer.name,
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "in_progress_orders": in_progress_orders,
            "completed_orders": completed_orders,
            "total_amount": total_amount,
            "updated_at": datetime.now().isoformat(),
        }
