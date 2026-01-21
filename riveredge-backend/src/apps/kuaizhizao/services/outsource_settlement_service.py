"""
委外结算服务模块

提供委外结算功能，包括委外费用计算、委外对账、委外结算单生成等。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder, OutsourceMaterialReceipt
from apps.master_data.models.supplier import Supplier
from core.services.base import BaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class OutsourceSettlementService(BaseService):
    """
    委外结算服务类
    
    提供委外结算相关的业务逻辑处理。
    """
    
    def __init__(self):
        super().__init__(OutsourceWorkOrder)
    
    async def calculate_outsource_cost(
        self,
        tenant_id: int,
        outsource_work_order_id: int
    ) -> Dict[str, Any]:
        """
        计算委外费用
        
        根据委外工单的实际收货数量计算委外费用。
        
        Args:
            tenant_id: 组织ID
            outsource_work_order_id: 委外工单ID
        
        Returns:
            Dict[str, Any]: 委外费用计算结果
        """
        # 获取委外工单
        outsource_work_order = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=outsource_work_order_id,
            deleted_at__isnull=True
        ).first()
        
        if not outsource_work_order:
            raise NotFoundError(f"委外工单ID {outsource_work_order_id} 不存在")
        
        # 计算委外费用（基于合格数量）
        qualified_quantity = Decimal(str(outsource_work_order.qualified_quantity))
        unit_price = Decimal(str(outsource_work_order.unit_price)) if outsource_work_order.unit_price else Decimal("0")
        
        # 委外加工费用 = 合格数量 × 委外单价
        processing_cost = qualified_quantity * unit_price
        
        # 获取委外发料成本（如果有）
        # TODO: 从委外发料记录中获取材料成本
        
        return {
            "outsource_work_order_id": outsource_work_order_id,
            "outsource_work_order_code": outsource_work_order.code,
            "qualified_quantity": float(qualified_quantity),
            "unit_price": float(unit_price),
            "processing_cost": float(processing_cost),
            "material_cost": 0.0,  # TODO: 计算材料成本
            "total_cost": float(processing_cost),
            "calculated_at": datetime.now().isoformat(),
        }
    
    async def create_settlement_statement(
        self,
        tenant_id: int,
        supplier_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        outsource_work_order_ids: Optional[List[int]] = None,
        created_by: int = None
    ) -> Dict[str, Any]:
        """
        创建委外结算单
        
        根据委外工单生成委外结算单，用于对账和结算。
        
        Args:
            tenant_id: 组织ID
            supplier_id: 供应商ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            outsource_work_order_ids: 委外工单ID列表（可选）
            created_by: 创建人ID
        
        Returns:
            Dict[str, Any]: 委外结算单
        """
        async with in_transaction():
            # 获取供应商信息
            supplier = await Supplier.filter(
                tenant_id=tenant_id,
                id=supplier_id,
                deleted_at__isnull=True
            ).first()
            
            if not supplier:
                raise NotFoundError(f"供应商ID {supplier_id} 不存在")
            
            # 查询委外工单
            query = OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                supplier_id=supplier_id,
                status='completed',
                deleted_at__isnull=True
            )
            
            if start_date:
                query = query.filter(actual_end_date__gte=start_date)
            
            if end_date:
                query = query.filter(actual_end_date__lte=end_date)
            
            if outsource_work_order_ids:
                query = query.filter(id__in=outsource_work_order_ids)
            
            orders = await query.all()
            
            if not orders:
                raise BusinessLogicError("没有符合条件的委外工单")
            
            # 计算结算金额
            total_amount = Decimal("0")
            settlement_items = []
            
            for order in orders:
                # 计算每个工单的费用
                cost_info = await self.calculate_outsource_cost(tenant_id, order.id)
                
                total_amount += Decimal(str(cost_info['total_cost']))
                
                settlement_items.append({
                    "outsource_work_order_id": order.id,
                    "outsource_work_order_code": order.code,
                    "product_code": order.product_code,
                    "product_name": order.product_name,
                    "qualified_quantity": cost_info['qualified_quantity'],
                    "unit_price": cost_info['unit_price'],
                    "processing_cost": cost_info['processing_cost'],
                    "material_cost": cost_info['material_cost'],
                    "total_cost": cost_info['total_cost'],
                })
            
            # 生成结算单编码
            today = datetime.now().strftime("%Y%m%d")
            settlement_code = f"OSS-{today}-{supplier.code}"
            
            # TODO: 创建结算单记录（需要创建结算单模型）
            
            logger.info(f"创建委外结算单成功: {settlement_code}，供应商: {supplier.name}，总金额: {total_amount}")
            
            return {
                "settlement_code": settlement_code,
                "supplier_id": supplier_id,
                "supplier_code": supplier.code,
                "supplier_name": supplier.name,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "total_amount": float(total_amount),
                "item_count": len(settlement_items),
                "items": settlement_items,
                "created_at": datetime.now().isoformat(),
            }
    
    async def reconcile_outsource_orders(
        self,
        tenant_id: int,
        supplier_id: int,
        reconciliation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        委外对账
        
        与供应商对账，确认委外费用。
        
        Args:
            tenant_id: 组织ID
            supplier_id: 供应商ID
            reconciliation_data: 对账数据
                - outsource_work_order_ids: 委外工单ID列表
                - confirmed_amount: 确认金额
                - remarks: 备注
        
        Returns:
            Dict[str, Any]: 对账结果
        """
        async with in_transaction():
            # 获取供应商信息
            supplier = await Supplier.filter(
                tenant_id=tenant_id,
                id=supplier_id,
                deleted_at__isnull=True
            ).first()
            
            if not supplier:
                raise NotFoundError(f"供应商ID {supplier_id} 不存在")
            
            outsource_work_order_ids = reconciliation_data.get('outsource_work_order_ids', [])
            confirmed_amount = Decimal(str(reconciliation_data.get('confirmed_amount', 0)))
            
            # 计算实际金额
            calculated_amount = Decimal("0")
            for order_id in outsource_work_order_ids:
                cost_info = await self.calculate_outsource_cost(tenant_id, order_id)
                calculated_amount += Decimal(str(cost_info['total_cost']))
            
            # 检查金额差异
            amount_difference = confirmed_amount - calculated_amount
            
            # TODO: 创建对账记录（需要创建对账模型）
            
            logger.info(f"委外对账完成: 供应商 {supplier.name}，计算金额: {calculated_amount}，确认金额: {confirmed_amount}，差异: {amount_difference}")
            
            return {
                "supplier_id": supplier_id,
                "supplier_name": supplier.name,
                "calculated_amount": float(calculated_amount),
                "confirmed_amount": float(confirmed_amount),
                "amount_difference": float(amount_difference),
                "reconciled_at": datetime.now().isoformat(),
            }
