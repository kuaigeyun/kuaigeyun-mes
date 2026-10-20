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
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat


class ProductionControlService:
    """
    管控塔核心服务类
    """
    
    def __init__(self):
        self.work_order_service = WorkOrderService()

    async def get_global_material_readiness(
        self,
        tenant_id: int,
        *,
        limit: int = 80,
        concurrency: int = 8,
    ) -> List[Dict[str, Any]]:
        """
        获取进行中/待执行工单的齐套性概览。

        看板场景限制样本数量与并发，避免全量工单双次 BOM 展开拖垮首屏。
        """
        import asyncio

        sample_limit = max(1, min(int(limit or 80), 200))
        worker_limit = max(1, min(int(concurrency or 8), 16))
        target_statuses = ['draft', 'released', 'in_progress']
        work_orders = (
            await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=target_statuses,
                deleted_at__isnull=True,
            )
            .order_by("planned_start_date", "id")
            .limit(sample_limit)
            .all()
        )

        semaphore = asyncio.Semaphore(worker_limit)

        async def analyze_wo(wo):
            async with semaphore:
                try:
                    shortage_info = await self.work_order_service.check_material_shortage(
                        tenant_id=tenant_id,
                        work_order_id=wo.id,
                    )
                    total_vars = int(shortage_info.get("checked_requirement_count") or 0)
                    shortage_vars = int(shortage_info.get("total_shortage_count") or 0)
                    ready_vars = max(0, total_vars - shortage_vars)
                    readiness_rate = (ready_vars / total_vars) if total_vars > 0 else 1.0

                    return {
                        "work_order_id": wo.id,
                        "work_order_code": wo.code,
                        "product_name": wo.product_name,
                        "quantity": float(wo.quantity),
                        "status": wo.status,
                        "readiness_rate": round(readiness_rate * 100, 2),
                        "shortage_count": shortage_vars,
                        "planned_start_date": to_api_isoformat(wo.planned_start_date)
                        if wo.planned_start_date
                        else None,
                    }
                except Exception as e:
                    logger.error(f"分析工单 {wo.id} 齐套性失败: {e}")
                    return None

        results = [
            r
            for r in await asyncio.gather(*[analyze_wo(wo) for wo in work_orders])
            if r is not None
        ]

        if results:
            from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService

            score_svc = WorkOrderScoreService()
            if await score_svc.is_score_enabled(tenant_id):
                wo_ids = [int(r["work_order_id"]) for r in results]
                kitting_rates = {
                    int(r["work_order_id"]): float(r["readiness_rate"]) for r in results
                }
                score_map = await score_svc.batch_ensure_scores(
                    tenant_id,
                    wo_ids,
                    "picking",
                    include_kitting=True,
                    kitting_rates=kitting_rates,
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
        start_date = resolve_business_datetime()
        end_date = start_date + timedelta(days=days)
        
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            status__in=['pending', 'in_progress'],
            planned_start_date__lte=end_date,
            planned_end_date__gte=start_date,
            deleted_at__isnull=True
        ).all()

        work_centers = await WorkCenter.filter(
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True
        ).all()

        wc_map = {wc.id: {"name": wc.name, "total_load": Decimal(0)} for wc in work_centers}

        wo_ids = list({int(op.work_order_id) for op in operations if op.work_order_id})
        wo_qty_map: Dict[int, Decimal] = {}
        if wo_ids:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=wo_ids,
                deleted_at__isnull=True,
            ).only("id", "quantity")
            wo_qty_map = {
                int(wo.id): Decimal(str(wo.quantity or 0)) for wo in work_orders
            }

        for op in operations:
            if op.work_center_id not in wc_map:
                continue
            qty = wo_qty_map.get(int(op.work_order_id), Decimal(0))
            std_time = op.standard_time or Decimal(0)
            wc_map[op.work_center_id]["total_load"] += std_time * qty

        # 简化产能：每天 8 小时 * 指定天数
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

    @staticmethod
    def _normalize_delivery_risk_row(row: Dict[str, Any], **extra: Any) -> Dict[str, Any]:
        normalized = {**row, **extra}
        planned_end = normalized.get("planned_end_date")
        if planned_end is not None and not isinstance(planned_end, str):
            normalized["planned_end_date"] = to_api_isoformat(planned_end)
        so_required = normalized.get("so_required_date")
        if so_required is not None and not isinstance(so_required, str):
            normalized["so_required_date"] = to_api_isoformat(so_required)
        return normalized

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
        delayed_ids = set()
        for d in delayed_orders:
            wo_id = int(d["work_order_id"])
            delayed_ids.add(wo_id)
            results.append(
                self._normalize_delivery_risk_row(
                    d,
                    risk_type="delayed",
                    risk_desc=f"已延期 {d['delay_days']} 天",
                )
            )

        mto_candidates = [
            wo
            for wo in mto_orders
            if wo.sales_order_id and wo.planned_end_date and wo.id not in delayed_ids
        ]
        so_ids = list({int(wo.sales_order_id) for wo in mto_candidates})
        product_ids = list({int(wo.product_id) for wo in mto_candidates if wo.product_id})
        so_items = []
        if so_ids and product_ids:
            so_items = await SalesOrderItem.filter(
                tenant_id=tenant_id,
                sales_order_id__in=so_ids,
                material_id__in=product_ids,
            ).all()
        so_item_map: Dict[tuple, list] = {}
        for soi in so_items:
            key = (int(soi.sales_order_id), int(soi.material_id))
            so_item_map.setdefault(key, []).append(soi)

        for wo in mto_candidates:
            matched_items = so_item_map.get((int(wo.sales_order_id), int(wo.product_id)), [])
            for soi in matched_items:
                if not soi.delivery_date:
                    continue
                if wo.planned_end_date.date() <= soi.delivery_date:
                    continue
                diff = (wo.planned_end_date.date() - soi.delivery_date).days
                results.append(
                    self._normalize_delivery_risk_row(
                        {
                            "work_order_id": wo.id,
                            "work_order_code": wo.code,
                            "product_name": wo.product_name,
                            "status": wo.status,
                            "planned_end_date": wo.planned_end_date,
                            "so_required_date": soi.delivery_date,
                            "delay_days": diff,
                        },
                        risk_type="delivery_clash",
                        risk_desc=f"晚于订单交付 {diff} 天",
                    )
                )
                break
                            
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
                planned_start_date__lte=resolve_business_datetime() + timedelta(days=7)
            ).all()
            
            for victim in potential_victims:
                # 检查 victim 的 BOM 是否与新订单冲突
                v_shortage = await self.work_order_service.check_material_shortage(victim.id)
                # 模拟逻辑：如果新订单拿走了物料，victim 本来不缺的现在缺了，即为受影响
                # 此处由于是模拟，我们只标识“物料冲突”类型
                # (实际生产环境需要更精细的库存分配预演)
                from apps.kuaizhizao.utils.mrp_bom_snapshot import bom_expand_kwargs_from_work_order

                v_requirements = await calculate_material_requirements_from_bom(
                    tenant_id=tenant_id,
                    material_id=victim.product_id,
                    required_quantity=float(victim.quantity),
                    **bom_expand_kwargs_from_work_order(victim),
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

    async def get_human_machine_efficiency(self, tenant_id: int, days: int = 7) -> Dict[str, Any]:
        """人机效同屏：设备稼动趋势 + 人员报工工时排行（单次报工扫描，禁止按日×设备反复算 OEE）。"""
        from apps.kuaizhizao.models.equipment import Equipment
        from apps.kuaizhizao.utils.working_time import load_scheduling_work_context

        span_days = max(1, min(int(days or 7), 30))
        now = resolve_business_datetime()
        start = (now - timedelta(days=span_days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end = now.replace(hour=23, minute=59, second=59, microsecond=0)

        _, work_hours, _ = await load_scheduling_work_context(
            tenant_id, around=start.date(), span_days=span_days + 2
        )
        daily_capacity = max(1.0, work_hours.daily_net_hours())

        equipment_rows = await Equipment.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, is_active=True
        ).only("id", "code").limit(50)
        equipment_ids = {int(row.id) for row in equipment_rows if row.id is not None}
        equipment_code_to_id = {
            str(row.code): int(row.id)
            for row in equipment_rows
            if row.id is not None and row.code
        }

        records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            reported_at__gte=start,
            reported_at__lte=end,
        ).only(
            "worker_id",
            "worker_name",
            "work_hours",
            "reported_at",
            "device_info",
            "status",
        )

        day_equipment_hours: Dict[str, float] = {}
        day_worker_hours: Dict[str, float] = {}
        ranking_map: Dict[int, Dict[str, Any]] = {}

        for record in records:
            reported_at = record.reported_at
            if not reported_at:
                continue
            period = reported_at.strftime("%Y-%m-%d")
            hours = float(record.work_hours or 0)
            day_worker_hours[period] = day_worker_hours.get(period, 0.0) + hours

            worker_id = int(record.worker_id or 0)
            if worker_id > 0:
                bucket = ranking_map.setdefault(
                    worker_id,
                    {
                        "worker_id": worker_id,
                        "worker_name": record.worker_name or f"员工{worker_id}",
                        "report_hours": 0.0,
                    },
                )
                bucket["report_hours"] += hours

            if str(record.status or "").lower() != "approved":
                continue
            device_info = record.device_info if isinstance(record.device_info, dict) else None
            if not device_info:
                continue
            device_id = device_info.get("equipment_id") or device_info.get("id")
            device_code = device_info.get("equipment_code") or device_info.get("code")
            matched_id = None
            try:
                if device_id is not None and int(device_id) in equipment_ids:
                    matched_id = int(device_id)
            except (TypeError, ValueError):
                matched_id = None
            if matched_id is None and device_code:
                matched_id = equipment_code_to_id.get(str(device_code))
            if matched_id is None:
                continue
            day_equipment_hours[period] = day_equipment_hours.get(period, 0.0) + hours

        trend: List[Dict[str, Any]] = []
        utilization_samples: List[float] = []
        for offset in range(span_days):
            day_start = start + timedelta(days=offset)
            period = day_start.strftime("%Y-%m-%d")
            actual_runtime = day_equipment_hours.get(period, 0.0)
            equipment_utilization_rate = round(
                min(100.0, actual_runtime / daily_capacity * 100), 2
            )
            utilization_samples.append(equipment_utilization_rate)
            trend.append(
                {
                    "period": period,
                    "equipment_utilization_rate": equipment_utilization_rate,
                    "worker_report_hours": round(day_worker_hours.get(period, 0.0), 2),
                }
            )

        worker_ranking = sorted(
            [
                {
                    **item,
                    "report_hours": round(float(item["report_hours"]), 2),
                }
                for item in ranking_map.values()
            ],
            key=lambda item: (-item["report_hours"], item["worker_name"]),
        )[:10]

        equipment_utilization_rate = (
            round(sum(utilization_samples) / len(utilization_samples), 2)
            if utilization_samples
            else 0.0
        )
        worker_report_hours = round(
            sum(point["worker_report_hours"] for point in trend), 2
        )

        return {
            "days": span_days,
            "equipment_utilization_rate": equipment_utilization_rate,
            "worker_report_hours": worker_report_hours,
            "trend": trend,
            "worker_ranking": worker_ranking,
        }
