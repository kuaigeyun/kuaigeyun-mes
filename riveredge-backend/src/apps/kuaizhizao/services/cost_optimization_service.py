"""
成本优化建议服务模块

提供基于物料来源类型的成本优化建议功能。

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
from apps.kuaizhizao.services.production_cost_service import ProductionCostService
from apps.kuaizhizao.services.purchase_cost_service import PurchaseCostService
from apps.kuaizhizao.services.outsource_cost_service import OutsourceCostService
from apps.kuaizhizao.services.cost_comparison_service import CostComparisonService


class CostOptimizationService:
    """
    成本优化建议服务类
    
    处理基于物料来源类型的成本优化建议业务逻辑。
    """

    def __init__(self):
        self.production_cost_service = ProductionCostService()
        self.purchase_cost_service = PurchaseCostService()
        self.outsource_cost_service = OutsourceCostService()
        self.cost_comparison_service = CostComparisonService()

    async def generate_optimization_suggestions(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        material_ids: Optional[List[int]] = None,
        quantity: Optional[Decimal] = None,
        calculation_date: Optional[date] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        生成成本优化建议
        
        基于物料来源类型分析成本，提供优化建议：
        - 如果自制件成本高于采购件成本，建议转为采购件
        - 如果采购件成本高于自制件成本，建议转为自制件
        - 如果委外件成本高于自制件成本，建议转为自制件
        - 如果委外件成本高于采购件成本，建议转为采购件
        - 等等
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID（单个物料分析）
            material_ids: 物料ID列表（批量分析）
            quantity: 数量（用于计算成本）
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 成本优化建议结果
            
        Raises:
            ValidationError: 数据验证失败
        """
        if not material_id and not material_ids:
            raise ValidationError("必须提供material_id或material_ids之一")
        
        calculation_date = calculation_date or date.today()
        quantity = quantity or Decimal(1)
        
        if material_id:
            # 单个物料分析
            return await self._analyze_single_material(
                tenant_id=tenant_id,
                material_id=material_id,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        else:
            # 批量物料分析
            return await self._analyze_multiple_materials(
                tenant_id=tenant_id,
                material_ids=material_ids,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )

    async def _analyze_single_material(
        self,
        tenant_id: int,
        material_id: int,
        quantity: Decimal,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        分析单个物料的成本优化建议
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID
            quantity: 数量
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 单个物料的成本优化建议
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
        
        # 计算当前来源类型的成本
        current_cost = await self._calculate_current_cost(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity,
            calculation_date=calculation_date,
            created_by=created_by
        )
        
        # 计算其他来源类型的成本
        alternative_costs = await self._calculate_alternative_costs(
            tenant_id=tenant_id,
            material=material,
            quantity=quantity,
            calculation_date=calculation_date,
            created_by=created_by
        )
        
        # 生成优化建议
        suggestions = await self._generate_suggestions(
            material=material,
            current_source_type=source_type,
            current_cost=current_cost,
            alternative_costs=alternative_costs
        )
        
        return {
            "material_id": material.id,
            "material_code": material.main_code,
            "material_name": material.name,
            "current_source_type": source_type,
            "current_cost": current_cost,
            "alternative_costs": alternative_costs,
            "suggestions": suggestions,
            "calculation_date": calculation_date,
        }

    async def _analyze_multiple_materials(
        self,
        tenant_id: int,
        material_ids: List[int],
        quantity: Decimal,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        批量分析多个物料的成本优化建议
        
        Args:
            tenant_id: 组织ID
            material_ids: 物料ID列表
            quantity: 数量
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 批量物料的成本优化建议
        """
        suggestions_list = []
        total_potential_savings = Decimal(0)
        
        for material_id in material_ids:
            try:
                suggestion = await self._analyze_single_material(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    quantity=quantity,
                    calculation_date=calculation_date,
                    created_by=created_by
                )
                
                # 计算潜在节约成本
                if suggestion.get("suggestions"):
                    best_suggestion = suggestion["suggestions"][0]  # 取第一个建议（最优）
                    if best_suggestion.get("potential_savings"):
                        total_potential_savings += Decimal(str(best_suggestion["potential_savings"]))
                
                suggestions_list.append(suggestion)
            except Exception as e:
                logger.warning(f"分析物料 {material_id} 的成本优化建议失败: {str(e)}")
                continue
        
        # 按潜在节约成本排序
        suggestions_list.sort(
            key=lambda x: Decimal(str(x.get("suggestions", [{}])[0].get("potential_savings", 0))) if x.get("suggestions") else Decimal(0),
            reverse=True
        )
        
        return {
            "materials_count": len(material_ids),
            "suggestions": suggestions_list,
            "total_potential_savings": total_potential_savings,
            "calculation_date": calculation_date,
        }

    async def _calculate_current_cost(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        计算当前来源类型的成本
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 当前成本
        """
        source_type = material.source_type or "Make"
        
        if source_type == "Make":
            result = await self.production_cost_service.calculate_production_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        elif source_type == "Buy":
            result = await self.purchase_cost_service.calculate_purchase_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        elif source_type == "Outsource":
            result = await self.outsource_cost_service.calculate_outsource_cost(
                tenant_id=tenant_id,
                material_id=material.id,
                quantity=quantity,
                calculation_date=calculation_date,
                created_by=created_by
            )
        else:
            # Phantom、Configure等暂不支持优化建议
            result = {
                "total_cost": Decimal(0),
                "unit_cost": Decimal(0),
            }
        
        return {
            "source_type": source_type,
            "total_cost": result.get("total_cost", Decimal(0)),
            "unit_cost": result.get("unit_cost", Decimal(0)),
        }

    async def _calculate_alternative_costs(
        self,
        tenant_id: int,
        material: Material,
        quantity: Decimal,
        calculation_date: date,
        created_by: Optional[int] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        计算其他来源类型的成本
        
        Args:
            tenant_id: 组织ID
            material: 物料对象
            quantity: 数量
            calculation_date: 核算日期
            created_by: 创建人ID
            
        Returns:
            Dict[str, Dict[str, Any]]: 其他来源类型的成本
        """
        current_source_type = material.source_type or "Make"
        alternative_costs = {}
        
        # 计算自制件成本（如果当前不是自制件）
        if current_source_type != "Make":
            try:
                result = await self.production_cost_service.calculate_production_cost(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    quantity=quantity,
                    calculation_date=calculation_date,
                    created_by=created_by
                )
                alternative_costs["Make"] = {
                    "source_type": "Make",
                    "total_cost": result.get("total_cost", Decimal(0)),
                    "unit_cost": result.get("unit_cost", Decimal(0)),
                    "feasible": True,  # 假设所有物料都可以自制
                }
            except Exception as e:
                logger.warning(f"计算物料 {material.main_code} 的自制件成本失败: {str(e)}")
                alternative_costs["Make"] = {
                    "source_type": "Make",
                    "total_cost": Decimal(0),
                    "unit_cost": Decimal(0),
                    "feasible": False,
                    "reason": str(e),
                }
        
        # 计算采购件成本（如果当前不是采购件）
        if current_source_type != "Buy":
            try:
                result = await self.purchase_cost_service.calculate_purchase_cost(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    quantity=quantity,
                    calculation_date=calculation_date,
                    created_by=created_by
                )
                alternative_costs["Buy"] = {
                    "source_type": "Buy",
                    "total_cost": result.get("total_cost", Decimal(0)),
                    "unit_cost": result.get("unit_cost", Decimal(0)),
                    "feasible": True,  # 假设所有物料都可以采购
                }
            except Exception as e:
                logger.warning(f"计算物料 {material.main_code} 的采购件成本失败: {str(e)}")
                alternative_costs["Buy"] = {
                    "source_type": "Buy",
                    "total_cost": Decimal(0),
                    "unit_cost": Decimal(0),
                    "feasible": False,
                    "reason": str(e),
                }
        
        # 计算委外件成本（如果当前不是委外件）
        if current_source_type != "Outsource":
            try:
                result = await self.outsource_cost_service.calculate_outsource_cost(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    quantity=quantity,
                    calculation_date=calculation_date,
                    created_by=created_by
                )
                alternative_costs["Outsource"] = {
                    "source_type": "Outsource",
                    "total_cost": result.get("total_cost", Decimal(0)),
                    "unit_cost": result.get("unit_cost", Decimal(0)),
                    "feasible": True,  # 假设所有物料都可以委外
                }
            except Exception as e:
                logger.warning(f"计算物料 {material.main_code} 的委外件成本失败: {str(e)}")
                alternative_costs["Outsource"] = {
                    "source_type": "Outsource",
                    "total_cost": Decimal(0),
                    "unit_cost": Decimal(0),
                    "feasible": False,
                    "reason": str(e),
                }
        
        return alternative_costs

    async def _generate_suggestions(
        self,
        material: Material,
        current_source_type: str,
        current_cost: Dict[str, Any],
        alternative_costs: Dict[str, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        生成优化建议
        
        Args:
            material: 物料对象
            current_source_type: 当前来源类型
            current_cost: 当前成本
            alternative_costs: 其他来源类型的成本
            
        Returns:
            List[Dict[str, Any]]: 优化建议列表（按潜在节约成本排序）
        """
        suggestions = []
        current_total_cost = current_cost.get("total_cost", Decimal(0))
        
        for alt_source_type, alt_cost_info in alternative_costs.items():
            if not alt_cost_info.get("feasible", False):
                continue
            
            alt_total_cost = alt_cost_info.get("total_cost", Decimal(0))
            
            # 如果替代方案成本更低，生成建议
            if alt_total_cost > 0 and alt_total_cost < current_total_cost:
                potential_savings = current_total_cost - alt_total_cost
                savings_rate = (potential_savings / current_total_cost * 100) if current_total_cost > 0 else Decimal(0)
                
                suggestion = {
                    "suggestion_type": f"转为{self._get_source_type_name(alt_source_type)}",
                    "from_source_type": current_source_type,
                    "to_source_type": alt_source_type,
                    "current_cost": float(current_total_cost),
                    "alternative_cost": float(alt_total_cost),
                    "potential_savings": float(potential_savings),
                    "savings_rate": float(savings_rate),
                    "priority": "高" if savings_rate > 20 else "中" if savings_rate > 10 else "低",
                    "description": f"建议将物料来源类型从{self._get_source_type_name(current_source_type)}转为{self._get_source_type_name(alt_source_type)}，预计可节约成本 {float(potential_savings):.2f} 元（节约率 {float(savings_rate):.2f}%）",
                }
                suggestions.append(suggestion)
        
        # 按潜在节约成本排序（从高到低）
        suggestions.sort(key=lambda x: x.get("potential_savings", 0), reverse=True)
        
        return suggestions

    def _get_source_type_name(self, source_type: str) -> str:
        """
        获取物料来源类型的中文名称
        
        Args:
            source_type: 物料来源类型
            
        Returns:
            str: 中文名称
        """
        source_type_names = {
            "Make": "自制件",
            "Buy": "采购件",
            "Outsource": "委外件",
            "Phantom": "虚拟件",
            "Configure": "配置件",
        }
        return source_type_names.get(source_type, source_type)
