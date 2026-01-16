"""
成本报表分析服务模块

提供成本报表分析功能，包括成本趋势分析、成本结构分析等，基于物料来源类型进行分析。

Author: Luigi Lu
Date: 2026-01-16
"""

import uuid
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from apps.master_data.models.material import Material
from apps.kuaizhizao.models.cost_calculation import CostCalculation
from apps.kuaizhizao.services.production_cost_service import ProductionCostService
from apps.kuaizhizao.services.purchase_cost_service import PurchaseCostService
from apps.kuaizhizao.services.outsource_cost_service import OutsourceCostService


class CostReportService:
    """
    成本报表分析服务类
    
    处理成本报表分析业务逻辑，包括成本趋势分析、成本结构分析等。
    """

    def __init__(self):
        self.production_cost_service = ProductionCostService()
        self.purchase_cost_service = PurchaseCostService()
        self.outsource_cost_service = OutsourceCostService()

    async def analyze_cost_trend(
        self,
        tenant_id: int,
        start_date: date,
        end_date: date,
        material_id: Optional[int] = None,
        source_type: Optional[str] = None,
        group_by: str = "month"  # month, week, day
    ) -> Dict[str, Any]:
        """
        分析成本趋势
        
        根据时间范围和物料来源类型分析成本趋势。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期
            end_date: 结束日期
            material_id: 物料ID（可选，用于分析特定物料）
            source_type: 物料来源类型（可选，用于按来源类型筛选）
            group_by: 分组方式（month/week/day）
            
        Returns:
            Dict[str, Any]: 成本趋势分析结果
        """
        # 获取成本核算记录
        query = CostCalculation.filter(
            tenant_id=tenant_id,
            calculation_date__gte=start_date,
            calculation_date__lte=end_date,
            calculation_status="已审核",
            deleted_at__isnull=True
        )
        
        if material_id:
            query = query.filter(product_id=material_id)
        
        calculations = await query.order_by("calculation_date").all()
        
        # 按时间分组统计
        trend_data = {}
        for calc in calculations:
            # 获取物料信息以确定来源类型
            if calc.product_id:
                material = await Material.filter(
                    tenant_id=tenant_id,
                    id=calc.product_id,
                    deleted_at__isnull=True
                ).first()
                
                if material:
                    calc_source_type = material.source_type or "Make"
                    # 如果指定了来源类型，只统计匹配的
                    if source_type and calc_source_type != source_type:
                        continue
                else:
                    calc_source_type = "Unknown"
            else:
                calc_source_type = "Unknown"
            
            # 根据分组方式确定时间键
            if group_by == "month":
                time_key = calc.calculation_date.strftime("%Y-%m")
            elif group_by == "week":
                # 计算周数
                week_start = calc.calculation_date - timedelta(days=calc.calculation_date.weekday())
                time_key = week_start.strftime("%Y-%W")
            else:  # day
                time_key = calc.calculation_date.strftime("%Y-%m-%d")
            
            if time_key not in trend_data:
                trend_data[time_key] = {
                    "period": time_key,
                    "total_cost": Decimal(0),
                    "material_cost": Decimal(0),
                    "labor_cost": Decimal(0),
                    "manufacturing_cost": Decimal(0),
                    "count": 0,
                    "by_source_type": {},
                }
            
            trend_data[time_key]["total_cost"] += calc.total_cost
            trend_data[time_key]["material_cost"] += calc.material_cost
            trend_data[time_key]["labor_cost"] += calc.labor_cost
            trend_data[time_key]["manufacturing_cost"] += calc.manufacturing_cost
            trend_data[time_key]["count"] += 1
            
            # 按来源类型统计
            if calc_source_type not in trend_data[time_key]["by_source_type"]:
                trend_data[time_key]["by_source_type"][calc_source_type] = {
                    "total_cost": Decimal(0),
                    "count": 0,
                }
            trend_data[time_key]["by_source_type"][calc_source_type]["total_cost"] += calc.total_cost
            trend_data[time_key]["by_source_type"][calc_source_type]["count"] += 1
        
        # 转换为列表格式
        trend_list = []
        for time_key in sorted(trend_data.keys()):
            data = trend_data[time_key]
            trend_list.append({
                "period": data["period"],
                "total_cost": float(data["total_cost"]),
                "material_cost": float(data["material_cost"]),
                "labor_cost": float(data["labor_cost"]),
                "manufacturing_cost": float(data["manufacturing_cost"]),
                "count": data["count"],
                "by_source_type": {
                    k: {
                        "total_cost": float(v["total_cost"]),
                        "count": v["count"],
                    }
                    for k, v in data["by_source_type"].items()
                },
            })
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "group_by": group_by,
            "trend_data": trend_list,
            "summary": {
                "total_periods": len(trend_list),
                "total_cost": sum(d["total_cost"] for d in trend_list),
                "avg_cost_per_period": sum(d["total_cost"] for d in trend_list) / len(trend_list) if trend_list else 0,
            },
        }

    async def analyze_cost_structure(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        source_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        分析成本结构
        
        分析成本构成（材料成本、人工成本、制造费用等），可按物料来源类型分组。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选，用于分析特定物料）
            source_type: 物料来源类型（可选，用于按来源类型筛选）
            
        Returns:
            Dict[str, Any]: 成本结构分析结果
        """
        # 获取成本核算记录
        query = CostCalculation.filter(
            tenant_id=tenant_id,
            calculation_status="已审核",
            deleted_at__isnull=True
        )
        
        if start_date:
            query = query.filter(calculation_date__gte=start_date)
        if end_date:
            query = query.filter(calculation_date__lte=end_date)
        if material_id:
            query = query.filter(product_id=material_id)
        
        calculations = await query.all()
        
        # 总体统计
        total_material_cost = Decimal(0)
        total_labor_cost = Decimal(0)
        total_manufacturing_cost = Decimal(0)
        total_cost = Decimal(0)
        
        # 按来源类型统计
        structure_by_source = {}
        
        for calc in calculations:
            # 获取物料信息以确定来源类型
            calc_source_type = "Unknown"
            if calc.product_id:
                material = await Material.filter(
                    tenant_id=tenant_id,
                    id=calc.product_id,
                    deleted_at__isnull=True
                ).first()
                
                if material:
                    calc_source_type = material.source_type or "Make"
                    # 如果指定了来源类型，只统计匹配的
                    if source_type and calc_source_type != source_type:
                        continue
                else:
                    calc_source_type = "Unknown"
            
            # 累计总体统计
            total_material_cost += calc.material_cost
            total_labor_cost += calc.labor_cost
            total_manufacturing_cost += calc.manufacturing_cost
            total_cost += calc.total_cost
            
            # 按来源类型统计
            if calc_source_type not in structure_by_source:
                structure_by_source[calc_source_type] = {
                    "material_cost": Decimal(0),
                    "labor_cost": Decimal(0),
                    "manufacturing_cost": Decimal(0),
                    "total_cost": Decimal(0),
                    "count": 0,
                }
            
            structure_by_source[calc_source_type]["material_cost"] += calc.material_cost
            structure_by_source[calc_source_type]["labor_cost"] += calc.labor_cost
            structure_by_source[calc_source_type]["manufacturing_cost"] += calc.manufacturing_cost
            structure_by_source[calc_source_type]["total_cost"] += calc.total_cost
            structure_by_source[calc_source_type]["count"] += 1
        
        # 计算占比
        material_cost_rate = (total_material_cost / total_cost * 100) if total_cost > 0 else Decimal(0)
        labor_cost_rate = (total_labor_cost / total_cost * 100) if total_cost > 0 else Decimal(0)
        manufacturing_cost_rate = (total_manufacturing_cost / total_cost * 100) if total_cost > 0 else Decimal(0)
        
        # 格式化按来源类型的统计
        structure_by_source_formatted = {}
        for source_type_key, data in structure_by_source.items():
            source_total = data["total_cost"]
            structure_by_source_formatted[source_type_key] = {
                "material_cost": float(data["material_cost"]),
                "labor_cost": float(data["labor_cost"]),
                "manufacturing_cost": float(data["manufacturing_cost"]),
                "total_cost": float(source_total),
                "count": data["count"],
                "material_cost_rate": float((data["material_cost"] / source_total * 100) if source_total > 0 else Decimal(0)),
                "labor_cost_rate": float((data["labor_cost"] / source_total * 100) if source_total > 0 else Decimal(0)),
                "manufacturing_cost_rate": float((data["manufacturing_cost"] / source_total * 100) if source_total > 0 else Decimal(0)),
            }
        
        return {
            "total_cost": float(total_cost),
            "cost_composition": {
                "material_cost": float(total_material_cost),
                "labor_cost": float(total_labor_cost),
                "manufacturing_cost": float(total_manufacturing_cost),
            },
            "cost_rates": {
                "material_cost_rate": float(material_cost_rate),
                "labor_cost_rate": float(labor_cost_rate),
                "manufacturing_cost_rate": float(manufacturing_cost_rate),
            },
            "by_source_type": structure_by_source_formatted,
            "summary": {
                "total_calculations": len(calculations),
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
        }

    async def generate_cost_report(
        self,
        tenant_id: int,
        report_type: str,  # trend, structure, comprehensive
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        source_type: Optional[str] = None,
        group_by: str = "month"
    ) -> Dict[str, Any]:
        """
        生成成本报表
        
        生成综合成本报表，包括成本趋势和成本结构分析。
        
        Args:
            tenant_id: 组织ID
            report_type: 报表类型（trend/structure/comprehensive）
            start_date: 开始日期
            end_date: 结束日期
            material_id: 物料ID（可选）
            source_type: 物料来源类型（可选）
            group_by: 分组方式（month/week/day）
            
        Returns:
            Dict[str, Any]: 成本报表数据
        """
        if not start_date:
            start_date = date.today() - timedelta(days=30)  # 默认最近30天
        if not end_date:
            end_date = date.today()
        
        report_data = {
            "report_type": report_type,
            "start_date": start_date,
            "end_date": end_date,
            "material_id": material_id,
            "source_type": source_type,
            "generated_at": datetime.now().isoformat(),
        }
        
        if report_type == "trend" or report_type == "comprehensive":
            trend_analysis = await self.analyze_cost_trend(
                tenant_id=tenant_id,
                start_date=start_date,
                end_date=end_date,
                material_id=material_id,
                source_type=source_type,
                group_by=group_by
            )
            report_data["trend_analysis"] = trend_analysis
        
        if report_type == "structure" or report_type == "comprehensive":
            structure_analysis = await self.analyze_cost_structure(
                tenant_id=tenant_id,
                start_date=start_date,
                end_date=end_date,
                material_id=material_id,
                source_type=source_type
            )
            report_data["structure_analysis"] = structure_analysis
        
        return report_data
