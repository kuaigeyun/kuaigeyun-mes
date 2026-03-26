"""
生产计划管控塔服务模块

提供全局层面的生产计划分析逻辑，包括齐套性分析、分车间负荷分析、交期风险追踪等。
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from tortoise.functions import Sum, Count
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.master_data.models.factory import WorkCenter
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
from apps.kuaizhizao.utils.inventory_helper import get_material_available_quantity


class ProductionControlService:
    """
    管控塔核心服务类
    """
    
    def __init__(self):
        self.work_order_service = WorkOrderService()

    async def get_global_material_readiness(self, tenant_id: int) -> List[Dict[str, Any]]:
        """
        获取所有进行中/待执行工单的齐套性概览
        """
        # 获取待执行和进行中的工单
        target_statuses = ['draft', 'released', 'in_progress']
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=target_statuses,
            deleted_at__isnull=True
        ).all()
        
        results = []
        for wo in work_orders:
            try:
                # 复用工单服务的缺料检查逻辑
                shortage_info = await self.work_order_service.check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=wo.id
                )
                
                # 计算齐套率
                # 这里简单定义：齐套率 = 已备齐品种数 / 总品种数
                # 后面可以优化为按数量加权。但对于计划员来说，品种齐不齐更关键。
                
                # 重新计算品种总数（为了得到 100% 时的基数）
                variant_attrs = getattr(wo, "variant_attributes", None)
                cfg_selections = getattr(wo, "configurable_selections", None)
                try:
                    requirements = await calculate_material_requirements_from_bom(
                        tenant_id=tenant_id,
                        material_id=wo.product_id,
                        required_quantity=float(wo.quantity),
                        only_approved=True,
                        variant_attributes=variant_attrs,
                        configurable_selections=cfg_selections,
                    )
                except Exception:
                    requirements = []
                
                total_vars = len(requirements)
                shortage_vars = shortage_info.get("total_shortage_count", 0)
                ready_vars = total_vars - shortage_vars
                
                readiness_rate = (ready_vars / total_vars) if total_vars > 0 else 1.0
                
                results.append({
                    "work_order_id": wo.id,
                    "work_order_code": wo.code,
                    "product_name": wo.product_name,
                    "quantity": float(wo.quantity),
                    "status": wo.status,
                    "readiness_rate": round(readiness_rate * 100, 2),
                    "shortage_count": shortage_vars,
                    "planned_start_date": wo.planned_start_date.isoformat() if wo.planned_start_date else None,
                })
            except Exception as e:
                logger.error(f"分析工单 {wo.id} 齐套性失败: {e}")
                
        return sorted(results, key=lambda x: x["readiness_rate"])

    async def get_resource_load_analysis(
        self, 
        tenant_id: int, 
        days: int = 14
    ) -> List[Dict[str, Any]]:
        """
        获取工作中心资源负荷分析
        
        计算逻辑：
        1. 找出指定天数内的所有有效工序
        2. 按工作中心分组，汇总 (标准工时 * 计划数量)
        3. 假设工作中心每天 8 小时产能（实际应从工作中心日历获取，此处先做简化）
        """
        start_date = datetime.now()
        end_date = start_date + timedelta(days=days)
        
        # 获取期间内的工序
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            status__in=['pending', 'in_progress'],
            planned_start_date__lte=end_date,
            planned_end_date__gte=start_date,
            deleted_at__isnull=True
        ).all()
        
        # 获取所有工作中心
        work_centers = await WorkCenter.filter(
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True
        ).all()
        
        wc_map = {wc.id: {"name": wc.name, "total_load": Decimal(0)} for wc in work_centers}
        
        # 汇总负荷
        for op in operations:
            if op.work_center_id in wc_map:
                # 获取关联工单的数量
                wo = await WorkOrder.get_or_none(id=op.work_order_id)
                qty = wo.quantity if wo else Decimal(0)
                std_time = op.standard_time or Decimal(0)
                load = std_time * qty
                wc_map[op.work_center_id]["total_load"] += load
        
        # 转换为列表并计算负荷率
        # 简化产能： 每天 8 小时 * 指定天数
        standard_capacity = Decimal(8) * Decimal(days)
        
        results = []
        for wc_id, data in wc_map.items():
            load_hours = float(data["total_load"])
            cap_hours = float(standard_capacity)
            load_rate = (load_hours / cap_hours) if cap_hours > 0 else 0
            
            results.append({
                "work_center_id": wc_id,
                "work_center_name": data["name"],
                "load_hours": round(load_hours, 2),
                "capacity_hours": cap_hours,
                "load_rate": round(load_rate * 100, 2)
            })
            
        return sorted(results, key=lambda x: x["load_rate"], reverse=True)

    async def get_delivery_risk_orders(self, tenant_id: int) -> List[Dict[str, Any]]:
        """
        识别交期风险工单
        
        风险定义：
        1. 逾期风险：当前日期 > 计划结束日期 且 未完工
        2. 线边缺料风险：进行中工单有汇报缺料（此处暂以延期分析为准）
        3. 连带风险：MTO工单预计结束日期 > 销售订单需求日期
        """
        # 复用已有的延期检查
        delayed_orders = await self.work_order_service.check_delayed_work_orders(
            tenant_id=tenant_id
        )
        
        # 补充 MTO 连带风险（需要查 SalesOrderItem）
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        
        mto_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            production_mode='MTO',
            status__in=['released', 'in_progress'],
            deleted_at__isnull=True
        ).all()
        
        results = []
        # 先把已明确延期的加进来
        for d in delayed_orders:
            results.append({
                **d,
                "risk_type": "delayed",
                "risk_desc": f"已延期 {d['delay_days']} 天"
            })
            
        # 检查 MTO 连带有无逾期于销售订单
        for wo in mto_orders:
            if wo.sales_order_id and wo.planned_end_date:
                # 这里假设销售订单项有对应 ID。实际链路可能更复杂，先根据 sales_order_code 辅助
                so_items = await SalesOrderItem.filter(
                    tenant_id=tenant_id,
                    sales_order_id=wo.sales_order_id,
                    product_id=wo.product_id
                ).all()
                
                for soi in so_items:
                    if soi.required_date and wo.planned_end_date.date() > soi.required_date:
                        diff = (wo.planned_end_date.date() - soi.required_date).days
                        # 避免重复加入
                        if not any(r["work_order_id"] == wo.id for r in results):
                            results.append({
                                "work_order_id": wo.id,
                                "work_order_code": wo.code,
                                "product_name": wo.product_name,
                                "status": wo.status,
                                "planned_end_date": wo.planned_end_date.isoformat(),
                                "so_required_date": soi.required_date.isoformat(),
                                "risk_type": "delivery_clash",
                                "risk_desc": f"晚于订单交付 {diff} 天",
                                "delay_days": diff
                            })
                            
        return results

    async def release_kitted_work_orders(self, tenant_id: int, work_order_ids: List[int]) -> dict:
        """
        批量下达齐套工单
        :param tenant_id: 租户ID
        :param work_order_ids: 待下达工单ID列表
        :return: {success_count: int, fail_count: int, messages: List[str]}
        """
        success_count = 0
        fail_count = 0
        messages = []

        # 仅处理状态为'草稿'或'已审核'且未删除的工单
        work_orders = await WorkOrder.filter(
            id__in=work_order_ids,
            tenant_id=tenant_id,
            status__in=['draft', 'approved'],
            deleted_at__isnull=True
        ).all()

        for wo in work_orders:
            # 检查齐套性
            shortage_results = await self.work_order_service.check_material_shortage(wo.id)
            is_kitted = all(item['shortage_quantity'] <= 0 for item in shortage_results)

            if is_kitted:
                wo.status = 'released'
                # 如果有实际开始时间则不覆盖，通常下达时设置计划开始
                await wo.save()
                success_count += 1
                messages.append(f"工单 {wo.work_order_code} 已下达")
            else:
                fail_count += 1
                messages.append(f"工单 {wo.work_order_code} 开启校验失败：缺料未齐套")

        return {
            "success_count": success_count,
            "fail_count": fail_count,
            "messages": messages
        }
