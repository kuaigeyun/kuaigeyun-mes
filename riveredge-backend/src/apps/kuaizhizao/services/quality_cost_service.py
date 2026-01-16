"""
质量成本核算服务模块

提供质量成本核算功能，包括预防成本、鉴定成本、内部损失成本、外部损失成本。

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
from apps.kuaizhizao.models.quality_exception import QualityException
from apps.kuaizhizao.models.process_inspection import ProcessInspection
from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
from apps.kuaizhizao.models.cost_rule import CostRule


class QualityCostService:
    """
    质量成本核算服务类
    
    处理质量成本核算业务逻辑，包括预防成本、鉴定成本、内部损失成本、外部损失成本。
    """

    async def calculate_quality_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        calculation_date: Optional[date] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        核算质量成本
        
        质量成本 = 预防成本 + 鉴定成本 + 内部损失成本 + 外部损失成本
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选，用于统计时间范围）
            end_date: 结束日期（可选，用于统计时间范围）
            material_id: 物料ID（可选，用于核算特定物料的质量成本）
            work_order_id: 工单ID（可选，用于核算特定工单的质量成本）
            calculation_date: 核算日期（可选，默认为当前日期）
            created_by: 创建人ID
            
        Returns:
            Dict[str, Any]: 质量成本核算结果
            
        Raises:
            ValidationError: 数据验证失败
        """
        calculation_date = calculation_date or date.today()
        
        # 1. 计算预防成本
        prevention_cost, prevention_cost_breakdown = await self._calculate_prevention_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date
        )
        
        # 2. 计算鉴定成本
        appraisal_cost, appraisal_cost_breakdown = await self._calculate_appraisal_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id
        )
        
        # 3. 计算内部损失成本
        internal_failure_cost, internal_failure_cost_breakdown = await self._calculate_internal_failure_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id
        )
        
        # 4. 计算外部损失成本
        external_failure_cost, external_failure_cost_breakdown = await self._calculate_external_failure_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id
        )
        
        # 5. 计算总质量成本
        total_quality_cost = prevention_cost + appraisal_cost + internal_failure_cost + external_failure_cost
        
        return {
            "prevention_cost": prevention_cost,
            "appraisal_cost": appraisal_cost,
            "internal_failure_cost": internal_failure_cost,
            "external_failure_cost": external_failure_cost,
            "total_quality_cost": total_quality_cost,
            "cost_details": {
                "prevention_cost_breakdown": prevention_cost_breakdown,
                "appraisal_cost_breakdown": appraisal_cost_breakdown,
                "internal_failure_cost_breakdown": internal_failure_cost_breakdown,
                "external_failure_cost_breakdown": external_failure_cost_breakdown,
            },
            "calculation_type": "质量成本",
            "calculation_date": calculation_date,
            "start_date": start_date,
            "end_date": end_date,
            "material_id": material_id,
            "work_order_id": work_order_id,
        }

    async def _calculate_prevention_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算预防成本
        
        预防成本包括：质量培训费用、质量体系建立和维护费用等。
        从成本规则中获取预防成本配置。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (预防成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 获取预防成本规则
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="质量成本",
            cost_type="预防成本",
            is_active=True,
            deleted_at__isnull=True
        ).all()
        
        for rule in rules:
            rule_cost = Decimal(0)
            
            if rule.calculation_method == "按固定值":
                # 固定值
                fixed_value = Decimal(str(rule.rule_parameters.get("fixed_value", 0))) if rule.rule_parameters else Decimal(0)
                rule_cost = fixed_value
            elif rule.calculation_method == "按月":
                # 按月计算（如果提供了日期范围，按月数计算）
                monthly_value = Decimal(str(rule.rule_parameters.get("monthly_value", 0))) if rule.rule_parameters else Decimal(0)
                if start_date and end_date:
                    # 计算月数（简化处理，按天数/30）
                    days = (end_date - start_date).days
                    months = Decimal(days) / Decimal(30)
                    rule_cost = monthly_value * months
                else:
                    # 默认按1个月计算
                    rule_cost = monthly_value
            elif rule.calculation_method == "按比例":
                # 按比例（需要基准值，这里简化处理）
                rate = Decimal(str(rule.rule_parameters.get("rate", 0))) if rule.rule_parameters else Decimal(0)
                # TODO: 需要基准值（如销售额、生产成本等）
                rule_cost = Decimal(0)
            
            total_cost += rule_cost
            
            cost_breakdown.append({
                "rule_id": rule.id,
                "rule_code": rule.code,
                "rule_name": rule.name,
                "calculation_method": rule.calculation_method,
                "cost": float(rule_cost),
            })
        
        # 如果没有配置规则，使用默认值
        if total_cost == 0:
            default_cost = Decimal(1000.00)  # 默认预防成本
            total_cost = default_cost
            cost_breakdown.append({
                "rule_id": None,
                "rule_code": None,
                "rule_name": "默认预防成本",
                "calculation_method": "按固定值",
                "cost": float(default_cost),
            })
        
        return total_cost, cost_breakdown

    async def _calculate_appraisal_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算鉴定成本
        
        鉴定成本包括：来料检验成本、过程检验成本、成品检验成本。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            work_order_id: 工单ID（可选）
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (鉴定成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 获取检验单价（从成本规则获取）
        inspection_unit_price = await self._get_inspection_unit_price(tenant_id)
        
        # 1. 计算来料检验成本
        incoming_inspection_cost, incoming_breakdown = await self._calculate_incoming_inspection_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            unit_price=inspection_unit_price
        )
        total_cost += incoming_inspection_cost
        cost_breakdown.extend(incoming_breakdown)
        
        # 2. 计算过程检验成本
        process_inspection_cost, process_breakdown = await self._calculate_process_inspection_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id,
            unit_price=inspection_unit_price
        )
        total_cost += process_inspection_cost
        cost_breakdown.extend(process_breakdown)
        
        # 3. 计算成品检验成本
        finished_goods_inspection_cost, finished_breakdown = await self._calculate_finished_goods_inspection_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id,
            unit_price=inspection_unit_price
        )
        total_cost += finished_goods_inspection_cost
        cost_breakdown.extend(finished_breakdown)
        
        return total_cost, cost_breakdown

    async def _calculate_incoming_inspection_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        unit_price: Decimal = Decimal(10.00)
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算来料检验成本
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            unit_price: 检验单价
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (来料检验成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 构建查询条件
        query = IncomingInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="已检验"
        )
        
        if start_date:
            query = query.filter(inspection_time__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(inspection_time__lte=datetime.combine(end_date, datetime.max.time()))
        if material_id:
            query = query.filter(material_id=material_id)
        
        # 获取来料检验记录
        inspections = await query.all()
        
        for inspection in inspections:
            # 计算检验成本（检验数量 × 检验单价）
            inspection_cost = inspection.inspection_quantity * unit_price
            total_cost += inspection_cost
            
            cost_breakdown.append({
                "inspection_id": inspection.id,
                "inspection_code": inspection.inspection_code,
                "inspection_type": "来料检验",
                "material_id": inspection.material_id,
                "material_code": inspection.material_code,
                "material_name": inspection.material_name,
                "inspection_quantity": float(inspection.inspection_quantity),
                "unit_price": float(unit_price),
                "cost": float(inspection_cost),
                "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None,
            })
        
        return total_cost, cost_breakdown

    async def _calculate_process_inspection_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        unit_price: Decimal = Decimal(10.00)
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算过程检验成本
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            work_order_id: 工单ID（可选）
            unit_price: 检验单价
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (过程检验成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 构建查询条件
        query = ProcessInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="已检验"
        )
        
        if start_date:
            query = query.filter(inspection_time__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(inspection_time__lte=datetime.combine(end_date, datetime.max.time()))
        if material_id:
            query = query.filter(material_id=material_id)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        
        # 获取过程检验记录
        inspections = await query.all()
        
        for inspection in inspections:
            # 计算检验成本（检验数量 × 检验单价）
            inspection_cost = inspection.inspection_quantity * unit_price
            total_cost += inspection_cost
            
            cost_breakdown.append({
                "inspection_id": inspection.id,
                "inspection_code": inspection.inspection_code,
                "inspection_type": "过程检验",
                "work_order_id": inspection.work_order_id,
                "work_order_code": inspection.work_order_code,
                "material_id": inspection.material_id,
                "material_code": inspection.material_code,
                "material_name": inspection.material_name,
                "inspection_quantity": float(inspection.inspection_quantity),
                "unit_price": float(unit_price),
                "cost": float(inspection_cost),
                "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None,
            })
        
        return total_cost, cost_breakdown

    async def _calculate_finished_goods_inspection_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        unit_price: Decimal = Decimal(10.00)
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算成品检验成本
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            work_order_id: 工单ID（可选）
            unit_price: 检验单价
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (成品检验成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 构建查询条件
        query = FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="已检验"
        )
        
        if start_date:
            query = query.filter(inspection_time__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(inspection_time__lte=datetime.combine(end_date, datetime.max.time()))
        if material_id:
            query = query.filter(material_id=material_id)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        
        # 获取成品检验记录
        inspections = await query.all()
        
        for inspection in inspections:
            # 计算检验成本（检验数量 × 检验单价）
            inspection_cost = inspection.inspection_quantity * unit_price
            total_cost += inspection_cost
            
            cost_breakdown.append({
                "inspection_id": inspection.id,
                "inspection_code": inspection.inspection_code,
                "inspection_type": "成品检验",
                "work_order_id": inspection.work_order_id,
                "work_order_code": inspection.work_order_code,
                "material_id": inspection.material_id,
                "material_code": inspection.material_code,
                "material_name": inspection.material_name,
                "inspection_quantity": float(inspection.inspection_quantity),
                "unit_price": float(unit_price),
                "cost": float(inspection_cost),
                "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None,
            })
        
        return total_cost, cost_breakdown

    async def _calculate_internal_failure_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算内部损失成本
        
        内部损失成本包括：返工成本、废品损失、质量异常处理成本。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            work_order_id: 工单ID（可选）
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (内部损失成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 1. 计算质量异常处理成本（内部发现的质量问题）
        exception_cost, exception_breakdown = await self._calculate_quality_exception_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id,
            exception_types=["inspection_failure", "process_deviation"]  # 内部损失类型
        )
        total_cost += exception_cost
        cost_breakdown.extend(exception_breakdown)
        
        # 2. 计算返工成本（从不合格数量计算）
        rework_cost, rework_breakdown = await self._calculate_rework_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id
        )
        total_cost += rework_cost
        cost_breakdown.extend(rework_breakdown)
        
        # 3. 计算废品损失（从不合格数量 × 单位成本计算）
        scrap_cost, scrap_breakdown = await self._calculate_scrap_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id
        )
        total_cost += scrap_cost
        cost_breakdown.extend(scrap_breakdown)
        
        return total_cost, cost_breakdown

    async def _calculate_external_failure_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算外部损失成本
        
        外部损失成本包括：客户投诉处理成本、退货成本、赔偿成本。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            work_order_id: 工单ID（可选）
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (外部损失成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 计算客户投诉处理成本（从质量异常记录中获取customer_complaint类型）
        complaint_cost, complaint_breakdown = await self._calculate_quality_exception_cost(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
            material_id=material_id,
            work_order_id=work_order_id,
            exception_types=["customer_complaint"]  # 外部损失类型
        )
        total_cost += complaint_cost
        cost_breakdown.extend(complaint_breakdown)
        
        # TODO: 可以添加退货成本、赔偿成本等
        
        return total_cost, cost_breakdown

    async def _calculate_quality_exception_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        exception_types: List[str] = None
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算质量异常处理成本
        
        根据质量异常的严重程度和类型计算处理成本。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            work_order_id: 工单ID（可选）
            exception_types: 异常类型列表（可选）
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (质量异常处理成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 严重程度对应的处理成本（单位：元）
        severity_costs = {
            "minor": Decimal(100.00),
            "major": Decimal(500.00),
            "critical": Decimal(2000.00),
        }
        
        # 构建查询条件
        query = QualityException.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if start_date:
            query = query.filter(created_at__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(created_at__lte=datetime.combine(end_date, datetime.max.time()))
        if material_id:
            query = query.filter(material_id=material_id)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if exception_types:
            query = query.filter(exception_type__in=exception_types)
        
        # 获取质量异常记录
        exceptions = await query.all()
        
        for exception in exceptions:
            # 根据严重程度计算处理成本
            severity = exception.severity or "minor"
            exception_cost = severity_costs.get(severity, Decimal(100.00))
            total_cost += exception_cost
            
            cost_breakdown.append({
                "exception_id": exception.id,
                "exception_type": exception.exception_type,
                "severity": severity,
                "work_order_id": exception.work_order_id,
                "work_order_code": exception.work_order_code,
                "material_id": exception.material_id,
                "material_code": exception.material_code,
                "material_name": exception.material_name,
                "cost": float(exception_cost),
                "created_at": exception.created_at.isoformat() if exception.created_at else None,
            })
        
        return total_cost, cost_breakdown

    async def _calculate_rework_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算返工成本
        
        从检验记录的不合格数量计算返工成本（假设返工成本 = 不合格数量 × 单位返工成本）。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            work_order_id: 工单ID（可选）
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (返工成本, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 返工单价（从成本规则获取，或使用默认值）
        rework_unit_price = Decimal(50.00)  # 默认返工单价
        
        # 从过程检验和成品检验中获取不合格数量
        # 1. 过程检验不合格数量
        process_query = ProcessInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="已检验",
            unqualified_quantity__gt=0
        )
        if start_date:
            process_query = process_query.filter(inspection_time__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            process_query = process_query.filter(inspection_time__lte=datetime.combine(end_date, datetime.max.time()))
        if material_id:
            process_query = process_query.filter(material_id=material_id)
        if work_order_id:
            process_query = process_query.filter(work_order_id=work_order_id)
        
        process_inspections = await process_query.all()
        
        for inspection in process_inspections:
            # 计算返工成本（不合格数量 × 返工单价）
            rework_cost = inspection.unqualified_quantity * rework_unit_price
            total_cost += rework_cost
            
            cost_breakdown.append({
                "inspection_id": inspection.id,
                "inspection_code": inspection.inspection_code,
                "inspection_type": "过程检验返工",
                "work_order_id": inspection.work_order_id,
                "work_order_code": inspection.work_order_code,
                "material_id": inspection.material_id,
                "material_code": inspection.material_code,
                "material_name": inspection.material_name,
                "unqualified_quantity": float(inspection.unqualified_quantity),
                "rework_unit_price": float(rework_unit_price),
                "cost": float(rework_cost),
            })
        
        # 2. 成品检验不合格数量
        finished_query = FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="已检验",
            unqualified_quantity__gt=0
        )
        if start_date:
            finished_query = finished_query.filter(inspection_time__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            finished_query = finished_query.filter(inspection_time__lte=datetime.combine(end_date, datetime.max.time()))
        if material_id:
            finished_query = finished_query.filter(material_id=material_id)
        if work_order_id:
            finished_query = finished_query.filter(work_order_id=work_order_id)
        
        finished_inspections = await finished_query.all()
        
        for inspection in finished_inspections:
            # 计算返工成本（不合格数量 × 返工单价）
            rework_cost = inspection.unqualified_quantity * rework_unit_price
            total_cost += rework_cost
            
            cost_breakdown.append({
                "inspection_id": inspection.id,
                "inspection_code": inspection.inspection_code,
                "inspection_type": "成品检验返工",
                "work_order_id": inspection.work_order_id,
                "work_order_code": inspection.work_order_code,
                "material_id": inspection.material_id,
                "material_code": inspection.material_code,
                "material_name": inspection.material_name,
                "unqualified_quantity": float(inspection.unqualified_quantity),
                "rework_unit_price": float(rework_unit_price),
                "cost": float(rework_cost),
            })
        
        return total_cost, cost_breakdown

    async def _calculate_scrap_cost(
        self,
        tenant_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        material_id: Optional[int] = None,
        work_order_id: Optional[int] = None
    ) -> tuple[Decimal, List[Dict[str, Any]]]:
        """
        计算废品损失
        
        从检验记录的不合格数量计算废品损失（假设废品损失 = 不合格数量 × 单位成本）。
        
        Args:
            tenant_id: 组织ID
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            work_order_id: 工单ID（可选）
            
        Returns:
            tuple[Decimal, List[Dict[str, Any]]]: (废品损失, 成本明细)
        """
        total_cost = Decimal(0)
        cost_breakdown = []
        
        # 从过程检验和成品检验中获取不合格数量（假设这些是废品）
        # 这里简化处理，使用固定的单位成本
        # TODO: 应该从物料成本或工单成本获取单位成本
        
        # 1. 过程检验废品损失
        process_query = ProcessInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="已检验",
            unqualified_quantity__gt=0,
            disposition="报废"  # 假设处理方式为"报废"的是废品
        )
        if start_date:
            process_query = process_query.filter(inspection_time__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            process_query = process_query.filter(inspection_time__lte=datetime.combine(end_date, datetime.max.time()))
        if material_id:
            process_query = process_query.filter(material_id=material_id)
        if work_order_id:
            process_query = process_query.filter(work_order_id=work_order_id)
        
        process_inspections = await process_query.all()
        
        for inspection in process_inspections:
            # 获取物料单位成本（简化处理，使用默认值）
            material_unit_cost = Decimal(100.00)  # TODO: 从物料成本获取
            
            # 计算废品损失（不合格数量 × 单位成本）
            scrap_cost = inspection.unqualified_quantity * material_unit_cost
            total_cost += scrap_cost
            
            cost_breakdown.append({
                "inspection_id": inspection.id,
                "inspection_code": inspection.inspection_code,
                "inspection_type": "过程检验废品",
                "work_order_id": inspection.work_order_id,
                "work_order_code": inspection.work_order_code,
                "material_id": inspection.material_id,
                "material_code": inspection.material_code,
                "material_name": inspection.material_name,
                "unqualified_quantity": float(inspection.unqualified_quantity),
                "material_unit_cost": float(material_unit_cost),
                "cost": float(scrap_cost),
            })
        
        # 2. 成品检验废品损失
        finished_query = FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="已检验",
            unqualified_quantity__gt=0,
            disposition="报废"
        )
        if start_date:
            finished_query = finished_query.filter(inspection_time__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            finished_query = finished_query.filter(inspection_time__lte=datetime.combine(end_date, datetime.max.time()))
        if material_id:
            finished_query = finished_query.filter(material_id=material_id)
        if work_order_id:
            finished_query = finished_query.filter(work_order_id=work_order_id)
        
        finished_inspections = await finished_query.all()
        
        for inspection in finished_inspections:
            # 获取物料单位成本（简化处理，使用默认值）
            material_unit_cost = Decimal(100.00)  # TODO: 从物料成本获取
            
            # 计算废品损失（不合格数量 × 单位成本）
            scrap_cost = inspection.unqualified_quantity * material_unit_cost
            total_cost += scrap_cost
            
            cost_breakdown.append({
                "inspection_id": inspection.id,
                "inspection_code": inspection.inspection_code,
                "inspection_type": "成品检验废品",
                "work_order_id": inspection.work_order_id,
                "work_order_code": inspection.work_order_code,
                "material_id": inspection.material_id,
                "material_code": inspection.material_code,
                "material_name": inspection.material_name,
                "unqualified_quantity": float(inspection.unqualified_quantity),
                "material_unit_cost": float(material_unit_cost),
                "cost": float(scrap_cost),
            })
        
        return total_cost, cost_breakdown

    async def _get_inspection_unit_price(self, tenant_id: int) -> Decimal:
        """
        获取检验单价
        
        从成本规则获取检验单价，或使用默认值。
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Decimal: 检验单价
        """
        # 从成本规则获取检验单价
        rule = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="质量成本",
            cost_type="鉴定成本",
            calculation_method="按数量",
            is_active=True,
            deleted_at__isnull=True
        ).first()
        
        if rule and rule.rule_parameters:
            unit_price = rule.rule_parameters.get("unit_price")
            if unit_price:
                return Decimal(str(unit_price))
        
        # 默认检验单价
        return Decimal(10.00)
