"""
供应商协同服务模块

提供供应商协同功能，包括采购订单下发、进度同步、发货通知等。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.master_data.models.supply_chain import Supplier
from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class SupplierCollaborationService(BaseService):
    """
    供应商协同服务类
    
    提供供应商协同相关的业务逻辑处理。
    """
    
    def __init__(self):
        super().__init__(PurchaseOrder)
    
    async def send_purchase_order_to_supplier(
        self,
        tenant_id: int,
        purchase_order_id: int,
        send_by: int
    ) -> Dict[str, Any]:
        """
        下发采购订单到供应商协同平台
        
        将采购订单发送给供应商，供应商可以在协同平台查看和操作。
        
        Args:
            tenant_id: 组织ID
            purchase_order_id: 采购订单ID
            send_by: 发送人ID
        
        Returns:
            Dict[str, Any]: 下发结果
        """
        async with in_transaction():
            # 获取采购订单
            purchase_order = await PurchaseOrder.filter(
                tenant_id=tenant_id,
                id=purchase_order_id,
                deleted_at__isnull=True
            ).prefetch_related('items').first()
            
            if not purchase_order:
                raise NotFoundError(f"采购订单ID {purchase_order_id} 不存在")
            
            # 验证状态
            if purchase_order.status not in ['draft', 'approved']:
                raise BusinessLogicError(f"采购订单状态为 {purchase_order.status}，无法下发")
            
            # 获取供应商信息
            supplier = await Supplier.filter(
                tenant_id=tenant_id,
                id=purchase_order.supplier_id,
                deleted_at__isnull=True
            ).first()
            
            if not supplier:
                raise NotFoundError(f"供应商ID {purchase_order.supplier_id} 不存在")
            
            # 更新采购订单状态为已下发
            purchase_order.status = 'sent_to_supplier'
            await purchase_order.save()
            
            # TODO: 发送通知给供应商（通过消息系统或邮件）
            logger.info(f"采购订单 {purchase_order.order_code} 已下发给供应商 {supplier.name}")
            
            return {
                "success": True,
                "purchase_order_id": purchase_order_id,
                "purchase_order_code": purchase_order.order_code,
                "supplier_id": supplier.id,
                "supplier_name": supplier.name,
                "sent_at": datetime.now().isoformat(),
            }
    
    async def update_purchase_order_progress(
        self,
        tenant_id: int,
        purchase_order_id: int,
        progress_data: Dict[str, Any],
        updated_by: int
    ) -> Dict[str, Any]:
        """
        更新采购订单进度
        
        供应商可以更新采购订单的生产进度。
        
        Args:
            tenant_id: 组织ID
            purchase_order_id: 采购订单ID
            progress_data: 进度数据
                - progress_percentage: 完成百分比
                - estimated_delivery_date: 预计交货日期
                - remarks: 备注
            updated_by: 更新人ID
        
        Returns:
            Dict[str, Any]: 更新结果
        """
        async with in_transaction():
            # 获取采购订单
            purchase_order = await PurchaseOrder.filter(
                tenant_id=tenant_id,
                id=purchase_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not purchase_order:
                raise NotFoundError(f"采购订单ID {purchase_order_id} 不存在")
            
            # 更新进度信息
            progress_percentage = progress_data.get('progress_percentage', 0)
            estimated_delivery_date = progress_data.get('estimated_delivery_date')
            
            # 更新预计交货日期（使用delivery_date字段）
            if estimated_delivery_date:
                if isinstance(estimated_delivery_date, str):
                    from datetime import datetime
                    estimated_delivery_date = datetime.fromisoformat(estimated_delivery_date).date()
                purchase_order.delivery_date = estimated_delivery_date
            
            # 更新备注
            if progress_data.get('remarks'):
                if purchase_order.remarks:
                    purchase_order.remarks += f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {progress_data['remarks']}"
                else:
                    purchase_order.remarks = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {progress_data['remarks']}"
            
            await purchase_order.save()
            
            # TODO: 发送通知给采购人员（进度更新）
            logger.info(f"采购订单 {purchase_order.order_code} 进度已更新：{progress_percentage}%")
            
            return {
                "success": True,
                "purchase_order_id": purchase_order_id,
                "progress_percentage": progress_percentage,
                "estimated_delivery_date": estimated_delivery_date.isoformat() if estimated_delivery_date else None,
                "delivery_date": purchase_order.delivery_date.isoformat() if purchase_order.delivery_date else None,
                "updated_at": datetime.now().isoformat(),
            }
    
    async def submit_delivery_notice(
        self,
        tenant_id: int,
        purchase_order_id: int,
        delivery_data: Dict[str, Any],
        submitted_by: int
    ) -> Dict[str, Any]:
        """
        提交发货通知
        
        供应商提交发货通知，通知采购方准备收货。
        
        Args:
            tenant_id: 组织ID
            purchase_order_id: 采购订单ID
            delivery_data: 发货数据
                - delivery_quantity: 发货数量
                - delivery_date: 发货日期
                - tracking_number: 物流单号（可选）
                - remarks: 备注
            submitted_by: 提交人ID
        
        Returns:
            Dict[str, Any]: 提交结果
        """
        async with in_transaction():
            # 获取采购订单
            purchase_order = await PurchaseOrder.filter(
                tenant_id=tenant_id,
                id=purchase_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not purchase_order:
                raise NotFoundError(f"采购订单ID {purchase_order_id} 不存在")
            
            # 更新发货信息
            delivery_quantity = delivery_data.get('delivery_quantity', 0)
            delivery_date = delivery_data.get('delivery_date')
            tracking_number = delivery_data.get('tracking_number')
            
            # 更新备注中包含发货信息（因为模型中没有actual_delivery_date和tracking_number字段）
            delivery_info = f"发货数量: {delivery_quantity}"
            if delivery_date:
                if isinstance(delivery_date, str):
                    from datetime import datetime
                    delivery_date = datetime.fromisoformat(delivery_date).date()
                delivery_info += f", 发货日期: {delivery_date}"
            if tracking_number:
                delivery_info += f", 物流单号: {tracking_number}"
            
            # 更新备注
            delivery_remarks = f"[发货通知 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {delivery_info}"
            if delivery_data.get('remarks'):
                delivery_remarks += f" - {delivery_data['remarks']}"
            
            if purchase_order.remarks:
                purchase_order.remarks += f"\n{delivery_remarks}"
            else:
                purchase_order.remarks = delivery_remarks
            
            await purchase_order.save()
            
            # TODO: 发送通知给采购人员和仓库管理员（准备收货）
            logger.info(f"采购订单 {purchase_order.order_code} 已提交发货通知")
            
            return {
                "success": True,
                "purchase_order_id": purchase_order_id,
                "delivery_quantity": delivery_quantity,
                "delivery_date": delivery_date.isoformat() if delivery_date else None,
                "tracking_number": tracking_number,
                "submitted_at": datetime.now().isoformat(),
            }
    
    async def get_supplier_purchase_orders(
        self,
        tenant_id: int,
        supplier_id: int,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取供应商的采购订单列表
        
        供应商可以查看自己的采购订单。
        
        Args:
            tenant_id: 组织ID
            supplier_id: 供应商ID
            status: 订单状态（可选）
        
        Returns:
            List[Dict[str, Any]]: 采购订单列表
        """
        query = PurchaseOrder.filter(
            tenant_id=tenant_id,
            supplier_id=supplier_id,
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
                "total_amount": float(order.total_amount) if order.total_amount else 0.0,
                "status": order.status,
                "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            }
            for order in orders
        ]
