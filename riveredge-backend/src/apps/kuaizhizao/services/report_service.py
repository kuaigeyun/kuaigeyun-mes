"""
报表服务模块

提供各类报表分析功能，包括库存报表、生产报表、质量报表等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal

from apps.base_service import AppBaseService
from apps.kuaizhizao.utils.inventory_helper import get_material_available_quantity, get_material_inventory_info
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


class ReportService:
    """
    报表服务类

    处理各类报表分析相关的业务逻辑。
    """

    async def get_inventory_report(
        self,
        tenant_id: int,
        report_type: str = "summary",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取库存报表数据

        Args:
            tenant_id: 租户ID
            report_type: 报表类型（summary/turnover/abc/slow_moving）
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            warehouse_id: 仓库ID（可选）

        Returns:
            Dict[str, Any]: 库存报表数据
        """
        if report_type == "summary":
            return await self._get_inventory_summary(
                tenant_id=tenant_id,
                warehouse_id=warehouse_id,
            )
        elif report_type == "turnover":
            return await self._get_inventory_turnover(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                warehouse_id=warehouse_id,
            )
        elif report_type == "abc":
            return await self._get_abc_analysis(
                tenant_id=tenant_id,
                warehouse_id=warehouse_id,
            )
        elif report_type == "slow_moving":
            return await self._get_slow_moving_analysis(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                warehouse_id=warehouse_id,
            )
        else:
            raise ValidationError(f"不支持的报表类型: {report_type}")

    async def _get_inventory_summary(
        self,
        tenant_id: int,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取库存状况分析

        Args:
            tenant_id: 租户ID
            warehouse_id: 仓库ID（可选）

        Returns:
            Dict[str, Any]: 库存状况分析数据
        """
        # TODO: 从库存服务获取真实库存数据
        # 当前为简化实现，返回示例数据结构
        
        logger.warning("库存状况分析为简化实现，返回示例数据")
        
        return {
            "summary": {
                "total_materials": 0,
                "total_quantity": 0.0,
                "total_value": 0.0,
                "low_stock_count": 0,
                "out_of_stock_count": 0,
                "high_stock_count": 0,
            },
            "items": [],
        }

    async def _get_inventory_turnover(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取库存周转率报表

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            warehouse_id: 仓库ID（可选）

        Returns:
            Dict[str, Any]: 库存周转率报表数据
        """
        # TODO: 从库存服务和出入库记录计算周转率
        # 周转率 = 出库金额 / 平均库存金额
        # 周转天数 = 365 / 周转率
        
        logger.warning("库存周转率报表为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=30)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "avg_turnover_rate": 0.0,
                "avg_turnover_days": 0.0,
            },
            "items": [],
        }

    async def _get_abc_analysis(
        self,
        tenant_id: int,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取ABC分析报表

        Args:
            tenant_id: 租户ID
            warehouse_id: 仓库ID（可选）

        Returns:
            Dict[str, Any]: ABC分析报表数据
        """
        # TODO: 从库存服务获取库存数据，按库存价值排序
        # A类：累计价值占比0-80%
        # B类：累计价值占比80-95%
        # C类：累计价值占比95-100%
        
        logger.warning("ABC分析报表为简化实现，返回示例数据")
        
        return {
            "summary": {
                "class_a_count": 0,
                "class_a_value": 0.0,
                "class_a_percentage": 0.0,
                "class_b_count": 0,
                "class_b_value": 0.0,
                "class_b_percentage": 0.0,
                "class_c_count": 0,
                "class_c_value": 0.0,
                "class_c_percentage": 0.0,
            },
            "items": [],
        }

    async def _get_slow_moving_analysis(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取呆滞料分析报表

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            warehouse_id: 仓库ID（可选）

        Returns:
            Dict[str, Any]: 呆滞料分析报表数据
        """
        # TODO: 从库存服务和出入库记录分析呆滞料
        # 呆滞料定义：超过一定天数（如90天）没有出库记录的物料
        
        logger.warning("呆滞料分析报表为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=90)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "total_slow_moving_count": 0,
                "total_slow_moving_value": 0.0,
            },
            "items": [],
        }

    async def get_production_report(
        self,
        tenant_id: int,
        report_type: str = "efficiency",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_center_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取生产报表数据

        Args:
            tenant_id: 租户ID
            report_type: 报表类型（efficiency/completion/reporting/equipment）
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            work_center_id: 工作中心ID（可选）

        Returns:
            Dict[str, Any]: 生产报表数据
        """
        if report_type == "efficiency":
            return await self._get_production_efficiency(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                work_center_id=work_center_id,
            )
        elif report_type == "completion":
            return await self._get_work_order_completion(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                work_center_id=work_center_id,
            )
        elif report_type == "reporting":
            return await self._get_reporting_statistics(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                work_center_id=work_center_id,
            )
        elif report_type == "equipment":
            return await self._get_equipment_utilization(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                work_center_id=work_center_id,
            )
        else:
            raise ValidationError(f"不支持的报表类型: {report_type}")

    async def _get_production_efficiency(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_center_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取生产效率分析

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            work_center_id: 工作中心ID（可选）

        Returns:
            Dict[str, Any]: 生产效率分析数据
        """
        # TODO: 从工单和报工记录计算生产效率
        # 生产效率 = 实际产量 / 计划产量
        # OEE = 可用率 × 性能率 × 质量率
        
        logger.warning("生产效率分析为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=30)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "total_work_orders": 0,
                "completed_work_orders": 0,
                "completion_rate": 0.0,
                "avg_efficiency": 0.0,
                "oee": 0.0,
            },
            "items": [],
        }

    async def _get_work_order_completion(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_center_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取工单完成情况报表

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            work_center_id: 工作中心ID（可选）

        Returns:
            Dict[str, Any]: 工单完成情况报表数据
        """
        # TODO: 从工单记录统计完成情况
        # 按状态统计：draft/released/in_progress/completed/cancelled
        
        logger.warning("工单完成情况报表为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=30)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "total": 0,
                "draft": 0,
                "released": 0,
                "in_progress": 0,
                "completed": 0,
                "cancelled": 0,
                "completion_rate": 0.0,
            },
            "items": [],
        }

    async def _get_reporting_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_center_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取报工统计分析报表

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            work_center_id: 工作中心ID（可选）

        Returns:
            Dict[str, Any]: 报工统计分析报表数据
        """
        # TODO: 从报工记录统计
        # 统计：报工次数、报工数量、报工工时、异常报工等
        
        logger.warning("报工统计分析报表为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=30)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "total_reporting_count": 0,
                "total_reporting_quantity": 0.0,
                "total_reporting_hours": 0.0,
                "avg_reporting_quantity": 0.0,
            },
            "items": [],
        }

    async def _get_equipment_utilization(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_center_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取设备利用率报表

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            work_center_id: 工作中心ID（可选）

        Returns:
            Dict[str, Any]: 设备利用率报表数据
        """
        # TODO: 从设备使用记录计算利用率
        # 设备利用率 = 实际运行时间 / 计划运行时间
        
        logger.warning("设备利用率报表为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=30)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "total_equipment_count": 0,
                "avg_utilization_rate": 0.0,
            },
            "items": [],
        }

    async def get_quality_report(
        self,
        tenant_id: int,
        report_type: str = "analysis",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        material_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取质量报表数据

        Args:
            tenant_id: 租户ID
            report_type: 报表类型（analysis/defect/pass_rate/trend）
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            material_id: 物料ID（可选）

        Returns:
            Dict[str, Any]: 质量报表数据
        """
        if report_type == "analysis":
            return await self._get_quality_analysis(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                material_id=material_id,
            )
        elif report_type == "defect":
            return await self._get_defect_statistics(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                material_id=material_id,
            )
        elif report_type == "pass_rate":
            return await self._get_inspection_pass_rate(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                material_id=material_id,
            )
        elif report_type == "trend":
            return await self._get_quality_trend(
                tenant_id=tenant_id,
                date_start=date_start,
                date_end=date_end,
                material_id=material_id,
            )
        else:
            raise ValidationError(f"不支持的报表类型: {report_type}")

    async def _get_quality_analysis(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        material_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取质量分析报告

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            material_id: 物料ID（可选）

        Returns:
            Dict[str, Any]: 质量分析报告数据
        """
        # TODO: 从质量异常记录和检验记录分析质量状况
        # 统计：总检验数、合格数、不合格数、合格率、主要质量问题等
        
        logger.warning("质量分析报告为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=30)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "total_inspections": 0,
                "passed_inspections": 0,
                "failed_inspections": 0,
                "pass_rate": 0.0,
                "quality_exceptions_count": 0,
            },
            "items": [],
        }

    async def _get_defect_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        material_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取不良品统计报表

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            material_id: 物料ID（可选）

        Returns:
            Dict[str, Any]: 不良品统计报表数据
        """
        # TODO: 从不良品记录统计
        # 按物料、工序、原因等维度统计不良品
        
        logger.warning("不良品统计报表为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=30)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "total_defects": 0,
                "total_defect_quantity": 0.0,
                "defect_rate": 0.0,
            },
            "items": [],
        }

    async def _get_inspection_pass_rate(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        material_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取检验合格率报表

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            material_id: 物料ID（可选）

        Returns:
            Dict[str, Any]: 检验合格率报表数据
        """
        # TODO: 从检验记录计算合格率
        # 合格率 = 合格数 / 总检验数
        
        logger.warning("检验合格率报表为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=30)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "total_inspections": 0,
                "passed_inspections": 0,
                "failed_inspections": 0,
                "pass_rate": 0.0,
            },
            "items": [],
        }

    async def _get_quality_trend(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        material_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取质量趋势分析报表

        Args:
            tenant_id: 租户ID
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）
            material_id: 物料ID（可选）

        Returns:
            Dict[str, Any]: 质量趋势分析报表数据
        """
        # TODO: 从检验记录和质量异常记录分析质量趋势
        # 按时间维度（日/周/月）统计质量指标变化趋势
        
        logger.warning("质量趋势分析报表为简化实现，返回示例数据")
        
        if not date_start:
            date_start = datetime.now() - timedelta(days=90)
        if not date_end:
            date_end = datetime.now()
        
        return {
            "period": {
                "start": date_start.isoformat(),
                "end": date_end.isoformat(),
            },
            "summary": {
                "trend_type": "daily",  # daily/weekly/monthly
            },
            "items": [],
        }


    async def query_batch_inventory(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        material_ids: Optional[List[int]] = None,
        warehouse_id: Optional[int] = None,
        batch_number: Optional[str] = None,
        include_expired: bool = False,
        summary_only: bool = False,
    ) -> Dict[str, Any]:
        """
        批次库存查询
        
        Args:
            tenant_id: 租户ID
            material_id: 物料ID（可选，与 material_ids 二选一）
            material_ids: 物料ID列表（可选，批量查询时使用）
            warehouse_id: 仓库ID（可选）
            batch_number: 批号（可选）
            include_expired: 是否包含过期批次（默认：否）
            summary_only: 是否仅返回物料汇总（material_totals），用于批量检查场景
            
        Returns:
            Dict[str, Any]: 批次库存列表，或 summary_only 时为 { material_totals: { material_id: quantity } }
        """
        from apps.master_data.models.material_batch import MaterialBatch
        from apps.master_data.models.material import Material
        from datetime import date
        from tortoise.expressions import Q
        
        # 构建查询
        query = MaterialBatch.filter(tenant_id=tenant_id)
        
        # 排除已软删除的记录
        query = query.filter(deleted_at__isnull=True)
        
        if material_ids:
            query = query.filter(material_id__in=material_ids)
        elif material_id:
            query = query.filter(material_id=material_id)
        
        if batch_number:
            query = query.filter(batch_no__icontains=batch_number)
        
        # 如果不包含过期批次，过滤掉已过期的
        if not include_expired:
            today = date.today()
            # 兼容 expiry_date 可能为 null 的情况（无保质期视为不过期）
            query = query.filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
            )
        
        # 获取批次列表
        batches = await query.prefetch_related('material').all()
        
        # summary_only：仅返回物料汇总，用于批量检查（销售订单明细视图等）
        if summary_only and (material_ids or material_id):
            material_totals: Dict[str, float] = {}
            ids_to_check = material_ids if material_ids else [material_id]
            for mid in ids_to_check:
                material_totals[str(mid)] = 0.0
            for batch in batches:
                mid = batch.material_id
                if batch.quantity and batch.quantity > 0:
                    material_totals[str(mid)] = material_totals.get(str(mid), 0) + float(batch.quantity)
            return {"material_totals": material_totals}
        
        # 构建返回数据
        items = []
        for batch in batches:
            # 获取关联物料
            material = batch.material
            
            # 判断状态 - 优先使用计算状态，然后是数据库状态
            status_display = batch.status
            
            # 状态映射字典
            status_map = {
                "in_stock": "在库",
                "out_stock": "已出库",
                "expired": "已过期",
                "scrapped": "已报废"
            }
            
            # 先映射数据库状态
            if batch.status in status_map:
                status_display = status_map[batch.status]
            
            # 再根据业务规则覆盖状态
            if batch.expiry_date and batch.expiry_date < date.today():
                status_display = "已过期"
            elif batch.quantity <= 0:
                status_display = "无库存"
            
            items.append({
                "id": batch.id,
                "material_id": material.id,
                "material_code": material.main_code or material.code,
                "material_name": material.name,
                "batch_no": batch.batch_no,
                "production_date": batch.production_date.isoformat() if batch.production_date else None,
                "expiry_date": batch.expiry_date.isoformat() if batch.expiry_date else None,
                "quantity": float(batch.quantity),
                "supplier_batch_no": batch.supplier_batch_no,
                "status": status_display,
                "warehouse_id": warehouse_id, 
                "warehouse_name": None, 
            })
        
        return {
            "total": len(items),
            "items": items,
        }
