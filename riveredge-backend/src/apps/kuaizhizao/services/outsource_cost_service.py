"""
委外成本核算服务模块

提供基于物料来源类型的委外成本核算功能。

Author: Luigi Lu
Date: 2026-01-16
"""

import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from apps.master_data.models.material import Material
from apps.kuaizhizao.models.outsource_work_order import (
    OutsourceWorkOrder,
    OutsourceMaterialIssue,
    OutsourceMaterialReceipt,
)


class OutsourceCostService:
    """
    委外成本核算服务类
    
    处理基于物料来源类型的委外成本核算业务逻辑。
    """

    async def calculate_outsource_cost(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        outsource_work_order_id: Optional[int] = None,
        quantity: Optional[Decimal] = None,
        calculation_date: Optional[date] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        核算委外成本
        
        委外成本 = 材料成本（提供给委外供应商的原材料）+ 委外加工费用（委外数量 × 委外单价）
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID（委外件物料ID，可选，如果提供material_id则计算标准成本）
            outsource_work_order_id: 委外工单ID（可选，如果提供则计算实际成本）
            quantity: 数量（可选，如果提供material_id则必须提供quantity）
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 成本核算结果
            
        Raises:
            NotFoundError: 物料或委外工单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        if material_id:
            # 基于物料ID计算标准委外成本
            return await self._calculate_outsource_standard_cost(
                tenant_id=tenant_id,
                material_id=material_id,
                quantity=quantity or Decimal(1),
                calculation_date=calculation_date or date.today(),
                created_by=created_by
            )
        elif outsource_work_order_id:
            # 基于委外工单ID计算实际委外成本
            return await self._calculate_outsource_actual_cost(
                tenant_id=tenant_id,
                outsource_work_order_id=outsource_work_order_id,
                calculation_date=calculation_date or date.today()
            )
        else:
            raise ValidationError("必须提供material_id或outsource_work_order_id之一")

    async def _calculate_outsource_standard_cost(
        self,
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        计算标准委外成本
        
        根据物料的BOM和配置计算标准委外成本。
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID
            quantity: 数量
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 标准委外成本核算结果
        """
        # 获取物料信息
        material = await Material.filter(
            tenant_id=tenant_id,
            id=material_id,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_id} 不存在")
        
        source_type = material.source_type or "Make"
        if source_type != "Outsource":
            raise BusinessLogicError(f"物料 {material.main_code} 不是委外件（source_type: {source_type}）")
        
        # 1. 计算材料成本（提供给委外供应商的原材料）
        # 从物料的BOM获取需要提供给委外供应商的原材料
        material_cost, material_cost_breakdown = await self._calculate_outsource_material_cost(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity
        )
        
        # 2. 计算委外加工费用
        # 从物料的source_config或默认值获取委外单价
        processing_cost, processing_cost_breakdown = await self._calculate_outsource_processing_cost(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity
        )
        
        # 3. 计算总成本和单位成本
        total_cost = material_cost + processing_cost
        unit_cost = total_cost / quantity if quantity > 0 else Decimal(0)
        
        return {
            "material_id": material.id,
            "material_code": material.main_code,
            "material_name": material.name,
            "source_type": "Outsource",
            "quantity": quantity,
            "material_cost": material_cost,
            "processing_cost": processing_cost,
            "total_cost": total_cost,
            "unit_cost": unit_cost,
            "cost_details": {
                "material_cost_breakdown": material_cost_breakdown,
                "processing_cost_breakdown": processing_cost_breakdown,
            },
            "calculation_type": "标准成本",
            "calculation_date": calculation_date,
        }

    async def _calculate_outsource_actual_cost(
        self,
        tenant_id: int,
        outsource_work_order_id: int,
        calculation_date: date
    ) -> Dict[str, Any]:
        """
        计算实际委外成本
        
        根据委外工单的实际发料和费用计算实际委外成本。
        
        Args:
            tenant_id: 组织ID
            outsource_work_order_id: 委外工单ID
            calculation_date: 核算日期
            
        Returns:
            Dict[str, Any]: 实际委外成本核算结果
        """
        # 获取委外工单
        outsource_work_order = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=outsource_work_order_id,
            deleted_at__isnull=True
        ).first()
        
        if not outsource_work_order:
            raise NotFoundError(f"委外工单 {outsource_work_order_id} 不存在")
        
        # 1. 计算材料成本（已发料给委外供应商的原材料）
        material_cost, material_cost_breakdown = await self._calculate_actual_material_cost(
            tenant_id=tenant_id,
            outsource_work_order=outsource_work_order
        )
        
        # 2. 计算委外加工费用（委外数量 × 委外单价）
        processing_cost, processing_cost_breakdown = await self._calculate_actual_processing_cost(
            outsource_work_order=outsource_work_order
        )
        
        # 3. 计算总成本和单位成本
        total_cost = material_cost + processing_cost
        unit_cost = total_cost / outsource_work_order.quantity if outsource_work_order.quantity > 0 else Decimal(0)
        
        return {
            "outsource_work_order_id": outsource_work_order.id,
            "outsource_work_order_code": outsource_work_order.code,
            "material_id": outsource_work_order.product_id,
            "material_code": outsource_work_order.product_code,
            "material_name": outsource_work_order.product_name,
            "supplier_id": outsource_work_order.supplier_id,
            "supplier_code": outsource_work_order.supplier_code,
            "supplier_name": outsource_work_order.supplier_name,
            "quantity": outsource_work_order.quantity,
            "material_cost": material_cost,
            "processing_cost": processing_cost,
            "total_cost": total_cost,
            "unit_cost": unit_cost,
            "cost_details": {
                "material_cost_breakdown": material_cost_breakdown,
                "processing_cost_breakdown": processing_cost_breakdown,
            },
            "calculation_type": "实际成本",
            "calculation_date": calculation_date,
        }

    async def _calculate_outsource_material_cost(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算委外材料成本（标准成本）
        
        从物料的BOM获取需要提供给委外供应商的原材料，并计算成本。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (材料成本, 成本明细)
        """
        from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id
        
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 获取BOM明细
        bom_items = await get_bom_items_by_material_id(
            tenant_id=tenant_id,
            material_id=material.id,
            only_approved=True
        )
        
        if not bom_items:
            logger.warning(f"委外件 {material.main_code} 没有BOM，材料成本为0")
            return Decimal(0), []
        
        for bom_item in bom_items:
            component = await bom_item.component
            if not component:
                continue
            
            # 计算子件数量（考虑损耗率）
            component_qty = Decimal(str(bom_item.quantity)) * quantity * (
                Decimal(1) + Decimal(str(bom_item.waste_rate)) / Decimal(100)
            )
            
            # 获取物料单价
            unit_price = await self._get_material_unit_price(
                tenant_id=tenant_id,
                material=component
            )
            
            # 计算材料成本
            item_cost = component_qty * unit_price
            total_cost += item_cost
            
            cost_breakdown.append({
                "material_id": component.id,
                "material_code": component.main_code,
                "material_name": component.name,
                "quantity": float(component_qty),
                "unit": bom_item.unit or component.base_unit,
                "unit_price": float(unit_price),
                "cost": float(item_cost),
                "waste_rate": float(bom_item.waste_rate),
            })
        
        return total_cost, cost_breakdown

    async def _calculate_actual_material_cost(
        self,
        tenant_id: int,
        outsource_work_order: OutsourceWorkOrder
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算实际材料成本
        
        从委外工单的发料记录获取实际发料成本。
        
        Args:
            tenant_id: 组织ID
            outsource_work_order: 委外工单对象
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (材料成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 获取委外发料记录
        material_issues = await OutsourceMaterialIssue.filter(
            tenant_id=tenant_id,
            outsource_work_order_id=outsource_work_order.id,
            status="completed",  # 只计算已完成的发料
            deleted_at__isnull=True
        ).all()
        
        for issue in material_issues:
            # 获取物料信息
            material = await Material.filter(
                tenant_id=tenant_id,
                id=issue.material_id,
                deleted_at__isnull=True
            ).first()
            
            if not material:
                continue
            
            # 获取物料单价
            unit_price = await self._get_material_unit_price(
                tenant_id=tenant_id,
                material=material
            )
            
            # 计算材料成本
            item_cost = issue.quantity * unit_price
            total_cost += item_cost
            
            cost_breakdown.append({
                "issue_id": issue.id,
                "issue_code": issue.code,
                "material_id": material.id,
                "material_code": material.main_code,
                "material_name": material.name,
                "quantity": float(issue.quantity),
                "unit": issue.unit,
                "unit_price": float(unit_price),
                "cost": float(item_cost),
                "issued_at": issue.issued_at.isoformat() if issue.issued_at else None,
            })
        
        return total_cost, cost_breakdown

    async def _calculate_outsource_processing_cost(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算委外加工费用（标准成本）
        
        从物料的source_config获取委外单价，或使用默认值。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (加工费用, 费用明细)
        """
        # 从物料的source_config获取委外单价
        source_config = material.source_config or {}
        unit_price = source_config.get("unit_price")
        
        if unit_price:
            unit_price = Decimal(str(unit_price))
        else:
            # 如果没有配置，使用默认值或从物料默认值获取
            defaults = material.defaults or {}
            purchase_defaults = defaults.get("purchase", {})
            unit_price = Decimal(str(purchase_defaults.get("standard_price", 100.00)))
        
        # 计算委外加工费用
        processing_cost = quantity * unit_price
        
        cost_breakdown = [{
            "quantity": float(quantity),
            "unit_price": float(unit_price),
            "cost": float(processing_cost),
            "source": "source_config" if source_config.get("unit_price") else "default",
        }]
        
        return processing_cost, cost_breakdown

    async def _calculate_actual_processing_cost(
        self,
        outsource_work_order: OutsourceWorkOrder
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算实际委外加工费用
        
        从委外工单获取实际委外数量和单价，计算加工费用。
        
        Args:
            outsource_work_order: 委外工单对象
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (加工费用, 费用明细)
        """
        # 获取委外单价（优先使用委外工单的单价，如果没有则从物料获取）
        unit_price = outsource_work_order.unit_price
        
        if not unit_price or unit_price == 0:
            # 如果没有单价，从物料的source_config获取
            material = await Material.filter(
                tenant_id=outsource_work_order.tenant_id,
                id=outsource_work_order.product_id,
                deleted_at__isnull=True
            ).first()
            
            if material:
                source_config = material.source_config or {}
                unit_price = source_config.get("unit_price")
                if unit_price:
                    unit_price = Decimal(str(unit_price))
                else:
                    # 使用默认值
                    unit_price = Decimal(100.00)
            else:
                unit_price = Decimal(100.00)
        else:
            unit_price = Decimal(str(unit_price))
        
        # 计算委外加工费用（委外数量 × 委外单价）
        quantity = outsource_work_order.quantity
        processing_cost = quantity * unit_price
        
        cost_breakdown = [{
            "quantity": float(quantity),
            "unit_price": float(unit_price),
            "cost": float(processing_cost),
            "source": "work_order" if outsource_work_order.unit_price else "material_config",
        }]
        
        return processing_cost, cost_breakdown

    async def _get_material_unit_price(
        self,
        tenant_id: int,
        material: Material
    ) -> Decimal:
        """
        获取物料单价
        
        从物料的默认值或价格表获取单价。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            
        Returns:
            Decimal: 单价
        """
        # TODO: 从物料默认值（defaults.purchase.standard_price）或价格表获取
        # 这里简化处理，使用默认值
        defaults = material.defaults or {}
        purchase_defaults = defaults.get("purchase", {})
        standard_price = purchase_defaults.get("standard_price")
        
        if standard_price:
            return Decimal(str(standard_price))
        
        # 默认单价
        return Decimal(100.00)
