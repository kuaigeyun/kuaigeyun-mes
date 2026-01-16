"""
生产成本核算服务模块

提供基于物料来源类型的生产成本核算功能，支持自制件、虚拟件、配置件的成本核算。

Author: Luigi Lu
Date: 2026-01-16
"""

import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any, Set
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from apps.base_service import AppBaseService
from apps.master_data.models.material import Material, BOM
from apps.master_data.models.process import ProcessRoute, Operation
from apps.kuaizhizao.models.cost_calculation import CostCalculation
from apps.kuaizhizao.models.cost_rule import CostRule
from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id, calculate_material_requirements_from_bom


class ProductionCostService:
    """
    生产成本核算服务类
    
    处理基于物料来源类型的生产成本核算业务逻辑。
    """

    def __init__(self):
        self.cost_rule_service = None

    async def calculate_production_cost(
        self,
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        variant_attributes: Optional[Dict[str, Any]] = None,
        calculation_date: Optional[date] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        核算生产成本
        
        根据物料来源类型计算生产成本：
        - 自制件（Make）：材料成本（BOM展开）+ 加工成本（工序成本）+ 制造费用
        - 虚拟件（Phantom）：不单独核算，成本直接计入上层物料
        - 配置件（Configure）：根据选择的变体BOM，按变体计算成本
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID
            quantity: 数量
            variant_attributes: 变体属性（配置件时需要）
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 成本核算结果
            
        Raises:
            NotFoundError: 物料不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        # 获取物料信息
        material = await Material.filter(
            tenant_id=tenant_id,
            id=material_id,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_id} 不存在")
        
        source_type = material.source_type or "Make"  # 默认自制件
        
        # 根据物料来源类型计算成本
        if source_type == "Make":
            # 自制件成本核算
            result = await self._calculate_make_cost(
                tenant_id=tenant_id,
                material=material,
                quantity=quantity,
                calculation_date=calculation_date or date.today(),
                created_by=created_by
            )
        elif source_type == "Phantom":
            # 虚拟件成本核算：不单独核算，返回0，成本计入上层物料
            result = await self._calculate_phantom_cost(
                tenant_id=tenant_id,
                material=material,
                quantity=quantity,
                calculation_date=calculation_date or date.today()
            )
        elif source_type == "Configure":
            # 配置件成本核算：根据变体BOM计算
            if not variant_attributes:
                raise ValidationError("配置件必须提供变体属性（variant_attributes）")
            
            result = await self._calculate_configure_cost(
                tenant_id=tenant_id,
                material=material,
                quantity=quantity,
                variant_attributes=variant_attributes,
                calculation_date=calculation_date or date.today(),
                created_by=created_by
            )
        else:
            raise BusinessLogicError(f"不支持的物料来源类型: {source_type}")
        
        return result

    async def _calculate_make_cost(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        计算自制件成本
        
        公式：材料成本（BOM展开）+ 加工成本（工序成本）+ 制造费用
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 成本核算结果
        """
        # 1. 计算材料成本（BOM展开）
        material_cost, material_cost_breakdown = await self._calculate_material_cost_from_bom(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity
        )
        
        # 2. 计算加工成本（工序成本）
        labor_cost, labor_cost_breakdown = await self._calculate_process_cost(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity
        )
        
        # 3. 计算制造费用
        manufacturing_cost, manufacturing_cost_breakdown = await self._calculate_manufacturing_overhead(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity,
            material_cost=material_cost,
            labor_cost=labor_cost
        )
        
        # 4. 计算总成本和单位成本
        total_cost = material_cost + labor_cost + manufacturing_cost
        unit_cost = total_cost / quantity if quantity > 0 else Decimal(0)
        
        return {
            "material_id": material.id,
            "material_code": material.main_code,
            "material_name": material.name,
            "source_type": "Make",
            "quantity": quantity,
            "material_cost": material_cost,
            "labor_cost": labor_cost,
            "manufacturing_cost": manufacturing_cost,
            "total_cost": total_cost,
            "unit_cost": unit_cost,
            "cost_details": {
                "material_cost_breakdown": material_cost_breakdown,
                "labor_cost_breakdown": labor_cost_breakdown,
                "manufacturing_cost_breakdown": manufacturing_cost_breakdown,
            },
            "calculation_date": calculation_date,
        }

    async def _calculate_phantom_cost(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        calculation_date: date
    ) -> Dict[str, Any]:
        """
        计算虚拟件成本
        
        虚拟件不单独核算，成本直接计入上层物料。
        返回成本为0，但返回BOM明细用于上层物料成本计算。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            calculation_date: 核算日期
            
        Returns:
            Dict[str, Any]: 成本核算结果（成本为0，包含BOM明细）
        """
        # 获取虚拟件的BOM明细（用于计入上层物料）
        bom_items = await get_bom_items_by_material_id(
            tenant_id=tenant_id,
            material_id=material.id,
            only_approved=True
        )
        
        phantom_breakdown = []
        for bom_item in bom_items:
            component = await bom_item.component
            if component:
                phantom_breakdown.append({
                    "component_id": component.id,
                    "component_code": component.main_code,
                    "component_name": component.name,
                    "quantity": float(bom_item.quantity) * float(quantity),
                    "unit": bom_item.unit or component.base_unit,
                    "waste_rate": float(bom_item.waste_rate),
                    "source_type": component.source_type,
                })
        
        return {
            "material_id": material.id,
            "material_code": material.main_code,
            "material_name": material.name,
            "source_type": "Phantom",
            "quantity": quantity,
            "material_cost": Decimal(0),
            "labor_cost": Decimal(0),
            "manufacturing_cost": Decimal(0),
            "total_cost": Decimal(0),
            "unit_cost": Decimal(0),
            "cost_details": {
                "phantom_breakdown": phantom_breakdown,  # 虚拟件明细，用于计入上层物料
                "note": "虚拟件不单独核算，成本直接计入上层物料",
            },
            "calculation_date": calculation_date,
        }

    async def _calculate_configure_cost(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        variant_attributes: Dict[str, Any],
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        计算配置件成本
        
        根据选择的变体BOM，按变体计算成本。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            variant_attributes: 变体属性
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 成本核算结果
        """
        # 根据变体属性获取对应的BOM版本
        # TODO: 实现变体BOM匹配逻辑
        # 这里简化处理：使用默认BOM，后续需要根据variant_attributes匹配对应的变体BOM
        
        # 获取配置件的BOM（应该根据变体属性匹配）
        bom_items = await get_bom_items_by_material_id(
            tenant_id=tenant_id,
            material_id=material.id,
            only_approved=True
        )
        
        if not bom_items:
            logger.warning(f"配置件 {material.main_code} 没有BOM，使用默认成本计算")
            # 如果没有BOM，按自制件方式计算
            return await self._calculate_make_cost(
                tenant_id=tenant_id,
                material=material,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        
        # 计算材料成本（基于变体BOM）
        material_cost, material_cost_breakdown = await self._calculate_material_cost_from_bom(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity,
            variant_attributes=variant_attributes
        )
        
        # 计算加工成本
        labor_cost, labor_cost_breakdown = await self._calculate_process_cost(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity
        )
        
        # 计算制造费用
        manufacturing_cost, manufacturing_cost_breakdown = await self._calculate_manufacturing_overhead(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity,
            material_cost=material_cost,
            labor_cost=labor_cost
        )
        
        # 计算总成本和单位成本
        total_cost = material_cost + labor_cost + manufacturing_cost
        unit_cost = total_cost / quantity if quantity > 0 else Decimal(0)
        
        return {
            "material_id": material.id,
            "material_code": material.main_code,
            "material_name": material.name,
            "source_type": "Configure",
            "variant_attributes": variant_attributes,
            "quantity": quantity,
            "material_cost": material_cost,
            "labor_cost": labor_cost,
            "manufacturing_cost": manufacturing_cost,
            "total_cost": total_cost,
            "unit_cost": unit_cost,
            "cost_details": {
                "material_cost_breakdown": material_cost_breakdown,
                "labor_cost_breakdown": labor_cost_breakdown,
                "manufacturing_cost_breakdown": manufacturing_cost_breakdown,
                "variant_info": variant_attributes,
            },
            "calculation_date": calculation_date,
        }

    async def _calculate_material_cost_from_bom(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        variant_attributes: Optional[Dict[str, Any]] = None
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        从BOM计算材料成本
        
        递归展开BOM，处理虚拟件（成本计入上层物料）。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            variant_attributes: 变体属性（配置件使用）
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (材料成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        processed_materials: Set[int] = set()  # 防止循环引用
        
        async def expand_bom(material_id: int, qty: Decimal, level: int = 0) -> Decimal:
            """递归展开BOM"""
            if material_id in processed_materials:
                logger.warning(f"检测到BOM循环引用，物料ID: {material_id}")
                return Decimal(0)
            
            processed_materials.add(material_id)
            
            # 获取BOM明细
            bom_items = await get_bom_items_by_material_id(
                tenant_id=tenant_id,
                material_id=material_id,
                only_approved=True
            )
            
            if not bom_items:
                return Decimal(0)
            
            component_cost = Decimal(0)
            
            for bom_item in bom_items:
                component = await bom_item.component
                if not component:
                    continue
                
                # 计算子件数量（考虑损耗率）
                component_qty = Decimal(str(bom_item.quantity)) * qty * (
                    Decimal(1) + Decimal(str(bom_item.waste_rate)) / Decimal(100)
                )
                
                component_source_type = component.source_type or "Make"
                
                if component_source_type == "Phantom":
                    # 虚拟件：递归展开，成本计入当前物料
                    phantom_cost = await expand_bom(component.id, component_qty, level + 1)
                    component_cost += phantom_cost
                    
                    cost_breakdown.append({
                        "material_id": component.id,
                        "material_code": component.main_code,
                        "material_name": component.name,
                        "source_type": "Phantom",
                        "quantity": float(component_qty),
                        "unit": bom_item.unit or component.base_unit,
                        "cost": float(phantom_cost),
                        "level": level + 1,
                        "note": "虚拟件，成本计入上层物料",
                    })
                elif component_source_type == "Buy":
                    # 采购件：从默认值或价格表获取单价
                    unit_price = await self._get_material_unit_price(
                        tenant_id=tenant_id,
                        material=component
                    )
                    item_cost = component_qty * unit_price
                    component_cost += item_cost
                    
                    cost_breakdown.append({
                        "material_id": component.id,
                        "material_code": component.main_code,
                        "material_name": component.name,
                        "source_type": "Buy",
                        "quantity": float(component_qty),
                        "unit": bom_item.unit or component.base_unit,
                        "unit_price": float(unit_price),
                        "cost": float(item_cost),
                        "level": level + 1,
                    })
                elif component_source_type == "Make":
                    # 自制件：递归计算
                    make_cost = await expand_bom(component.id, component_qty, level + 1)
                    component_cost += make_cost
                    
                    cost_breakdown.append({
                        "material_id": component.id,
                        "material_code": component.main_code,
                        "material_name": component.name,
                        "source_type": "Make",
                        "quantity": float(component_qty),
                        "unit": bom_item.unit or component.base_unit,
                        "cost": float(make_cost),
                        "level": level + 1,
                    })
                elif component_source_type == "Configure":
                    # 配置件：需要变体属性，这里简化处理
                    # TODO: 实现配置件的变体BOM匹配
                    logger.warning(f"配置件 {component.main_code} 在BOM展开中暂不支持，使用默认单价")
                    unit_price = await self._get_material_unit_price(
                        tenant_id=tenant_id,
                        material=component
                    )
                    item_cost = component_qty * unit_price
                    component_cost += item_cost
                    
                    cost_breakdown.append({
                        "material_id": component.id,
                        "material_code": component.main_code,
                        "material_name": component.name,
                        "source_type": "Configure",
                        "quantity": float(component_qty),
                        "unit": bom_item.unit or component.base_unit,
                        "unit_price": float(unit_price),
                        "cost": float(item_cost),
                        "level": level + 1,
                        "note": "配置件，暂使用默认单价",
                    })
                else:
                    # 其他类型（如委外件），使用默认单价
                    unit_price = await self._get_material_unit_price(
                        tenant_id=tenant_id,
                        material=component
                    )
                    item_cost = component_qty * unit_price
                    component_cost += item_cost
                    
                    cost_breakdown.append({
                        "material_id": component.id,
                        "material_code": component.main_code,
                        "material_name": component.name,
                        "source_type": component_source_type,
                        "quantity": float(component_qty),
                        "unit": bom_item.unit or component.base_unit,
                        "unit_price": float(unit_price),
                        "cost": float(item_cost),
                        "level": level + 1,
                    })
            
            processed_materials.remove(material_id)
            return component_cost
        
        total_cost = await expand_bom(material.id, quantity)
        
        return total_cost, cost_breakdown

    async def _calculate_process_cost(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算加工成本（工序成本）
        
        根据工艺路线计算工序成本。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (加工成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 获取工艺路线
        process_route = material.process_route
        if not process_route:
            # 如果没有工艺路线，返回0
            return Decimal(0), []
        
        process_route_obj = await ProcessRoute.filter(
            tenant_id=tenant_id,
            id=process_route.id,
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        if not process_route_obj:
            return Decimal(0), []
        
        # 获取工序序列
        operation_sequence = process_route_obj.operation_sequence or []
        
        # TODO: 从成本规则或配置获取标准工时和工时单价
        standard_hourly_rate = Decimal(50.00)  # 默认工时单价
        
        for op_data in operation_sequence:
            op_id = op_data.get("operation_id")
            if not op_id:
                continue
            
            operation = await Operation.filter(
                tenant_id=tenant_id,
                id=op_id,
                deleted_at__isnull=True,
                is_active=True
            ).first()
            
            if not operation:
                continue
            
            # 获取标准工时（小时/件）
            standard_time = Decimal(str(op_data.get("standard_time", 1.0)))
            
            # 计算工序成本
            operation_cost = standard_time * quantity * standard_hourly_rate
            total_cost += operation_cost
            
            cost_breakdown.append({
                "operation_id": operation.id,
                "operation_code": operation.code,
                "operation_name": operation.name,
                "standard_time": float(standard_time),
                "quantity": float(quantity),
                "hourly_rate": float(standard_hourly_rate),
                "cost": float(operation_cost),
            })
        
        return total_cost, cost_breakdown

    async def _calculate_manufacturing_overhead(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        material_cost: Decimal,
        labor_cost: Decimal
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算制造费用
        
        根据成本规则计算制造费用。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            material_cost: 材料成本
            labor_cost: 人工成本
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (制造费用, 费用明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 获取制造费用规则
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True
        ).all()
        
        for rule in rules:
            rule_cost = Decimal(0)
            
            if rule.calculation_method == "按比例":
                # 按材料成本比例
                rate = Decimal(str(rule.rule_parameters.get("rate", 0.1))) if rule.rule_parameters else Decimal(0.1)
                rule_cost = material_cost * rate
            elif rule.calculation_method == "按工时":
                # 按人工成本比例
                rate = Decimal(str(rule.rule_parameters.get("rate", 0.2))) if rule.rule_parameters else Decimal(0.2)
                rule_cost = labor_cost * rate
            elif rule.calculation_method == "按固定值":
                # 固定值
                fixed_value = Decimal(str(rule.rule_parameters.get("fixed_value", 0))) if rule.rule_parameters else Decimal(0)
                rule_cost = fixed_value * quantity
            
            total_cost += rule_cost
            
            cost_breakdown.append({
                "rule_id": rule.id,
                "rule_code": rule.code,
                "rule_name": rule.name,
                "calculation_method": rule.calculation_method,
                "cost": float(rule_cost),
            })
        
        return total_cost, cost_breakdown

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
