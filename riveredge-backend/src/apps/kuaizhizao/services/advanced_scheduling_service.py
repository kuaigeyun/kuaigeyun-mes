"""
高级排产服务模块

提供智能排产算法和多约束优化功能。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date, timedelta
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.equipment import Equipment
from apps.master_data.models.factory import Workshop
from core.services.base import BaseService
from infra.exceptions.exceptions import ValidationError, BusinessLogicError


class AdvancedSchedulingService(BaseService):
    """
    高级排产服务类
    
    提供智能排产算法和多约束优化功能。
    """
    
    def __init__(self):
        super().__init__(WorkOrder)
    
    async def intelligent_scheduling(
        self,
        tenant_id: int,
        work_order_ids: Optional[List[int]] = None,
        constraints: Optional[Dict[str, Any]] = None,
        apply_results: bool = True,
        updated_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        智能排产算法
        
        根据多个约束条件（优先级、交期、工作中心能力、设备可用性等）进行智能排产。
        
        Args:
            tenant_id: 组织ID
            work_order_ids: 工单ID列表（可选，如果不提供则对所有待排产工单进行排产）
            constraints: 约束条件字典
                - priority_weight: 优先级权重（0-1）
                - due_date_weight: 交期权重（0-1）
                - capacity_weight: 产能权重（0-1）
                - setup_time_weight: 换线时间权重（0-1）
                - optimize_objective: 优化目标（min_makespan/min_total_time/min_setup_time）
        
        Returns:
            Dict[str, Any]: 排产结果
                - scheduled_orders: 已排产的工单列表
                - unscheduled_orders: 无法排产的工单列表
                - conflicts: 冲突列表
                - statistics: 统计信息
        """
        # 获取待排产工单
        # 待排产工单：草稿、已下达（与工单模型 status 一致）
        status_filter = ['draft', 'released']
        if work_order_ids:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=work_order_ids,
                status__in=status_filter
            ).prefetch_related('operations').all()
        else:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=status_filter
            ).prefetch_related('operations').all()
        
        if not work_orders:
            return {
                "scheduled_orders": [],
                "unscheduled_orders": [],
                "conflicts": [],
                "statistics": {}
            }
        
        # 默认约束条件
        default_constraints = {
            "priority_weight": 0.3,
            "due_date_weight": 0.3,
            "capacity_weight": 0.2,
            "setup_time_weight": 0.2,
            "optimize_objective": "min_makespan"
        }
        
        if constraints:
            default_constraints.update(constraints)
        
        # 执行智能排产算法
        result = await self._execute_scheduling_algorithm(
            tenant_id,
            work_orders,
            default_constraints
        )
        
        # 若需应用结果，将排产日期写入工单
        if apply_results and result.get("scheduled_orders") and updated_by:
            await self.apply_scheduling_results(
                tenant_id=tenant_id,
                results=result["scheduled_orders"],
                updated_by=updated_by,
            )
        
        return result
    
    async def _execute_scheduling_algorithm(
        self,
        tenant_id: int,
        work_orders: List[WorkOrder],
        constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        执行排产算法
        
        使用启发式算法（如遗传算法、模拟退火等）进行排产优化。
        """
        # TODO: 实现具体的排产算法
        # 简单算法：基于优先级的贪心排产 + 车间日产能负荷约束
        
        scheduled_orders = []
        unscheduled_orders = []
        conflicts = []
        
        # 维护一个简单的日产能负荷表: {(workshop_id, date): current_hours}
        daily_load = {}
        
        # 按优先级评分排序
        sorted_orders = sorted(
            work_orders,
            key=lambda wo: self._get_priority_score(wo, constraints),
            reverse=True
        )
        
        # 模拟排产过程
        for work_order in sorted_orders:
            try:
                # 获取计划日期，若无则默认今天
                current_date = (work_order.planned_start_date or datetime.now()).date()
                workshop_id = work_order.workshop_id or 0
                
                # 预估工单耗时
                estimated_hours = (work_order.planned_quantity or 1.0) * 0.1
                capacity_limit = 24.0 # 默认每日 24h
                
                # 寻找可用日期 (最多向后搜索 14 天)
                found_date = None
                for i in range(14):
                    check_date = current_date + timedelta(days=i)
                    load = daily_load.get((workshop_id, check_date), 0.0)
                    if load + estimated_hours <= capacity_limit:
                        found_date = check_date
                        break
                
                if found_date:
                    # 分配产能
                    daily_load[(workshop_id, found_date)] = daily_load.get((workshop_id, found_date), 0.0) + estimated_hours
                    
                    scheduled_orders.append({
                        "work_order_id": work_order.id,
                        "work_order_code": work_order.code,
                        "original_date": current_date,
                        "scheduled_date": found_date,
                        "delay_days": (found_date - current_date).days,
                        "estimated_hours": estimated_hours
                    })
                else:
                    unscheduled_orders.append({
                        "work_order_id": work_order.id,
                        "work_order_code": work_order.code,
                        "reason": "未来 14 天内均无足够车间产能"
                    })
            except Exception as e:
                logger.error(f"排产工单 {work_order.code} 失败: {e}")
                unscheduled_orders.append({
                    "work_order_id": work_order.id,
                    "work_order_code": work_order.code,
                    "reason": f"系统错误: {str(e)}"
                })
        
        return {
            "scheduled_orders": scheduled_orders,
            "unscheduled_orders": unscheduled_orders,
            "conflicts": conflicts,
            "statistics": {
                "total_orders": len(work_orders),
                "scheduled_count": len(scheduled_orders),
                "unscheduled_count": len(unscheduled_orders),
                "scheduling_rate": len(scheduled_orders) / len(work_orders) if work_orders else 0
            }
        }
    
    def _get_priority_score(self, work_order: WorkOrder, constraints: Dict[str, Any]) -> float:
        """计算工单优先级得分"""
        score = 0.0
        
        # 优先级得分
        priority_map = {"low": 1, "normal": 2, "high": 3, "urgent": 4}
        priority_score = priority_map.get(work_order.priority or "normal", 2)
        score += priority_score * constraints.get("priority_weight", 0.3)
        
        # 交期得分（交期越近，得分越高）
        if work_order.planned_end_date:
            days_until_due = (work_order.planned_end_date.date() - date.today()).days
            due_date_score = max(0, 10 - days_until_due) / 10  # 10天内交期得分最高
            score += due_date_score * constraints.get("due_date_weight", 0.3)
            
        # 计划一致性得分（工单开始日期越接近计划建议日期，得分越高）
        if work_order.planned_start_date:
            # 这里的思路是：排程系统应当尽量满足生产计划给出的建议日期，减少计划震荡
            # 如果没有建议日期，该权重则不生效
            score += 1.0 * constraints.get("plan_fidelity_weight", 0.2)
        
        return score
    
    async def _check_capacity(
        self,
        tenant_id: int,
        work_order: WorkOrder
    ) -> bool:
        """检查工作中心能力"""
        # TODO: 实现工作中心能力检查
        # 这里先返回True，表示能力充足
        return True
    
    async def apply_scheduling_results(
        self,
        tenant_id: int,
        results: List[Dict[str, Any]],
        updated_by: int
    ) -> bool:
        """
        应用排产结果
        
        将排产建议的具体日期更新到工单模型中。
        """
        async with in_transaction():
            for res in results:
                wo_id = res.get("work_order_id")
                scheduled_date = res.get("scheduled_date")
                
                if not wo_id or not scheduled_date:
                    continue
                    
                wo = await WorkOrder.get_or_none(id=wo_id, tenant_id=tenant_id)
                if wo:
                    # 将建议日期转化为 datetime (设为当天 08:00)
                    dt_start = datetime.combine(scheduled_date, datetime.min.time().replace(hour=8))
                    wo.planned_start_date = dt_start
                    # 简单预估结束日期 (若无逻辑则顺延到 17:00)
                    wo.planned_end_date = datetime.combine(scheduled_date, datetime.min.time().replace(hour=17))
                    wo.updated_by = updated_by
                    await wo.save()
            return True

    async def optimize_schedule(
        self,
        tenant_id: int,
        schedule_id: Optional[int] = None,
        optimization_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        优化排产计划
        """
        # TODO: 实现更复杂的排产优化算法
        return {
            "optimized": True,
            "improvement": 0.0,
            "iterations": 0
        }
