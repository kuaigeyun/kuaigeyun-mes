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
from apps.master_data.models.material import Material
from apps.master_data.models.process import ProcessRoute, Operation
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
        
        import asyncio

        async def analyze_wo(wo):
            try:
                # 复用工单服务的缺料检查逻辑
                shortage_info = await self.work_order_service.check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=wo.id
                )
                
                # 重新计算品种总数
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
                
                return {
                    "work_order_id": wo.id,
                    "work_order_code": wo.code,
                    "product_name": wo.product_name,
                    "quantity": float(wo.quantity),
                    "status": wo.status,
                    "readiness_rate": round(readiness_rate * 100, 2),
                    "shortage_count": shortage_vars,
                    "planned_start_date": wo.planned_start_date.isoformat() if wo.planned_start_date else None,
                }
            except Exception as e:
                logger.error(f"分析工单 {wo.id} 齐套性失败: {e}")
                return None

        # 并行执行分析
        tasks = [analyze_wo(wo) for wo in work_orders]
        results = await asyncio.gather(*tasks)
        
        # 过滤失败的任务
        results = [r for r in results if r is not None]

        if results:
            from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService

            score_svc = WorkOrderScoreService()
            if await score_svc.is_score_enabled(tenant_id):
                wo_ids = [int(r["work_order_id"]) for r in results]
                score_map = await score_svc.batch_ensure_scores(
                    tenant_id, wo_ids, "picking", include_kitting=True
                )
                for row in results:
                    cached = score_map.get(int(row["work_order_id"]))
                    if cached:
                        row["picking_score"] = cached.composite_score
                        row["picking_rank_band"] = cached.rank_band
                
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
                    material_id=wo.product_id
                ).all()
                
                for soi in so_items:
                    if soi.delivery_date and wo.planned_end_date.date() > soi.delivery_date:
                        diff = (wo.planned_end_date.date() - soi.delivery_date).days
                        # 避免重复加入
                        if not any(r["work_order_id"] == wo.id for r in results):
                            results.append({
                                "work_order_id": wo.id,
                                "work_order_code": wo.code,
                                "product_name": wo.product_name,
                                "status": wo.status,
                                "planned_end_date": wo.planned_end_date.isoformat(),
                                "so_required_date": soi.delivery_date.isoformat(),
                                "risk_type": "delivery_clash",
                                "risk_desc": f"晚于订单交付 {diff} 天",
                                "delay_days": diff
                            })
                            
        if results:
            from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService

            score_svc = WorkOrderScoreService()
            wo_ids = [int(r["work_order_id"]) for r in results if r.get("work_order_id")]
            score_map = await score_svc.batch_ensure_scores(
                tenant_id, wo_ids, "scheduling", include_kitting=False
            )
            for row in results:
                cached = score_map.get(int(row["work_order_id"]))
                if cached:
                    row["scheduling_score"] = cached.composite_score
                    row["scheduling_rank_band"] = cached.rank_band

        return results

    async def release_kitted_work_orders(self, tenant_id: int, work_order_ids: List[int], operator_id: int = None) -> dict:
        """
        批量下达齐套工单
        :param tenant_id: 租户ID
        :param work_order_ids: 待下达工单ID列表。若为空，则自动扫描全组织所有草稿状态工单。
        :param operator_id: 操作人ID
        :return: {count: int, fail_count: int, messages: List[str]}
        """
        success_count = 0
        fail_count = 0
        messages = []

        # 构造工单查询：仅处理状态为'草稿'且未删除的工单 (通常只有草稿能下达)
        query = WorkOrder.filter(
            tenant_id=tenant_id,
            status='draft',
            deleted_at__isnull=True
        )
        
        # 如果指定了 ID 列表，则按 ID 过滤
        if work_order_ids:
            query = query.filter(id__in=work_order_ids)

        work_orders = await query.all()
        
        if not work_orders:
            return {
                "count": 0,
                "fail_count": 0,
                "messages": ["未发现符合条件的待下达工单"]
            }

        for wo in work_orders:
            try:
                if getattr(wo, "is_frozen", False):
                    continue

                # 与工单列表齐套率、齐套分析 API 同一口径：get_work_order_kitting_analysis（for_kitting_analysis BOM）。
                # check_material_shortage 为全阶 BOM 展开，会把中间自制件逐行比库存，常误判缺料 → 自动下达一直为 0。
                analysis = await self.work_order_service.get_work_order_kitting_analysis(tenant_id, wo.id)
                if analysis.status == "fully_kitted":
                    is_kitted = True
                elif analysis.status == "no_bom":
                    shortage_info = await self.work_order_service.check_material_shortage(tenant_id, wo.id)
                    is_kitted = not shortage_info.get("has_shortage", True)
                else:
                    is_kitted = False

                if is_kitted:
                    # 使用标准下达逻辑以录入完整的节点、日志和审计信息
                    # 注意：如果不需要拦截缺料，这里 check_shortage 设为 False，因为我们已经手动检查过了
                    await self.work_order_service.release_work_order(
                        tenant_id=tenant_id,
                        work_order_id=wo.id,
                        released_by=operator_id or wo.created_by,
                        check_shortage=False
                    )
                    success_count += 1
                    messages.append(f"工单 {wo.code} 已成功下达")
                else:
                    # 自动下达场景，不满足则跳过，不计入 fail_count（前端通常只想知道成功了多少）
                    pass
            except Exception as e:
                # 除非发生真正的异常（如数据库错误），否则不算失败
                fail_count += 1
                messages.append(f"工单 {wo.code} 自动下达异常: {str(e)}")

        return {
            "count": success_count,
            "fail_count": fail_count,
            "messages": messages
        }

    async def simulate_urgent_order_impact(self, tenant_id: int, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        插单影响模拟核心逻辑
        """
        product_id = params.get("product_id")
        quantity = params.get("quantity", 0)
        planned_start = params.get("planned_start_date")
        planned_end = params.get("planned_end_date")
        
        # 1. 模拟齐套分析 (抢占逻辑)
        # 获取该产品BOM需求
        requirements = await calculate_material_requirements_from_bom(
            tenant_id=tenant_id,
            material_id=product_id,
            required_quantity=float(quantity)
        )
        
        shortage_items = []
        ready_count = 0
        total_count = len(requirements)
        
        for req in requirements:
            m_id = req["material_id"]
            needed = req["total_quantity"]
            # 获取当前实时可用库存
            avail = await get_material_available_quantity(tenant_id, m_id)
            
            if avail >= needed:
                ready_count += 1
            else:
                shortage_items.append({
                    "material_id": m_id,
                    "material_code": req["material_code"],
                    "material_name": req["material_name"],
                    "shortage_quantity": float(needed - avail)
                })
        
        readiness_rate = (ready_count / total_count * 100) if total_count > 0 else 100.0
        
        # 2. 模拟受影响订单 (抢占物料导致其他订单缺料)
        # 简单逻辑：如果当前订单扣除了 X 数量，哪些本来“齐套”或“部分齐套”的订单会因此变缺料？
        impacted_orders = []
        if readiness_rate > 0:
            # 查找同样用到这些物料的待执行/进行中工单
            used_material_ids = [r["material_id"] for r in requirements]
            
            # 这里简化处理：找出最近 7 天内计划开工的所有工单
            potential_victims = await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=['draft', 'released', 'in_progress'],
                deleted_at__isnull=True,
                planned_start_date__lte=datetime.now() + timedelta(days=7)
            ).all()
            
            for victim in potential_victims:
                # 检查 victim 的 BOM 是否与新订单冲突
                v_shortage = await self.work_order_service.check_material_shortage(victim.id)
                # 模拟逻辑：如果新订单拿走了物料，victim 本来不缺的现在缺了，即为受影响
                # 此处由于是模拟，我们只标识“物料冲突”类型
                # (实际生产环境需要更精细的库存分配预演)
                v_requirements = await calculate_material_requirements_from_bom(
                    tenant_id=tenant_id,
                    material_id=victim.product_id,
                    required_quantity=float(victim.quantity)
                )
                
                conflicts = [r["material_code"] for r in v_requirements if r["material_id"] in used_material_ids]
                if conflicts:
                    impacted_orders.append({
                        "work_order_id": victim.id,
                        "work_order_code": victim.code,
                        "product_name": victim.product_name,
                        "original_planned_start": victim.planned_start_date,
                        "original_planned_end": victim.planned_end_date,
                        "impact_type": "material_conflict",
                        "shortage_items": conflicts[:3] # 仅列出前三个冲突物料
                    })

        # 3. 产能负荷变化模拟
        # 查找产品对应的默认工艺路线
        route = await ProcessRoute.get_or_none(material_id=product_id, is_active=True, tenant_id=tenant_id)
        load_changes = []
        if route:
            # 简单假设平摊到所有工序涉及的工作中心
            ops = await Operation.filter(route_id=route.id, is_active=True).all()
            for op in ops:
                load_changes.append({
                    "work_center_name": op.name, # 简化处理，通常应关联 WorkCenter
                    "added_hours": float((op.standard_time or 0) * quantity)
                })

        # 4. 给出建议
        if readiness_rate == 100:
            recommendation = "物料完全齐套，建议立即插单。"
            if impacted_orders:
                recommendation += f" 注意：将导致 {len(impacted_orders)} 个现有工单物料短缺。"
        elif readiness_rate >= 80:
            recommendation = "物料基本齐套，可考虑通过调拨补齐后插单。"
        else:
            recommendation = "严重缺料，不建议此时插单，以免造成生产停滞。"

        from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService

        score_svc = WorkOrderScoreService()
        scheduling_score_preview = None
        if await score_svc.is_score_enabled(tenant_id):
            hypo_wo = WorkOrder(
                tenant_id=tenant_id,
                id=0,
                code="__SIM__",
                product_id=product_id,
                quantity=Decimal(str(quantity)),
                priority=params.get("priority") or "urgent",
                planned_start_date=planned_start,
                planned_end_date=planned_end,
                status="draft",
            )
            scheduling_score_preview = await score_svc.preview_scheduling_rank(
                tenant_id,
                hypo_wo,
                kitting_rate=readiness_rate,
            )

            if impacted_orders:
                victim_ids = [int(v["work_order_id"]) for v in impacted_orders]
                victim_scores = await score_svc.batch_ensure_scores(
                    tenant_id, victim_ids, "scheduling", include_kitting=False
                )
                for row in impacted_orders:
                    cached = victim_scores.get(int(row["work_order_id"]))
                    if cached:
                        row["scheduling_score"] = cached.composite_score
                        row["scheduling_rank_band"] = cached.rank_band

        return {
            "can_fulfill_material": readiness_rate == 100,
            "readiness_rate": round(readiness_rate, 2),
            "shortage_items": shortage_items,
            "impacted_orders": impacted_orders,
            "resource_load_change": load_changes,
            "recommendation": recommendation,
            "scheduling_score_preview": scheduling_score_preview,
        }
