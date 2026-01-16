"""
采购成本核算服务模块

提供基于物料来源类型的采购成本核算功能。

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
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem


class PurchaseCostService:
    """
    采购成本核算服务类
    
    处理基于物料来源类型的采购成本核算业务逻辑。
    """

    async def calculate_purchase_cost(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        purchase_order_id: Optional[int] = None,
        purchase_order_item_id: Optional[int] = None,
        quantity: Optional[Decimal] = None,
        calculation_date: Optional[date] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        核算采购成本
        
        采购成本 = 采购价格 + 采购费用
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID（采购件物料ID，可选，如果提供material_id则计算标准成本）
            purchase_order_id: 采购订单ID（可选，如果提供则计算实际成本）
            purchase_order_item_id: 采购订单明细ID（可选，如果提供则计算特定订单行的实际成本）
            quantity: 数量（可选，如果提供material_id则必须提供quantity）
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 成本核算结果
            
        Raises:
            NotFoundError: 物料或采购订单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        if material_id:
            # 基于物料ID计算标准采购成本
            return await self._calculate_purchase_standard_cost(
                tenant_id=tenant_id,
                material_id=material_id,
                quantity=quantity or Decimal(1),
                calculation_date=calculation_date or date.today(),
                created_by=created_by
            )
        elif purchase_order_item_id:
            # 基于采购订单明细ID计算实际采购成本
            return await self._calculate_purchase_actual_cost_from_item(
                tenant_id=tenant_id,
                purchase_order_item_id=purchase_order_item_id,
                calculation_date=calculation_date or date.today()
            )
        elif purchase_order_id:
            # 基于采购订单ID计算实际采购成本（整单）
            return await self._calculate_purchase_actual_cost_from_order(
                tenant_id=tenant_id,
                purchase_order_id=purchase_order_id,
                calculation_date=calculation_date or date.today()
            )
        else:
            raise ValidationError("必须提供material_id、purchase_order_id或purchase_order_item_id之一")

    async def _calculate_purchase_standard_cost(
        self,
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        计算标准采购成本
        
        根据物料的默认价格和配置计算标准采购成本。
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID
            quantity: 数量
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 标准采购成本核算结果
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
        if source_type != "Buy":
            raise BusinessLogicError(f"物料 {material.main_code} 不是采购件（source_type: {source_type}）")
        
        # 1. 计算采购价格
        purchase_price, purchase_price_breakdown = await self._calculate_purchase_price(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity
        )
        
        # 2. 计算采购费用
        purchase_fee, purchase_fee_breakdown = await self._calculate_purchase_fee(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity,
            purchase_price=purchase_price
        )
        
        # 3. 计算总成本和单位成本
        total_cost = purchase_price + purchase_fee
        unit_cost = total_cost / quantity if quantity > 0 else Decimal(0)
        
        return {
            "material_id": material.id,
            "material_code": material.main_code,
            "material_name": material.name,
            "source_type": "Buy",
            "quantity": quantity,
            "purchase_price": purchase_price,
            "purchase_fee": purchase_fee,
            "total_cost": total_cost,
            "unit_cost": unit_cost,
            "cost_details": {
                "purchase_price_breakdown": purchase_price_breakdown,
                "purchase_fee_breakdown": purchase_fee_breakdown,
            },
            "calculation_type": "标准成本",
            "calculation_date": calculation_date,
        }

    async def _calculate_purchase_actual_cost_from_item(
        self,
        tenant_id: int,
        purchase_order_item_id: int,
        calculation_date: date
    ) -> Dict[str, Any]:
        """
        计算实际采购成本（基于采购订单明细）
        
        根据采购订单明细的实际价格和费用计算实际采购成本。
        
        Args:
            tenant_id: 组织ID
            purchase_order_item_id: 采购订单明细ID
            calculation_date: 核算日期
            
        Returns:
            Dict[str, Any]: 实际采购成本核算结果
        """
        # 获取采购订单明细
        order_item = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            id=purchase_order_item_id,
            deleted_at__isnull=True
        ).prefetch_related("order").first()
        
        if not order_item:
            raise NotFoundError(f"采购订单明细 {purchase_order_item_id} 不存在")
        
        order = await order_item.order
        
        # 1. 计算采购价格（订单明细的单价 × 数量）
        purchase_price = order_item.unit_price * order_item.ordered_quantity
        purchase_price_breakdown = [{
            "order_item_id": order_item.id,
            "order_code": order.order_code if order else None,
            "material_id": order_item.material_id,
            "material_code": order_item.material_code,
            "material_name": order_item.material_name,
            "quantity": float(order_item.ordered_quantity),
            "unit": order_item.unit,
            "unit_price": float(order_item.unit_price),
            "price": float(purchase_price),
        }]
        
        # 2. 计算采购费用（从订单头获取税费等）
        purchase_fee, purchase_fee_breakdown = await self._calculate_actual_purchase_fee(
            order=order,
            order_item=order_item,
            purchase_price=purchase_price
        )
        
        # 3. 计算总成本和单位成本
        total_cost = purchase_price + purchase_fee
        unit_cost = total_cost / order_item.ordered_quantity if order_item.ordered_quantity > 0 else Decimal(0)
        
        return {
            "purchase_order_id": order.id if order else None,
            "purchase_order_code": order.order_code if order else None,
            "purchase_order_item_id": order_item.id,
            "material_id": order_item.material_id,
            "material_code": order_item.material_code,
            "material_name": order_item.material_name,
            "supplier_id": order.supplier_id if order else None,
            "supplier_name": order.supplier_name if order else None,
            "quantity": order_item.ordered_quantity,
            "purchase_price": purchase_price,
            "purchase_fee": purchase_fee,
            "total_cost": total_cost,
            "unit_cost": unit_cost,
            "cost_details": {
                "purchase_price_breakdown": purchase_price_breakdown,
                "purchase_fee_breakdown": purchase_fee_breakdown,
            },
            "calculation_type": "实际成本",
            "calculation_date": calculation_date,
        }

    async def _calculate_purchase_actual_cost_from_order(
        self,
        tenant_id: int,
        purchase_order_id: int,
        calculation_date: date
    ) -> Dict[str, Any]:
        """
        计算实际采购成本（基于采购订单，整单核算）
        
        根据采购订单的所有明细计算实际采购成本。
        
        Args:
            tenant_id: 组织ID
            purchase_order_id: 采购订单ID
            calculation_date: 核算日期
            
        Returns:
            Dict[str, Any]: 实际采购成本核算结果（整单汇总）
        """
        # 获取采购订单
        order = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            id=purchase_order_id,
            deleted_at__isnull=True
        ).prefetch_related("items").first()
        
        if not order:
            raise NotFoundError(f"采购订单 {purchase_order_id} 不存在")
        
        # 获取订单明细
        order_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            order_id=order.id,
            deleted_at__isnull=True
        ).all()
        
        if not order_items:
            raise NotFoundError(f"采购订单 {purchase_order_id} 没有明细")
        
        # 汇总所有明细的成本
        total_purchase_price = Decimal(0)
        total_purchase_fee = Decimal(0)
        purchase_price_breakdown = []
        
        for item in order_items:
            # 计算每个明细的采购价格
            item_price = item.unit_price * item.ordered_quantity
            total_purchase_price += item_price
            
            purchase_price_breakdown.append({
                "order_item_id": item.id,
                "material_id": item.material_id,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "quantity": float(item.ordered_quantity),
                "unit": item.unit,
                "unit_price": float(item.unit_price),
                "price": float(item_price),
            })
        
        # 计算采购费用（按比例分摊到各明细，或整单计算）
        purchase_fee, purchase_fee_breakdown = await self._calculate_actual_purchase_fee(
            order=order,
            order_item=None,  # 整单计算
            purchase_price=total_purchase_price
        )
        total_purchase_fee = purchase_fee
        
        # 计算总成本和单位成本
        total_cost = total_purchase_price + total_purchase_fee
        unit_cost = total_cost / order.total_quantity if order.total_quantity > 0 else Decimal(0)
        
        return {
            "purchase_order_id": order.id,
            "purchase_order_code": order.order_code,
            "supplier_id": order.supplier_id,
            "supplier_name": order.supplier_name,
            "quantity": order.total_quantity,
            "purchase_price": total_purchase_price,
            "purchase_fee": total_purchase_fee,
            "total_cost": total_cost,
            "unit_cost": unit_cost,
            "cost_details": {
                "purchase_price_breakdown": purchase_price_breakdown,
                "purchase_fee_breakdown": purchase_fee_breakdown,
                "items_count": len(order_items),
            },
            "calculation_type": "实际成本（整单）",
            "calculation_date": calculation_date,
        }

    async def _calculate_purchase_price(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算采购价格（标准成本）
        
        从物料的默认值或价格表获取采购单价，并计算总价。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (采购价格, 价格明细)
        """
        # 从物料的默认值获取采购单价
        defaults = material.defaults or {}
        purchase_defaults = defaults.get("purchase", {})
        standard_price = purchase_defaults.get("standard_price")
        
        if standard_price:
            unit_price = Decimal(str(standard_price))
        else:
            # 如果没有配置，使用默认值
            unit_price = Decimal(100.00)
        
        # 计算采购价格
        purchase_price = quantity * unit_price
        
        price_breakdown = [{
            "material_id": material.id,
            "material_code": material.main_code,
            "material_name": material.name,
            "quantity": float(quantity),
            "unit": material.base_unit,
            "unit_price": float(unit_price),
            "price": float(purchase_price),
            "source": "material_defaults" if standard_price else "default",
        }]
        
        return purchase_price, price_breakdown

    async def _calculate_purchase_fee(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        purchase_price: Decimal
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算采购费用（标准成本）
        
        根据物料配置或成本规则计算采购费用（如运输费、保险费、税费等）。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            purchase_price: 采购价格
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (采购费用, 费用明细)
        """
        from apps.kuaizhizao.models.cost_rule import CostRule
        
        total_fee = Decimal(0)
        fee_breakdown = []
        
        # 获取采购费用规则
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="采购费用",
            is_active=True,
            deleted_at__isnull=True
        ).all()
        
        for rule in rules:
            rule_fee = Decimal(0)
            
            if rule.calculation_method == "按比例":
                # 按采购价格比例
                rate = Decimal(str(rule.rule_parameters.get("rate", 0.05))) if rule.rule_parameters else Decimal(0.05)
                rule_fee = purchase_price * rate
            elif rule.calculation_method == "按数量":
                # 按数量
                fee_per_unit = Decimal(str(rule.rule_parameters.get("fee_per_unit", 0))) if rule.rule_parameters else Decimal(0)
                rule_fee = quantity * fee_per_unit
            elif rule.calculation_method == "按固定值":
                # 固定值
                fixed_value = Decimal(str(rule.rule_parameters.get("fixed_value", 0))) if rule.rule_parameters else Decimal(0)
                rule_fee = fixed_value
        
            total_fee += rule_fee
            
            fee_breakdown.append({
                "rule_id": rule.id,
                "rule_code": rule.code,
                "rule_name": rule.name,
                "calculation_method": rule.calculation_method,
                "fee": float(rule_fee),
            })
        
        # 如果没有配置规则，使用默认费用率（5%）
        if total_fee == 0:
            default_rate = Decimal(0.05)
            total_fee = purchase_price * default_rate
            fee_breakdown.append({
                "rule_id": None,
                "rule_code": None,
                "rule_name": "默认采购费用",
                "calculation_method": "按比例",
                "fee": float(total_fee),
                "rate": float(default_rate),
            })
        
        return total_fee, fee_breakdown

    async def _calculate_actual_purchase_fee(
        self,
        order: PurchaseOrder,
        order_item: Optional[PurchaseOrderItem],
        purchase_price: Decimal
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算实际采购费用
        
        从采购订单获取实际费用（税费、运输费等）。
        
        Args:
            order: 采购订单对象
            order_item: 采购订单明细对象（可选，如果提供则计算明细的费用）
            purchase_price: 采购价格
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (采购费用, 费用明细)
        """
        total_fee = Decimal(0)
        fee_breakdown = []
        
        if order_item:
            # 计算单个明细的费用（按比例分摊）
            if order.total_amount > 0:
                # 按明细金额比例分摊税费
                item_ratio = purchase_price / order.total_amount
                item_tax = order.tax_amount * item_ratio
                total_fee += item_tax
                
                fee_breakdown.append({
                    "fee_type": "税费",
                    "fee": float(item_tax),
                    "tax_rate": float(order.tax_rate),
                    "source": "order_tax",
                })
        else:
            # 整单费用
            if order.tax_amount:
                total_fee += order.tax_amount
                fee_breakdown.append({
                    "fee_type": "税费",
                    "fee": float(order.tax_amount),
                    "tax_rate": float(order.tax_rate),
                    "source": "order_tax",
                })
        
        # TODO: 可以添加其他费用类型（运输费、保险费等）
        # 这些费用可能存储在订单的扩展字段中
        
        return total_fee, fee_breakdown
