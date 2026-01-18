"""
委外协同服务模块

提供委外协同功能，包括委外订单下发、委外进度跟踪、委外协同消息等。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
from apps.master_data.models.supply_chain import Supplier
from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class OutsourceCollaborationService(BaseService):
    """
    委外协同服务类
    
    提供委外协同相关的业务逻辑处理。
    """
    
    def __init__(self):
        super().__init__(OutsourceWorkOrder)
    
    async def send_outsource_order_to_supplier(
        self,
        tenant_id: int,
        outsource_work_order_id: int,
        send_by: int
    ) -> Dict[str, Any]:
        """
        下发委外订单给供应商
        
        将委外订单发送给供应商，供应商可以在协同平台查看和操作。
        
        Args:
            tenant_id: 组织ID
            outsource_work_order_id: 委外工单ID
            send_by: 发送人ID
        
        Returns:
            Dict[str, Any]: 下发结果
        """
        async with in_transaction():
            # 获取委外工单
            outsource_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=outsource_work_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not outsource_work_order:
                raise NotFoundError(f"委外工单ID {outsource_work_order_id} 不存在")
            
            # 验证状态
            if outsource_work_order.status not in ['draft', 'released']:
                raise BusinessLogicError(f"委外工单状态为 {outsource_work_order.status}，无法下发")
            
            # 获取供应商信息
            supplier = await Supplier.filter(
                tenant_id=tenant_id,
                id=outsource_work_order.supplier_id,
                deleted_at__isnull=True
            ).first()
            
            if not supplier:
                raise NotFoundError(f"供应商ID {outsource_work_order.supplier_id} 不存在")
            
            # 更新委外工单状态为已下发
            outsource_work_order.status = 'in_progress'
            if not outsource_work_order.actual_start_date:
                outsource_work_order.actual_start_date = datetime.now()
            await outsource_work_order.save()
            
            # TODO: 发送通知给供应商（通过消息系统或邮件）
            logger.info(f"委外工单 {outsource_work_order.code} 已下发给供应商 {supplier.name}")
            
            return {
                "success": True,
                "outsource_work_order_id": outsource_work_order_id,
                "outsource_work_order_code": outsource_work_order.code,
                "supplier_id": supplier.id,
                "supplier_name": supplier.name,
                "sent_at": datetime.now().isoformat(),
            }
    
    async def update_outsource_progress(
        self,
        tenant_id: int,
        outsource_work_order_id: int,
        progress_data: Dict[str, Any],
        updated_by: int
    ) -> Dict[str, Any]:
        """
        更新委外进度
        
        供应商可以更新委外加工进度。
        
        Args:
            tenant_id: 组织ID
            outsource_work_order_id: 委外工单ID
            progress_data: 进度数据
                - completed_quantity: 已完成数量
                - progress_percentage: 完成百分比
                - remarks: 备注
            updated_by: 更新人ID
        
        Returns:
            Dict[str, Any]: 更新结果
        """
        async with in_transaction():
            # 获取委外工单
            outsource_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=outsource_work_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not outsource_work_order:
                raise NotFoundError(f"委外工单ID {outsource_work_order_id} 不存在")
            
            # 更新进度信息
            completed_quantity = progress_data.get('completed_quantity', 0)
            progress_percentage = progress_data.get('progress_percentage', 0)
            
            # 计算进度百分比
            if outsource_work_order.quantity > 0:
                calculated_percentage = (completed_quantity / outsource_work_order.quantity) * 100
                if progress_percentage == 0:
                    progress_percentage = calculated_percentage
            
            # 更新备注
            if progress_data.get('remarks'):
                if outsource_work_order.remarks:
                    outsource_work_order.remarks += f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {progress_data['remarks']}"
                else:
                    outsource_work_order.remarks = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {progress_data['remarks']}"
            
            await outsource_work_order.save()
            
            logger.info(f"委外工单 {outsource_work_order.code} 进度已更新：{progress_percentage}%")
            
            return {
                "success": True,
                "outsource_work_order_id": outsource_work_order_id,
                "progress_percentage": progress_percentage,
                "updated_at": datetime.now().isoformat(),
            }
    
    async def submit_outsource_completion(
        self,
        tenant_id: int,
        outsource_work_order_id: int,
        completion_data: Dict[str, Any],
        submitted_by: int
    ) -> Dict[str, Any]:
        """
        提交委外完工申请
        
        供应商提交委外加工完成申请，等待验收。
        
        Args:
            tenant_id: 组织ID
            outsource_work_order_id: 委外工单ID
            completion_data: 完工数据
                - completed_quantity: 完成数量
                - qualified_quantity: 合格数量
                - unqualified_quantity: 不合格数量
                - remarks: 备注
            submitted_by: 提交人ID
        
        Returns:
            Dict[str, Any]: 提交结果
        """
        async with in_transaction():
            # 获取委外工单
            outsource_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=outsource_work_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not outsource_work_order:
                raise NotFoundError(f"委外工单ID {outsource_work_order_id} 不存在")
            
            # 验证状态
            if outsource_work_order.status != 'in_progress':
                raise BusinessLogicError(f"委外工单状态为 {outsource_work_order.status}，无法提交完工申请")
            
            # 更新完工信息
            completed_quantity = completion_data.get('completed_quantity', 0)
            qualified_quantity = completion_data.get('qualified_quantity', 0)
            unqualified_quantity = completion_data.get('unqualified_quantity', 0)
            
            # 验证数量
            if completed_quantity != qualified_quantity + unqualified_quantity:
                raise ValidationError("完成数量必须等于合格数量加不合格数量")
            
            # 更新委外工单（等待验收）
            outsource_work_order.received_quantity = completed_quantity
            outsource_work_order.qualified_quantity = qualified_quantity
            outsource_work_order.unqualified_quantity = unqualified_quantity
            
            if completion_data.get('remarks'):
                if outsource_work_order.remarks:
                    outsource_work_order.remarks += f"\n[完工申请 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {completion_data['remarks']}"
                else:
                    outsource_work_order.remarks = f"[完工申请 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {completion_data['remarks']}"
            
            await outsource_work_order.save()
            
            # TODO: 发送通知给采购人员（等待验收）
            logger.info(f"委外工单 {outsource_work_order.code} 已提交完工申请，等待验收")
            
            return {
                "success": True,
                "outsource_work_order_id": outsource_work_order_id,
                "completed_quantity": completed_quantity,
                "qualified_quantity": qualified_quantity,
                "unqualified_quantity": unqualified_quantity,
                "submitted_at": datetime.now().isoformat(),
            }
    
    async def get_supplier_outsource_orders(
        self,
        tenant_id: int,
        supplier_id: int,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取供应商的委外订单列表
        
        供应商可以查看自己的委外订单。
        
        Args:
            tenant_id: 组织ID
            supplier_id: 供应商ID
            status: 订单状态（可选）
        
        Returns:
            List[Dict[str, Any]]: 委外订单列表
        """
        query = OutsourceWorkOrder.filter(
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
                "code": order.code,
                "name": order.name,
                "product_code": order.product_code,
                "product_name": order.product_name,
                "quantity": float(order.quantity),
                "unit_price": float(order.unit_price) if order.unit_price else None,
                "total_amount": float(order.total_amount),
                "status": order.status,
                "planned_start_date": order.planned_start_date.isoformat() if order.planned_start_date else None,
                "planned_end_date": order.planned_end_date.isoformat() if order.planned_end_date else None,
                "actual_start_date": order.actual_start_date.isoformat() if order.actual_start_date else None,
                "received_quantity": float(order.received_quantity),
                "qualified_quantity": float(order.qualified_quantity),
                "unqualified_quantity": float(order.unqualified_quantity),
            }
            for order in orders
        ]
