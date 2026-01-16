"""
成本对比服务模块

提供标准成本和实际成本对比功能，基于物料来源类型进行成本对比分析。

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
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.services.production_cost_service import ProductionCostService
from apps.kuaizhizao.services.purchase_cost_service import PurchaseCostService
from apps.kuaizhizao.services.outsource_cost_service import OutsourceCostService


class CostComparisonService:
    """
    成本对比服务类
    
    处理标准成本和实际成本对比业务逻辑，基于物料来源类型进行成本对比分析。
    """

    def __init__(self):
        self.production_cost_service = ProductionCostService()
        self.purchase_cost_service = PurchaseCostService()
        self.outsource_cost_service = OutsourceCostService()

    async def compare_standard_vs_actual_cost(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        purchase_order_id: Optional[int] = None,
        purchase_order_item_id: Optional[int] = None,
        outsource_work_order_id: Optional[int] = None,
        quantity: Optional[Decimal] = None,
        calculation_date: Optional[date] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        对比标准成本和实际成本
        
        根据物料来源类型进行成本对比：
        - 自制件（Make）：对比标准生产成本 vs 实际工单成本
        - 采购件（Buy）：对比标准采购成本 vs 实际采购订单成本
        - 委外件（Outsource）：对比标准委外成本 vs 实际委外工单成本
        - 虚拟件（Phantom）：不单独对比，成本计入上层物料
        - 配置件（Configure）：根据变体BOM对比标准成本和实际成本
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID（必须提供，用于确定物料来源类型和计算标准成本）
            work_order_id: 工单ID（自制件实际成本时提供）
            purchase_order_id: 采购订单ID（采购件实际成本时提供，整单）
            purchase_order_item_id: 采购订单明细ID（采购件实际成本时提供，单个明细）
            outsource_work_order_id: 委外工单ID（委外件实际成本时提供）
            quantity: 数量（计算标准成本时必须提供）
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 成本对比结果
            
        Raises:
            NotFoundError: 物料或订单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误
        """
        if not material_id:
            raise ValidationError("必须提供material_id")
        
        if not quantity:
            raise ValidationError("必须提供quantity用于计算标准成本")
        
        # 获取物料信息
        material = await Material.filter(
            tenant_id=tenant_id,
            id=material_id,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_id} 不存在")
        
        source_type = material.source_type or "Make"  # 默认自制件
        
        # 1. 计算标准成本
        standard_cost_result = await self._calculate_standard_cost(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity,
            calculation_date=calculation_date or date.today(),
            created_by=created_by
        )
        
        # 2. 计算实际成本
        actual_cost_result = await self._calculate_actual_cost(
            tenant_id=tenant_id,
            material=material,
            source_type=source_type,
            work_order_id=work_order_id,
            purchase_order_id=purchase_order_id,
            purchase_order_item_id=purchase_order_item_id,
            outsource_work_order_id=outsource_work_order_id,
            quantity=quantity,
            calculation_date=calculation_date or date.today(),
            created_by=created_by
        )
        
        # 3. 计算成本差异
        standard_total_cost = standard_cost_result.get("total_cost", Decimal(0))
        actual_total_cost = actual_cost_result.get("total_cost", Decimal(0))
        cost_variance = actual_total_cost - standard_total_cost
        cost_variance_rate = (cost_variance / standard_total_cost * 100) if standard_total_cost > 0 else Decimal(0)
        
        standard_unit_cost = standard_cost_result.get("unit_cost", Decimal(0))
        actual_unit_cost = actual_cost_result.get("unit_cost", Decimal(0))
        unit_cost_variance = actual_unit_cost - standard_unit_cost
        unit_cost_variance_rate = (unit_cost_variance / standard_unit_cost * 100) if standard_unit_cost > 0 else Decimal(0)
        
        return {
            "material_id": material.id,
            "material_code": material.main_code,
            "material_name": material.name,
            "source_type": source_type,
            "quantity": quantity,
            "standard_cost": {
                "total_cost": standard_total_cost,
                "unit_cost": standard_unit_cost,
                "cost_details": standard_cost_result.get("cost_details", {}),
                "calculation_type": standard_cost_result.get("calculation_type", "标准成本"),
            },
            "actual_cost": {
                "total_cost": actual_total_cost,
                "unit_cost": actual_unit_cost,
                "cost_details": actual_cost_result.get("cost_details", {}),
                "calculation_type": actual_cost_result.get("calculation_type", "实际成本"),
            },
            "cost_variance": {
                "total_cost_variance": cost_variance,
                "total_cost_variance_rate": cost_variance_rate,
                "unit_cost_variance": unit_cost_variance,
                "unit_cost_variance_rate": unit_cost_variance_rate,
                "variance_type": "超支" if cost_variance > 0 else "节约" if cost_variance < 0 else "无差异",
            },
            "calculation_date": calculation_date or date.today(),
        }

    async def _calculate_standard_cost(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        计算标准成本
        
        根据物料来源类型调用相应的标准成本核算服务。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 标准成本核算结果
        """
        source_type = material.source_type or "Make"
        
        if source_type == "Make":
            # 自制件标准成本
            return await self.production_cost_service.calculate_production_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        elif source_type == "Buy":
            # 采购件标准成本
            return await self.purchase_cost_service.calculate_purchase_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        elif source_type == "Outsource":
            # 委外件标准成本
            return await self.outsource_cost_service.calculate_outsource_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        elif source_type == "Phantom":
            # 虚拟件标准成本（返回0，成本计入上层物料）
            return {
                "material_id": material.id,
                "material_code": material.main_code,
                "material_name": material.name,
                "source_type": "Phantom",
                "quantity": quantity,
                "total_cost": Decimal(0),
                "unit_cost": Decimal(0),
                "cost_details": {},
                "calculation_type": "标准成本",
                "calculation_date": calculation_date,
            }
        elif source_type == "Configure":
            # 配置件标准成本
            return await self.production_cost_service.calculate_production_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=quantity,
                variant_attributes=None,  # TODO: 需要变体属性
                calculation_date=calculation_date,
                created_by=created_by
            )
        else:
            raise BusinessLogicError(f"不支持的物料来源类型: {source_type}")

    async def _calculate_actual_cost(
        self,
        tenant_id: int,
        material: Material,
        source_type: str,
        work_order_id: Optional[int] = None,
        purchase_order_id: Optional[int] = None,
        purchase_order_item_id: Optional[int] = None,
        outsource_work_order_id: Optional[int] = None,
        quantity: Optional[Decimal] = None,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        计算实际成本
        
        根据物料来源类型和提供的订单ID调用相应的实际成本核算服务。
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            source_type: 物料来源类型
            work_order_id: 工单ID（自制件实际成本时提供）
            purchase_order_id: 采购订单ID（采购件实际成本时提供）
            purchase_order_item_id: 采购订单明细ID（采购件实际成本时提供）
            outsource_work_order_id: 委外工单ID（委外件实际成本时提供）
            quantity: 数量（可选）
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 实际成本核算结果
        """
        if source_type == "Make":
            # 自制件实际成本（从工单计算）
            if not work_order_id:
                raise ValidationError("自制件计算实际成本时必须提供work_order_id")
            
            # 获取工单信息
            work_order = await WorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not work_order:
                raise NotFoundError(f"工单 {work_order_id} 不存在")
            
            # 使用工单的实际数量计算实际成本
            actual_quantity = work_order.quantity
            return await self.production_cost_service.calculate_production_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=actual_quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        
        elif source_type == "Buy":
            # 采购件实际成本（从采购订单计算）
            if purchase_order_item_id:
                return await self.purchase_cost_service.calculate_purchase_cost(
                    tenant_id=tenant_id,
                    purchase_order_item_id=purchase_order_item_id,
                    calculation_date=calculation_date,
                    created_by=created_by
                )
            elif purchase_order_id:
                return await self.purchase_cost_service.calculate_purchase_cost(
                    tenant_id=tenant_id,
                    purchase_order_id=purchase_order_id,
                    calculation_date=calculation_date,
                    created_by=created_by
                )
            else:
                raise ValidationError("采购件计算实际成本时必须提供purchase_order_id或purchase_order_item_id")
        
        elif source_type == "Outsource":
            # 委外件实际成本（从委外工单计算）
            if not outsource_work_order_id:
                raise ValidationError("委外件计算实际成本时必须提供outsource_work_order_id")
            
            return await self.outsource_cost_service.calculate_outsource_cost(
                tenant_id=tenant_id,
                outsource_work_order_id=outsource_work_order_id,
                calculation_date=calculation_date,
                created_by=created_by
            )
        
        elif source_type == "Phantom":
            # 虚拟件实际成本（返回0，成本计入上层物料）
            return {
                "material_id": material.id,
                "material_code": material.main_code,
                "material_name": material.name,
                "source_type": "Phantom",
                "quantity": quantity or Decimal(0),
                "total_cost": Decimal(0),
                "unit_cost": Decimal(0),
                "cost_details": {},
                "calculation_type": "实际成本",
                "calculation_date": calculation_date,
            }
        
        elif source_type == "Configure":
            # 配置件实际成本（从工单计算，需要变体属性）
            if not work_order_id:
                raise ValidationError("配置件计算实际成本时必须提供work_order_id")
            
            # 获取工单信息
            work_order = await WorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id,
                deleted_at__isnull=True
            ).first()
            
            if not work_order:
                raise NotFoundError(f"工单 {work_order_id} 不存在")
            
            # TODO: 从工单获取变体属性
            variant_attributes = None
            
            actual_quantity = work_order.quantity
            return await self.production_cost_service.calculate_production_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=actual_quantity,
                variant_attributes=variant_attributes,
                calculation_date=calculation_date,
                created_by=created_by
            )
        
        else:
            raise BusinessLogicError(f"不支持的物料来源类型: {source_type}")

    async def compare_costs_by_source_type(
        self,
        tenant_id: int,
        material_ids: List[int],
        calculation_date: Optional[date] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        按物料来源类型对比成本
        
        批量对比多个物料的标准成本和实际成本，按物料来源类型分组统计。
        
        Args:
            tenant_id: 组织ID
            material_ids: 物料ID列表
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 按物料来源类型分组的成本对比结果
        """
        calculation_date = calculation_date or date.today()
        
        # 按物料来源类型分组
        comparisons_by_source = {
            "Make": [],
            "Buy": [],
            "Outsource": [],
            "Phantom": [],
            "Configure": [],
        }
        
        total_standard_cost = Decimal(0)
        total_actual_cost = Decimal(0)
        
        for material_id in material_ids:
            # 获取物料信息
            material = await Material.filter(
                tenant_id=tenant_id,
                id=material_id,
                deleted_at__isnull=True
            ).first()
            
            if not material:
                continue
            
            source_type = material.source_type or "Make"
            
            # 计算标准成本（使用默认数量1）
            try:
                standard_cost_result = await self._calculate_standard_cost(
                    tenant_id=tenant_id,
                    material=material,
                    quantity=Decimal(1),
                    calculation_date=calculation_date,
                    created_by=created_by
                )
                standard_total_cost = standard_cost_result.get("total_cost", Decimal(0))
            except Exception as e:
                logger.warning(f"计算物料 {material.main_code} 的标准成本失败: {str(e)}")
                standard_total_cost = Decimal(0)
            
            # 实际成本需要根据物料来源类型从相应的订单获取
            # 这里简化处理，只计算标准成本
            actual_total_cost = Decimal(0)
            
            comparison = {
                "material_id": material.id,
                "material_code": material.main_code,
                "material_name": material.name,
                "source_type": source_type,
                "standard_cost": standard_total_cost,
                "actual_cost": actual_total_cost,
                "cost_variance": actual_total_cost - standard_total_cost,
            }
            
            comparisons_by_source[source_type].append(comparison)
            total_standard_cost += standard_total_cost
            total_actual_cost += actual_total_cost
        
        # 计算汇总
        total_variance = total_actual_cost - total_standard_cost
        total_variance_rate = (total_variance / total_standard_cost * 100) if total_standard_cost > 0 else Decimal(0)
        
        # 按来源类型统计
        source_type_summary = {}
        for source_type, comparisons in comparisons_by_source.items():
            if comparisons:
                source_standard = sum(c["standard_cost"] for c in comparisons)
                source_actual = sum(c["actual_cost"] for c in comparisons)
                source_variance = source_actual - source_standard
                source_variance_rate = (source_variance / source_standard * 100) if source_standard > 0 else Decimal(0)
                
                source_type_summary[source_type] = {
                    "count": len(comparisons),
                    "standard_cost": source_standard,
                    "actual_cost": source_actual,
                    "cost_variance": source_variance,
                    "cost_variance_rate": source_variance_rate,
                }
        
        return {
            "comparisons_by_source": comparisons_by_source,
            "source_type_summary": source_type_summary,
            "total_summary": {
                "total_materials": len(material_ids),
                "total_standard_cost": total_standard_cost,
                "total_actual_cost": total_actual_cost,
                "total_variance": total_variance,
                "total_variance_rate": total_variance_rate,
            },
            "calculation_date": calculation_date,
        }
