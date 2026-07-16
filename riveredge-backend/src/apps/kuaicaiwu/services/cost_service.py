"""
成本核算服务模块（轻管理会计）

提供成本核算规则、成本核算记录等核心业务逻辑。
生产成本、委外成本等专项核算服务仍在 kuaizhizao。

Author: Luigi Lu
Date: 2026-01-05
"""

import uuid
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal
from tortoise.transactions import in_transaction
from tortoise.queryset import Q
from tortoise.exceptions import IntegrityError

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.cost_rule import CostRule
from apps.kuaicaiwu.models.cost_calculation import CostCalculation
from apps.kuaicaiwu.models.standard_cost import StandardCost
from apps.kuaicaiwu.services.standard_cost_service import standard_cost_effective_q
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.master_data.models.material import Material
from apps.kuaizhizao.schemas.cost import (
    CostRuleCreate,
    CostRuleUpdate,
    CostRuleResponse,
    CostRuleListResponse,
    CostCalculationCreate,
    CostCalculationUpdate,
    CostCalculationResponse,
    CostCalculationListResponse,
    WorkOrderCostCalculationRequest,
    ProductCostCalculationRequest,
    CostComparisonResponse,
    CostAnalysisResponse,
    CostOptimizationResponse,
)
from loguru import logger
from core.utils.timezone_utils import to_api_isoformat


class CostRuleService(AppBaseService[CostRule]):
    """成本核算规则服务类"""

    def __init__(self):
        super().__init__(CostRule)

    async def create_cost_rule(
        self,
        tenant_id: int,
        cost_rule_data: CostRuleCreate,
        created_by: int
    ) -> CostRuleResponse:
        async with in_transaction():
            if not cost_rule_data.code:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="COST_RULE_CODE",
                    prefix=f"CR{today}"
                )
            else:
                code = cost_rule_data.code

            existing_rule = await CostRule.filter(tenant_id=tenant_id, code=code, deleted_at__isnull=True).first()
            if existing_rule:
                raise ValidationError(f"成本核算规则编码 {code} 已存在")

            user_info = await self.get_user_info(created_by)

            cost_rule = await CostRule.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=cost_rule_data.name,
                rule_type=cost_rule_data.rule_type,
                cost_type=cost_rule_data.cost_type,
                calculation_method=cost_rule_data.calculation_method,
                allocation_basis=cost_rule_data.allocation_basis,
                wip_valuation_method=cost_rule_data.wip_valuation_method,
                source_module=cost_rule_data.source_module,
                calculation_formula=cost_rule_data.calculation_formula,
                rule_parameters=cost_rule_data.rule_parameters,
                is_active=cost_rule_data.is_active,
                description=cost_rule_data.description,
                created_by=created_by,
                updated_by=created_by,
                created_by_name=user_info["name"],
                updated_by_name=user_info["name"],
            )

            return CostRuleResponse.model_validate(cost_rule)

    async def get_cost_rule_by_id(self, tenant_id: int, cost_rule_id: int) -> CostRuleResponse:
        cost_rule = await self.get_by_id(tenant_id, cost_rule_id, raise_if_not_found=True)
        return CostRuleResponse.model_validate(cost_rule)

    async def list_cost_rules(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        rule_type: Optional[str] = None,
        cost_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> tuple[List[CostRuleResponse], int]:
        from apps.kuaicaiwu.services.cost_list_core import apply_cost_rule_list_filters

        query = CostRule.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        kw = keyword or search
        query, order_expr = apply_cost_rule_list_filters(
            query,
            keyword=kw,
            code=code,
            name=name,
            rule_type=rule_type,
            cost_type=cost_type,
            is_active=is_active,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_field,
            sort_order=sort_order,
        )
        total = await query.count()
        rules = await query.offset(skip).limit(limit).order_by(order_expr)
        return [CostRuleResponse.model_validate(rule) for rule in rules], total

    async def update_cost_rule(
        self,
        tenant_id: int,
        cost_rule_id: int,
        cost_rule_data: CostRuleUpdate,
        updated_by: int
    ) -> CostRuleResponse:
        async with in_transaction():
            cost_rule = await self.get_by_id(tenant_id, cost_rule_id, raise_if_not_found=True)
            user_info = await self.get_user_info(updated_by)
            update_data = cost_rule_data.model_dump(exclude_unset=True)
            await cost_rule.update_from_dict({
                **update_data,
                "updated_by": updated_by,
                "updated_by_name": user_info["name"],
            }).save()
            return CostRuleResponse.model_validate(cost_rule)

    async def delete_cost_rule(self, tenant_id: int, cost_rule_id: int) -> None:
        async with in_transaction():
            cost_rule = await self.get_by_id(tenant_id, cost_rule_id, raise_if_not_found=True)
            cost_rule.deleted_at = datetime.utcnow()
            await cost_rule.save()

    async def init_preset_rules(self, tenant_id: int, created_by: int):
        """初始化中小制造企业常用成本核算规则（最佳实践）"""
        logger.debug("init_preset_rules tenant_id={} created_by={}", tenant_id, created_by)
        presets = [
            {
                "code": "RULE_VARIETY_001",
                "name": "标准品种法-材料/人工/全费用",
                "rule_type": "材料成本",
                "cost_type": "直接材料",
                "calculation_method": "按数量",
                "allocation_basis": "产量",
                "source_module": "仓库",
                "is_active": True,
                "description": "适用于产品品种较少，且每个品种大批量生产的企业",
            },
            {
                "code": "RULE_JOB_ORDER_002",
                "name": "工单订单法-按单核算",
                "rule_type": "人工成本",
                "cost_type": "直接人工",
                "calculation_method": "按工时",
                "allocation_basis": "工时",
                "source_module": "报工",
                "is_active": True,
                "description": "适用于单件小批生产，如模具、特种设备制造",
            },
            {
                "code": "RULE_OVERHEAD_003",
                "name": "制造费用-工时分摊",
                "rule_type": "制造费用",
                "cost_type": "制造费用",
                "calculation_method": "按工时",
                "allocation_basis": "工时",
                "source_module": "报工",
                "is_active": True,
                "description": "月结与工单制造费用按报工工时分摊",
            },
            {
                "code": "RULE_OVERHEAD_004",
                "name": "制造费用-材料比例分摊",
                "rule_type": "制造费用",
                "cost_type": "制造费用",
                "calculation_method": "按比例",
                "allocation_basis": "产量",
                "rule_parameters": {"ratio": 0.1},
                "source_module": "仓库",
                "is_active": True,
                "description": "工单制造费用按直接材料成本比例分摊",
            },
        ]

        user_info = await self.get_user_info(created_by)
        for p in presets:
            code = p["code"]
            exists = await CostRule.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True,
            ).first()
            if exists:
                continue
            try:
                await CostRule.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    code=code,
                    name=p["name"],
                    rule_type=p["rule_type"],
                    cost_type=p["cost_type"],
                    calculation_method=p["calculation_method"],
                    allocation_basis=p.get("allocation_basis"),
                    source_module=p.get("source_module"),
                    calculation_formula=None,
                    rule_parameters=p.get("rule_parameters"),
                    is_active=p.get("is_active", True),
                    description=p.get("description"),
                    created_by=created_by,
                    created_by_name=user_info["name"],
                    updated_by=created_by,
                    updated_by_name=user_info["name"],
                )
            except IntegrityError:
                # 并发插入或历史软删记录仍占唯一键时，视为已存在
                pass


class CostCalculationService(AppBaseService[CostCalculation]):
    """成本核算服务类"""

    def __init__(self):
        super().__init__(CostCalculation)
        self.cost_rule_service = CostRuleService()

    async def refresh_realtime_costs(
        self,
        tenant_id: int,
        created_by: int,
        lookback_hours: int = 24,
        max_work_orders: int = 50,
    ) -> Dict[str, Any]:
        """
        近实时增量刷新工单成本：
        - 从最近报工/领料变更中提取脏工单
        - 仅重算落后于最新业务事件的工单
        """
        now = datetime.now()
        cutoff = now - timedelta(hours=max(1, min(lookback_hours, 168)))

        reporting_rows = await ReportingRecord.filter(
            tenant_id=tenant_id,
            reported_at__gte=cutoff,
            status="approved",
            deleted_at__isnull=True,
        ).all()
        picking_rows = await ProductionPicking.filter(
            tenant_id=tenant_id,
            picking_time__gte=cutoff,
            status="已完成",
            deleted_at__isnull=True,
        ).all()

        latest_activity: Dict[int, datetime] = {}
        for row in reporting_rows:
            ts = getattr(row, "reported_at", None)
            if getattr(row, "work_order_id", None) and ts:
                current = latest_activity.get(row.work_order_id)
                latest_activity[row.work_order_id] = ts if not current or ts > current else current
        for row in picking_rows:
            ts = getattr(row, "picking_time", None)
            if getattr(row, "work_order_id", None) and ts:
                current = latest_activity.get(row.work_order_id)
                latest_activity[row.work_order_id] = ts if not current or ts > current else current

        candidate_ids = list(latest_activity.keys())[: max(1, max_work_orders)]
        refreshed_work_order_ids: List[int] = []
        skipped_fresh_work_order_ids: List[int] = []
        failed_work_order_ids: List[int] = []

        for work_order_id in candidate_ids:
            latest_calc = await CostCalculation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                calculation_type="工单成本",
                deleted_at__isnull=True,
            ).order_by("-created_at").first()
            latest_event_time = latest_activity[work_order_id]
            if latest_calc and latest_calc.created_at and latest_calc.created_at >= latest_event_time:
                skipped_fresh_work_order_ids.append(work_order_id)
                continue
            try:
                await self.calculate_work_order_cost(
                    tenant_id=tenant_id,
                    request=WorkOrderCostCalculationRequest(
                        work_order_id=work_order_id,
                        calculation_date=now.date(),
                        remark="系统自动增量刷新（近实时）",
                    ),
                    created_by=created_by,
                )
                refreshed_work_order_ids.append(work_order_id)
            except Exception:
                failed_work_order_ids.append(work_order_id)

        return {
            "lookback_hours": lookback_hours,
            "candidate_count": len(candidate_ids),
            "refreshed_count": len(refreshed_work_order_ids),
            "skipped_fresh_count": len(skipped_fresh_work_order_ids),
            "failed_count": len(failed_work_order_ids),
            "refreshed_work_order_ids": refreshed_work_order_ids,
            "skipped_fresh_work_order_ids": skipped_fresh_work_order_ids,
            "failed_work_order_ids": failed_work_order_ids,
            "generated_at": to_api_isoformat(now),
            "sla_target": "T+0 明细（近实时增量刷新）",
        }

    async def _get_standard_value(self, tenant_id: int, target_type: str, target_id: int, item_type: str) -> Decimal:
        """从标准成本库取费率；缺失时明确报错，不编造默认价。"""
        if not target_id:
            raise ValidationError(f"未指定{target_type}，无法获取{item_type}")
        ref_date = date.today()
        sc = await StandardCost.filter(
            tenant_id=tenant_id,
            target_type=target_type,
            target_id=target_id,
            cost_item_type=item_type,
            is_active=True,
            deleted_at__isnull=True,
        ).filter(standard_cost_effective_q(ref_date)).order_by("-effective_date", "-id").first()
        if sc and sc.standard_value is not None:
            return sc.standard_value
        raise ValidationError(
            f"未维护标准成本：{target_type}#{target_id} 的 {item_type}，请在标准成本库中配置"
        )

    async def _has_standard_value(
        self, tenant_id: int, target_type: str, target_id: Optional[int], item_type: str
    ) -> bool:
        if not target_id:
            return False
        ref_date = date.today()
        sc = await StandardCost.filter(
            tenant_id=tenant_id,
            target_type=target_type,
            target_id=int(target_id),
            cost_item_type=item_type,
            is_active=True,
            deleted_at__isnull=True,
        ).filter(standard_cost_effective_q(ref_date)).order_by("-effective_date", "-id").first()
        return sc is not None and sc.standard_value is not None

    @staticmethod
    def _append_factor(
        factors: List[Dict[str, Any]],
        *,
        key: str,
        category: str,
        status: str,
        message: str,
        hint: Optional[str] = None,
    ) -> None:
        factors.append(
            {
                "key": key,
                "category": category,
                "status": status,
                "message": message,
                "hint": hint,
            }
        )

    async def _resolve_work_order_work_center_id(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        reporting_records: Optional[List[ReportingRecord]] = None,
    ) -> Optional[int]:
        if work_order.work_center_id:
            return int(work_order.work_center_id)
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

        op = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            deleted_at__isnull=True,
            work_center_id__not_isnull=True,
        ).order_by("sequence").first()
        if op and op.work_center_id:
            return int(op.work_center_id)
        records = reporting_records
        if records is None:
            records = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                status="approved",
                deleted_at__isnull=True,
            ).all()
        for record in records:
            if record.work_center_id:
                return int(record.work_center_id)
        return None

    async def preview_work_order_cost_readiness(
        self, tenant_id: int, work_order_id: int
    ) -> Dict[str, Any]:
        from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService

        work_order = await WorkOrder.filter(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        ).first()
        if not work_order:
            raise NotFoundError(f"工单 {work_order_id} 不存在")

        factors: List[Dict[str, Any]] = []
        cost_svc = InventoryCostService()
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status__in=("已确认", "已完成"),
            deleted_at__isnull=True,
        ).all()
        if not pickings:
            self._append_factor(
                factors,
                key="material_picking",
                category="material",
                status="warning",
                message="无已确认/已完成的领料单",
                hint="材料成本将按 0 核算；如需材料成本请先完成领料",
            )
        else:
            self._append_factor(
                factors,
                key="material_picking",
                category="material",
                status="ready",
                message=f"领料单 {len(pickings)} 张",
            )
            seen_materials: set[int] = set()
            for picking in pickings:
                items = await ProductionPickingItem.filter(
                    tenant_id=tenant_id,
                    picking_id=picking.id,
                ).all()
                for item in items:
                    mid = int(item.material_id)
                    if mid in seen_materials:
                        continue
                    seen_materials.add(mid)
                    unit_cost = await cost_svc.get_material_unit_cost(tenant_id, mid)
                    label = f"{item.material_code} {item.material_name}".strip()
                    if unit_cost is None:
                        self._append_factor(
                            factors,
                            key=f"material_unit_cost_{mid}",
                            category="material",
                            status="missing",
                            message=f"物料「{label}」未维护单位成本",
                            hint="请在标准成本库或物料成本中配置该物料单价",
                        )
                    else:
                        self._append_factor(
                            factors,
                            key=f"material_unit_cost_{mid}",
                            category="material",
                            status="ready",
                            message=f"物料「{label}」单位成本 ¥{unit_cost}",
                        )

        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status="approved",
            deleted_at__isnull=True,
        ).all()
        if not reporting_records:
            self._append_factor(
                factors,
                key="labor_reporting",
                category="labor",
                status="warning",
                message="无已审核报工记录",
                hint="人工成本将按 0 核算",
            )
        else:
            total_hours = sum((Decimal(str(r.work_hours or 0)) for r in reporting_records), Decimal("0"))
            self._append_factor(
                factors,
                key="labor_reporting",
                category="labor",
                status="ready",
                message=f"已审核报工 {len(reporting_records)} 条，合计 {float(total_hours):.2f} 工时",
            )
            seen_wc: set[int] = set()
            for record in reporting_records:
                op_label = record.operation_name or record.operation_code or f"报工#{record.id}"
                if not record.work_center_id:
                    self._append_factor(
                        factors,
                        key=f"labor_wc_{record.id}",
                        category="labor",
                        status="missing",
                        message=f"报工「{op_label}」未指定工作中心",
                        hint="请在报工或工单工序中指定工作中心",
                    )
                    continue
                wc_id = int(record.work_center_id)
                if wc_id in seen_wc:
                    continue
                seen_wc.add(wc_id)
                if await self._has_standard_value(tenant_id, "work_center", wc_id, "labor_rate"):
                    self._append_factor(
                        factors,
                        key=f"labor_rate_{wc_id}",
                        category="labor",
                        status="ready",
                        message=f"工作中心 #{wc_id} 已维护人工费率",
                    )
                else:
                    self._append_factor(
                        factors,
                        key=f"labor_rate_{wc_id}",
                        category="labor",
                        status="missing",
                        message=f"工作中心 #{wc_id} 未维护人工费率 (labor_rate)",
                        hint="请在标准成本库为该工作中心配置 labor_rate",
                    )

        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        total_report_hours = sum(
            (Decimal(str(r.work_hours or 0)) for r in reporting_records), Decimal("0")
        )
        work_center_id = await self._resolve_work_order_work_center_id(
            tenant_id, work_order, reporting_records
        )
        if not rules:
            self._append_factor(
                factors,
                key="manufacturing_rules",
                category="manufacturing",
                status="warning",
                message="未配置启用的制造费用规则",
                hint="制造费用将按 0 核算",
            )
        else:
            self._append_factor(
                factors,
                key="manufacturing_rules",
                category="manufacturing",
                status="ready",
                message=f"制造费用规则 {len(rules)} 条",
            )
            for rule in rules:
                rule_key = f"manufacturing_rule_{rule.id}"
                if rule.calculation_method == "按比例":
                    params = rule.rule_parameters if isinstance(rule.rule_parameters, dict) else {}
                    if "ratio" in params:
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="ready",
                            message=f"规则「{rule.name}」按比例分摊（{params['ratio']}）",
                        )
                    else:
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="missing",
                            message=f"规则「{rule.name}」未配置分摊比例 parameters.ratio",
                            hint="请在成本核算规则中补全分摊比例",
                        )
                elif rule.calculation_method == "按工时":
                    if total_report_hours <= 0:
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="warning",
                            message=f"规则「{rule.name}」按工时：无报工工时，费用为 0",
                        )
                    elif not work_center_id:
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="missing",
                            message=f"规则「{rule.name}」按工时：未解析到工作中心，无法获取 overhead_rate",
                            hint="请在工单、工单工序或报工记录上指定工作中心",
                        )
                    elif await self._has_standard_value(
                        tenant_id, "work_center", work_center_id, "overhead_rate"
                    ):
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="ready",
                            message=f"规则「{rule.name}」按工时：工作中心 #{work_center_id} 已维护 overhead_rate",
                        )
                    else:
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="missing",
                            message=f"规则「{rule.name}」按工时：工作中心 #{work_center_id} 未维护 overhead_rate",
                            hint="请在标准成本库为该工作中心配置 overhead_rate",
                        )

        blocking_count = sum(1 for f in factors if f["status"] == "missing")
        warning_count = sum(1 for f in factors if f["status"] == "warning")
        target_label = f"{work_order.code} {work_order.product_name or ''}".strip()
        return {
            "target_type": "work_order",
            "target_id": work_order_id,
            "target_label": target_label,
            "ready": blocking_count == 0,
            "blocking_count": blocking_count,
            "warning_count": warning_count,
            "factors": factors,
        }

    async def preview_product_cost_readiness(
        self,
        tenant_id: int,
        product_id: int,
        quantity: Decimal,
    ) -> Dict[str, Any]:
        from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
        from apps.master_data.models.process import ProcessRoute
        from apps.kuaizhizao.utils.bom_helper import get_bom_items_by_material_id

        product = await Material.filter(
            tenant_id=tenant_id, id=product_id, deleted_at__isnull=True
        ).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")

        factors: List[Dict[str, Any]] = []
        cost_svc = InventoryCostService()
        bom_items = await get_bom_items_by_material_id(
            tenant_id=tenant_id, material_id=product.id, only_approved=True
        )
        if not bom_items:
            unit_cost = await cost_svc.get_material_unit_cost(tenant_id, product.id)
            label = f"{product.main_code or product.code} {product.name}".strip()
            if unit_cost is None:
                self._append_factor(
                    factors,
                    key="material_self_cost",
                    category="material",
                    status="missing",
                    message=f"产品「{label}」无 BOM 且未维护单位成本",
                    hint="请维护 BOM 或在标准成本库配置物料单价",
                )
            else:
                self._append_factor(
                    factors,
                    key="material_self_cost",
                    category="material",
                    status="ready",
                    message=f"产品「{label}」单位成本 ¥{unit_cost}（数量 {quantity}）",
                )
        else:
            self._append_factor(
                factors,
                key="material_bom",
                category="material",
                status="ready",
                message=f"已关联 BOM，共 {len(bom_items)} 个组件",
            )
            for bom_item in bom_items:
                component = await bom_item.component
                if not component:
                    continue
                cid = int(component.id)
                unit_cost = await cost_svc.get_material_unit_cost(tenant_id, cid)
                label = f"{component.main_code or component.code} {component.name}".strip()
                if unit_cost is None:
                    self._append_factor(
                        factors,
                        key=f"material_bom_{cid}",
                        category="material",
                        status="missing",
                        message=f"BOM 组件「{label}」未维护单位成本",
                        hint="请在标准成本库配置该组件物料单价",
                    )
                else:
                    self._append_factor(
                        factors,
                        key=f"material_bom_{cid}",
                        category="material",
                        status="ready",
                        message=f"BOM 组件「{label}」单位成本 ¥{unit_cost}",
                    )

        route_rows: List[Dict[str, Any]] = []
        if product.process_route_id:
            route = await ProcessRoute.filter(
                tenant_id=tenant_id, id=product.process_route_id, deleted_at__isnull=True
            ).first()
            if route:
                route_rows = self._flatten_operation_sequence(route.operation_sequence)
        if not route_rows:
            self._append_factor(
                factors,
                key="labor_process_route",
                category="labor",
                status="warning",
                message="产品未配置工艺路线或工序序列为空",
                hint="将尝试使用历史报工工时；若无报工则无法核算人工",
            )
        else:
            self._append_factor(
                factors,
                key="labor_process_route",
                category="labor",
                status="ready",
                message=f"工艺路线含 {len(route_rows)} 道工序",
            )
            operation_map, uuid_to_operation = await self._load_operations_for_route_rows(
                tenant_id, route_rows
            )
            ops_with_time = 0
            for op_data in route_rows:
                std_time = self._operation_std_time_hours(op_data)
                op_name = self._op_display_name(op_data, operation_map, uuid_to_operation)
                if std_time <= 0:
                    self._append_factor(
                        factors,
                        key=f"labor_std_time_{op_name}",
                        category="labor",
                        status="warning",
                        message=f"工序「{op_name}」未维护标准工时",
                        hint="请在工艺路线维护标准工时，或依赖历史报工",
                    )
                    continue
                ops_with_time += 1
                wc_id = self._resolve_operation_work_center_id(
                    op_data, operation_map, uuid_to_operation
                )
                if not wc_id:
                    self._append_factor(
                        factors,
                        key=f"labor_wc_{op_name}",
                        category="labor",
                        status="missing",
                        message=f"工序「{op_name}」未配置工作中心",
                        hint="请在工序主数据设置默认工作中心",
                    )
                elif await self._has_standard_value(
                    tenant_id, "work_center", wc_id, "labor_rate"
                ):
                    self._append_factor(
                        factors,
                        key=f"labor_rate_{op_name}",
                        category="labor",
                        status="ready",
                        message=f"工序「{op_name}」：{float(std_time):.4f}h × 工作中心 #{wc_id} 人工费率已配置",
                    )
                else:
                    self._append_factor(
                        factors,
                        key=f"labor_rate_{op_name}",
                        category="labor",
                        status="missing",
                        message=f"工序「{op_name}」：工作中心 #{wc_id} 未维护 labor_rate",
                        hint="请在标准成本库配置人工费率",
                    )
            if ops_with_time == 0:
                wc_id = await self._resolve_product_work_center_id(tenant_id, product)
                if wc_id and await self._has_standard_value(
                    tenant_id, "work_center", wc_id, "labor_rate"
                ):
                    self._append_factor(
                        factors,
                        key="labor_fallback_wc",
                        category="labor",
                        status="warning",
                        message="工序均无标准工时，可尝试历史报工 + 工作中心人工费率",
                    )
                elif not wc_id:
                    self._append_factor(
                        factors,
                        key="labor_fallback_wc",
                        category="labor",
                        status="missing",
                        message="无标准工时且未配置工作中心，无法核算人工成本",
                        hint="请维护工艺路线标准工时与工作中心",
                    )

        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        if not rules:
            self._append_factor(
                factors,
                key="manufacturing_rules",
                category="manufacturing",
                status="warning",
                message="未配置启用的制造费用规则",
                hint="制造费用将按 0 核算",
            )
        else:
            self._append_factor(
                factors,
                key="manufacturing_rules",
                category="manufacturing",
                status="ready",
                message=f"制造费用规则 {len(rules)} 条",
            )
            total_std_hours = await self._sum_product_std_time_hours(tenant_id, product)
            for rule in rules:
                rule_key = f"manufacturing_rule_{rule.id}"
                if rule.calculation_method == "按比例":
                    params = rule.rule_parameters if isinstance(rule.rule_parameters, dict) else {}
                    if "ratio" in params:
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="ready",
                            message=f"规则「{rule.name}」按比例分摊（{params['ratio']}）",
                        )
                    else:
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="missing",
                            message=f"规则「{rule.name}」未配置分摊比例 parameters.ratio",
                        )
                elif rule.calculation_method == "按工时":
                    if total_std_hours <= 0:
                        self._append_factor(
                            factors,
                            key=rule_key,
                            category="manufacturing",
                            status="warning",
                            message=f"规则「{rule.name}」按工时：无标准工时，费用为 0",
                        )
                    elif route_rows:
                        operation_map, uuid_to_operation = await self._load_operations_for_route_rows(
                            tenant_id, route_rows
                        )
                        missing_wc = False
                        missing_rate = False
                        for op_data in route_rows:
                            std_time = self._operation_std_time_hours(op_data)
                            if std_time <= 0:
                                continue
                            op_name = self._op_display_name(
                                op_data, operation_map, uuid_to_operation
                            )
                            wc_id = self._resolve_operation_work_center_id(
                                op_data, operation_map, uuid_to_operation
                            )
                            if not wc_id:
                                missing_wc = True
                                self._append_factor(
                                    factors,
                                    key=f"{rule_key}_wc_{op_name}",
                                    category="manufacturing",
                                    status="missing",
                                    message=f"规则「{rule.name}」：工序「{op_name}」未配置工作中心",
                                )
                            elif not await self._has_standard_value(
                                tenant_id, "work_center", wc_id, "overhead_rate"
                            ):
                                missing_rate = True
                                self._append_factor(
                                    factors,
                                    key=f"{rule_key}_rate_{wc_id}",
                                    category="manufacturing",
                                    status="missing",
                                    message=f"规则「{rule.name}」：工作中心 #{wc_id} 未维护 overhead_rate",
                                )
                        if not missing_wc and not missing_rate:
                            self._append_factor(
                                factors,
                                key=rule_key,
                                category="manufacturing",
                                status="ready",
                                message=f"规则「{rule.name}」按工时：工序工作中心与 overhead_rate 已就绪",
                            )
                    else:
                        wc_id = await self._resolve_product_work_center_id(tenant_id, product)
                        if not wc_id:
                            self._append_factor(
                                factors,
                                key=rule_key,
                                category="manufacturing",
                                status="missing",
                                message=f"规则「{rule.name}」按工时：未配置工作中心",
                            )
                        elif await self._has_standard_value(
                            tenant_id, "work_center", wc_id, "overhead_rate"
                        ):
                            self._append_factor(
                                factors,
                                key=rule_key,
                                category="manufacturing",
                                status="ready",
                                message=f"规则「{rule.name}」按工时：工作中心 #{wc_id} overhead_rate 已配置",
                            )
                        else:
                            self._append_factor(
                                factors,
                                key=rule_key,
                                category="manufacturing",
                                status="missing",
                                message=f"规则「{rule.name}」按工时：工作中心 #{wc_id} 未维护 overhead_rate",
                            )

        blocking_count = sum(1 for f in factors if f["status"] == "missing")
        warning_count = sum(1 for f in factors if f["status"] == "warning")
        target_label = f"{product.main_code or product.code} {product.name}".strip()
        return {
            "target_type": "product",
            "target_id": product_id,
            "target_label": target_label,
            "ready": blocking_count == 0,
            "blocking_count": blocking_count,
            "warning_count": warning_count,
            "factors": factors,
        }

    @staticmethod
    def _flatten_operation_sequence(sequence_data: Any) -> List[Dict[str, Any]]:
        """解析工艺路线工序序列（兼容 list 与前端 {sequence, operations} 字典格式）。"""
        if not sequence_data:
            return []
        rows: List[Dict[str, Any]] = []
        if isinstance(sequence_data, list):
            for item in sequence_data:
                if isinstance(item, dict):
                    rows.append(item)
            return rows
        if not isinstance(sequence_data, dict):
            return []
        ops = sequence_data.get("operations")
        seq_uuids = sequence_data.get("sequence")
        if isinstance(ops, list) and isinstance(seq_uuids, list) and seq_uuids:
            op_by_uuid: Dict[str, Dict[str, Any]] = {}
            for op_obj in ops:
                if not isinstance(op_obj, dict):
                    continue
                op_uuid = op_obj.get("uuid") or op_obj.get("operation_uuid")
                if op_uuid:
                    op_by_uuid[str(op_uuid)] = op_obj
            for op_uuid in seq_uuids:
                if isinstance(op_uuid, str) and op_uuid in op_by_uuid:
                    rows.append(op_by_uuid[op_uuid])
            return rows
        if isinstance(ops, list):
            return [o for o in ops if isinstance(o, dict)]
        if isinstance(seq_uuids, list):
            return [{"uuid": u} for u in seq_uuids if isinstance(u, str)]
        return []

    @staticmethod
    def _operation_std_time_hours(op_data: Dict[str, Any]) -> Decimal:
        return Decimal(
            str(
                op_data.get("std_time")
                or op_data.get("standard_time")
                or op_data.get("standardTime")
                or 0
            )
        )

    @staticmethod
    def _resolve_operation_work_center_id(
        op_data: Dict[str, Any],
        operation_map: Dict[int, Any],
        uuid_to_operation: Dict[str, Any],
    ) -> Optional[int]:
        extra = op_data.get("extra_data") if isinstance(op_data.get("extra_data"), dict) else {}
        raw = (
            op_data.get("work_center_id")
            or op_data.get("workCenterId")
            or extra.get("work_center_id")
            or extra.get("workCenterId")
        )
        if raw:
            return int(raw)
        op_id = op_data.get("operation_id") or op_data.get("operationId")
        operation = operation_map.get(int(op_id)) if op_id else None
        if not operation:
            op_uuid = op_data.get("uuid") or op_data.get("operation_uuid")
            if op_uuid:
                operation = uuid_to_operation.get(str(op_uuid))
        if operation and operation.default_work_center_ids:
            wc_ids = operation.default_work_center_ids
            if isinstance(wc_ids, list) and wc_ids:
                return int(wc_ids[0])
        return None

    async def _load_operations_for_route_rows(
        self,
        tenant_id: int,
        rows: List[Dict[str, Any]],
    ) -> tuple[Dict[int, Any], Dict[str, Any]]:
        from apps.master_data.models.process import Operation

        op_ids: set[int] = set()
        uuids: set[str] = set()
        for row in rows:
            oid = row.get("operation_id") or row.get("operationId")
            if oid:
                op_ids.add(int(oid))
            op_uuid = row.get("uuid") or row.get("operation_uuid")
            if op_uuid:
                uuids.add(str(op_uuid))
        operation_map: Dict[int, Any] = {}
        uuid_to_operation: Dict[str, Any] = {}
        if op_ids:
            for op in await Operation.filter(
                tenant_id=tenant_id, id__in=list(op_ids), deleted_at__isnull=True
            ).all():
                operation_map[op.id] = op
                uuid_to_operation[op.uuid] = op
        missing_uuids = uuids - set(uuid_to_operation.keys())
        if missing_uuids:
            for op in await Operation.filter(
                tenant_id=tenant_id, uuid__in=list(missing_uuids), deleted_at__isnull=True
            ).all():
                operation_map[op.id] = op
                uuid_to_operation[op.uuid] = op
        return operation_map, uuid_to_operation

    async def _resolve_product_work_center_id(self, tenant_id: int, product: Material) -> Optional[int]:
        from apps.master_data.models.process import ProcessRoute

        if not product.process_route_id:
            return None
        route = await ProcessRoute.filter(
            tenant_id=tenant_id, id=product.process_route_id, deleted_at__isnull=True
        ).first()
        if not route:
            return None
        rows = self._flatten_operation_sequence(route.operation_sequence)
        if not rows:
            return None
        operation_map, uuid_to_operation = await self._load_operations_for_route_rows(tenant_id, rows)
        for op_data in rows:
            wc_id = self._resolve_operation_work_center_id(op_data, operation_map, uuid_to_operation)
            if wc_id:
                return wc_id
        return None

    def _product_label(self, product: Material) -> str:
        return f"产品 {product.main_code or product.code} {product.name}"

    def _missing_work_center_error(self, product: Material, op_data: Dict[str, Any]) -> ValidationError:
        op_name = op_data.get("name") or op_data.get("code") or "工序"
        return ValidationError(
            f"{self._product_label(product)} 工艺路线工序「{op_name}」未配置工作中心，"
            f"请在工序主数据中设置默认工作中心，或在工艺路线工序上指定工作中心，"
            f"并在标准成本库维护对应工作中心的人工费率"
        )

    async def _calculate_product_labor_cost_from_route(
        self,
        tenant_id: int,
        product: Material,
        quantity: Decimal,
        rows: List[Dict[str, Any]],
    ) -> Decimal:
        operation_map, uuid_to_operation = await self._load_operations_for_route_rows(tenant_id, rows)
        total = Decimal("0")
        for op_data in rows:
            std_time = self._operation_std_time_hours(op_data)
            if std_time <= 0:
                continue
            wc_id = self._resolve_operation_work_center_id(op_data, operation_map, uuid_to_operation)
            if not wc_id:
                raise self._missing_work_center_error(product, op_data)
            hourly_rate = await self._get_standard_value(
                tenant_id, "work_center", wc_id, "labor_rate"
            )
            total += std_time * quantity * hourly_rate
        return total

    async def _sum_product_std_time_hours(
        self,
        tenant_id: int,
        product: Material,
    ) -> Decimal:
        from apps.master_data.models.process import ProcessRoute

        if not product.process_route_id:
            return Decimal("0")
        route = await ProcessRoute.filter(
            tenant_id=tenant_id, id=product.process_route_id, deleted_at__isnull=True
        ).first()
        if not route:
            return Decimal("0")
        total_hours = Decimal("0")
        for op_data in self._flatten_operation_sequence(route.operation_sequence):
            total_hours += self._operation_std_time_hours(op_data)
        return total_hours

    def _rule_overhead_ratio(self, rule: CostRule) -> Decimal:
        params = rule.rule_parameters if isinstance(rule.rule_parameters, dict) else {}
        if "ratio" not in params:
            raise ValidationError(
                f"制造费用规则「{rule.name}」未配置分摊比例 parameters.ratio"
            )
        return Decimal(str(params["ratio"]))

    async def calculate_work_order_cost(
        self,
        tenant_id: int,
        request: WorkOrderCostCalculationRequest,
        created_by: int
    ) -> CostCalculationResponse:
        async with in_transaction():
            work_order = await WorkOrder.filter(tenant_id=tenant_id, id=request.work_order_id, deleted_at__isnull=True).first()
            if not work_order:
                raise NotFoundError(f"工单 {request.work_order_id} 不存在")

            today = datetime.now().strftime("%Y%m%d")
            calculation_no = await self.generate_code(
                tenant_id=tenant_id,
                code_type="COST_CALCULATION_CODE",
                prefix=f"CC{today}"
            )

            material_cost = await self._calculate_material_cost(tenant_id, work_order)
            labor_cost = await self._calculate_labor_cost(tenant_id, work_order)
            manufacturing_cost = await self._calculate_manufacturing_cost(tenant_id, work_order)
            total_cost = material_cost + labor_cost + manufacturing_cost
            unit_cost = total_cost / work_order.quantity if work_order.quantity > 0 else Decimal(0)
            user_info = await self.get_user_info(created_by)

            cost_calculation = await CostCalculation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                calculation_no=calculation_no,
                calculation_type="工单成本",
                work_order_id=work_order.id,
                work_order_code=work_order.code,
                product_id=work_order.product_id,
                product_code=work_order.product_code,
                product_name=work_order.product_name,
                quantity=work_order.quantity,
                material_cost=material_cost,
                labor_cost=labor_cost,
                manufacturing_cost=manufacturing_cost,
                total_cost=total_cost,
                unit_cost=unit_cost,
                cost_details={
                    "material_cost_breakdown": await self._get_material_cost_breakdown(tenant_id, work_order),
                    "labor_cost_breakdown": await self._get_labor_cost_breakdown(tenant_id, work_order),
                    "manufacturing_cost_breakdown": await self._get_manufacturing_cost_breakdown(tenant_id, work_order),
                },
                calculation_date=request.calculation_date or date.today(),
                calculation_status="已核算",
                remark=request.remark,
                created_by=created_by,
                updated_by=created_by,
                created_by_name=user_info["name"],
                updated_by_name=user_info["name"],
            )
            return CostCalculationResponse.model_validate(cost_calculation)

    async def calculate_product_cost(
        self,
        tenant_id: int,
        request: ProductCostCalculationRequest,
        created_by: int
    ) -> CostCalculationResponse:
        async with in_transaction():
            product = await Material.filter(tenant_id=tenant_id, id=request.product_id, deleted_at__isnull=True).first()
            if not product:
                raise NotFoundError(f"产品 {request.product_id} 不存在")

            today = datetime.now().strftime("%Y%m%d")
            calculation_no = await self.generate_code(
                tenant_id=tenant_id,
                code_type="COST_CALCULATION_CODE",
                prefix=f"CC{today}"
            )

            material_cost = await self._calculate_product_material_cost(tenant_id, product, request.quantity)
            labor_cost = await self._calculate_product_labor_cost(tenant_id, product, request.quantity)
            manufacturing_cost = await self._calculate_product_manufacturing_cost(tenant_id, product, request.quantity)
            total_cost = material_cost + labor_cost + manufacturing_cost
            unit_cost = total_cost / request.quantity if request.quantity > 0 else Decimal(0)
            user_info = await self.get_user_info(created_by)

            cost_calculation = await CostCalculation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                calculation_no=calculation_no,
                calculation_type=request.calculation_type,
                product_id=product.id,
                product_code=product.code,
                product_name=product.name,
                quantity=request.quantity,
                material_cost=material_cost,
                labor_cost=labor_cost,
                manufacturing_cost=manufacturing_cost,
                total_cost=total_cost,
                unit_cost=unit_cost,
                cost_details={
                    "material_cost_breakdown": await self._get_product_material_cost_breakdown(tenant_id, product, request.quantity),
                    "labor_cost_breakdown": await self._get_product_labor_cost_breakdown(tenant_id, product, request.quantity),
                    "manufacturing_cost_breakdown": await self._get_product_manufacturing_cost_breakdown(tenant_id, product, request.quantity),
                },
                calculation_date=request.calculation_date or date.today(),
                calculation_status="已核算",
                remark=request.remark,
                created_by=created_by,
                updated_by=created_by,
                created_by_name=user_info["name"],
                updated_by_name=user_info["name"],
            )
            return CostCalculationResponse.model_validate(cost_calculation)

    async def _calculate_material_cost(self, tenant_id: int, work_order: WorkOrder) -> Decimal:
        from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService

        cost_svc = InventoryCostService()
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status__in=("已确认", "已完成"),
            deleted_at__isnull=True
        ).all()
        total_material_cost = Decimal(0)
        for picking in pickings:
            items = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                picking_id=picking.id,
                deleted_at__isnull=True
            ).all()
            for item in items:
                unit_price = await cost_svc.require_material_unit_cost(tenant_id, int(item.material_id))
                total_material_cost += item.picked_quantity * unit_price
        return total_material_cost

    async def _calculate_labor_cost(self, tenant_id: int, work_order: WorkOrder) -> Decimal:
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status="approved",
            deleted_at__isnull=True
        ).all()
        total_labor_cost = Decimal(0)
        for record in reporting_records:
            if not record.work_center_id:
                raise ValidationError(
                    f"报工「{record.operation_name or record.operation_code or record.id}」未指定工作中心，无法获取人工费率"
                )
            hourly_rate = await self._get_standard_value(tenant_id, "work_center", record.work_center_id, "labor_rate")
            total_labor_cost += record.work_hours * hourly_rate
        return total_labor_cost

    async def _calculate_manufacturing_cost(self, tenant_id: int, work_order: WorkOrder) -> Decimal:
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True
        ).all()
        total_manufacturing_cost = Decimal(0)
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status="approved",
            deleted_at__isnull=True,
        ).all()
        total_hours = sum((Decimal(str(r.work_hours or 0)) for r in reporting_records), Decimal("0"))
        for rule in rules:
            if rule.calculation_method == "按工时":
                if total_hours <= 0:
                    continue
                work_center_id = await self._resolve_work_order_work_center_id(
                    tenant_id, work_order, reporting_records
                )
                if not work_center_id:
                    raise ValidationError(
                        f"工单 {work_order.code} 未配置工作中心，无法按工时核算制造费用（规则「{rule.name}」）"
                    )
                rate = await self._get_standard_value(
                    tenant_id, "work_center", work_center_id, "overhead_rate"
                )
                total_manufacturing_cost += total_hours * rate
            elif rule.calculation_method == "按比例":
                material_cost = await self._calculate_material_cost(tenant_id, work_order)
                rate = self._rule_overhead_ratio(rule)
                total_manufacturing_cost += material_cost * rate
        return total_manufacturing_cost

    async def _calculate_product_material_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
        from apps.kuaizhizao.utils.bom_helper import (
            get_bom_items_by_material_id,
            bom_line_required_quantity_decimal,
            bom_item_base_quantity,
        )

        cost_svc = InventoryCostService()
        bom_items = await get_bom_items_by_material_id(
            tenant_id=tenant_id,
            material_id=product.id,
            only_approved=True,
        )
        if not bom_items:
            unit = await cost_svc.require_material_unit_cost(tenant_id, product.id)
            return unit * quantity

        total = Decimal(0)
        for bom_item in bom_items:
            component = await bom_item.component
            if not component:
                continue
            component_qty = bom_line_required_quantity_decimal(
                bom_item.quantity,
                bom_item_base_quantity(bom_item),
                quantity,
                Decimal(str(bom_item.waste_rate or 0)),
            )
            unit_price = await cost_svc.require_material_unit_cost(tenant_id, int(component.id))
            total += component_qty * unit_price
        return total

    async def _calculate_product_labor_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        from apps.master_data.models.process import ProcessRoute
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.models.work_order import WorkOrder

        total_hours = Decimal("0")
        route_labor_cost = Decimal("0")
        if product.process_route_id:
            route = await ProcessRoute.filter(
                tenant_id=tenant_id, id=product.process_route_id, deleted_at__isnull=True
            ).first()
            if route:
                rows = self._flatten_operation_sequence(route.operation_sequence)
                if rows:
                    route_labor_cost = await self._calculate_product_labor_cost_from_route(
                        tenant_id, product, quantity, rows
                    )
                    for op_data in rows:
                        total_hours += self._operation_std_time_hours(op_data)

        if route_labor_cost > 0:
            return route_labor_cost

        if total_hours <= 0:
            recent_wos = await WorkOrder.filter(
                tenant_id=tenant_id,
                product_id=product.id,
                deleted_at__isnull=True,
            ).order_by("-updated_at").limit(20).values_list("id", flat=True)
            if recent_wos:
                records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id__in=list(recent_wos),
                    status="approved",
                    deleted_at__isnull=True,
                ).all()
                total_qty = sum((Decimal(str(r.qualified_quantity or 0)) for r in records), Decimal("0"))
                total_report_hours = sum((Decimal(str(r.work_hours or 0)) for r in records), Decimal("0"))
                if total_qty > 0:
                    total_hours = total_report_hours / total_qty

        if total_hours <= 0:
            raise ValidationError(
                f"{self._product_label(product)} 无可用工时数据，请维护工艺路线标准工时或完成报工"
            )

        work_center_id = await self._resolve_product_work_center_id(tenant_id, product)
        if not work_center_id:
            raise ValidationError(
                f"{self._product_label(product)} 工艺路线未配置工作中心，"
                f"请在工序主数据中设置默认工作中心，并在标准成本库维护人工费率"
            )
        hourly_rate = await self._get_standard_value(
            tenant_id, "work_center", work_center_id, "labor_rate"
        )
        return total_hours * quantity * hourly_rate

    async def _calculate_product_manufacturing_cost(self, tenant_id: int, product: Material, quantity: Decimal) -> Decimal:
        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True
        ).all()
        total_manufacturing_cost = Decimal(0)
        for rule in rules:
            if rule.calculation_method == "按比例":
                material_cost = await self._calculate_product_material_cost(tenant_id, product, quantity)
                rate = self._rule_overhead_ratio(rule)
                total_manufacturing_cost += material_cost * rate
            elif rule.calculation_method == "按工时":
                total_hours = await self._sum_product_std_time_hours(tenant_id, product)
                if total_hours <= 0:
                    raise ValidationError(
                        f"{self._product_label(product)} 无标准工时，无法按工时核算制造费用"
                    )
                rows: List[Dict[str, Any]] = []
                if product.process_route_id:
                    from apps.master_data.models.process import ProcessRoute

                    route = await ProcessRoute.filter(
                        tenant_id=tenant_id, id=product.process_route_id, deleted_at__isnull=True
                    ).first()
                    if route:
                        rows = self._flatten_operation_sequence(route.operation_sequence)
                if rows:
                    operation_map, uuid_to_operation = await self._load_operations_for_route_rows(
                        tenant_id, rows
                    )
                    for op_data in rows:
                        std_time = self._operation_std_time_hours(op_data)
                        if std_time <= 0:
                            continue
                        wc_id = self._resolve_operation_work_center_id(
                            op_data, operation_map, uuid_to_operation
                        )
                        if not wc_id:
                            raise self._missing_work_center_error(product, op_data)
                        rate = await self._get_standard_value(
                            tenant_id, "work_center", wc_id, "overhead_rate"
                        )
                        total_manufacturing_cost += std_time * quantity * rate
                    continue
                work_center_id = await self._resolve_product_work_center_id(tenant_id, product)
                if not work_center_id:
                    raise ValidationError(
                        f"{self._product_label(product)} 工艺路线未配置工作中心，无法核算制造费用"
                    )
                rate = await self._get_standard_value(
                    tenant_id, "work_center", work_center_id, "overhead_rate"
                )
                total_manufacturing_cost += total_hours * quantity * rate
        return total_manufacturing_cost

    async def _get_material_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService

        cost_svc = InventoryCostService()
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id, work_order_id=work_order.id, status__in=("已确认", "已完成")
        ).all()
        breakdown = []
        for p in pickings:
            items = await ProductionPickingItem.filter(picking_id=p.id).all()
            for item in items:
                unit_price = await cost_svc.require_material_unit_cost(tenant_id, int(item.material_id))
                breakdown.append({
                    "material_code": item.material_code,
                    "material_name": item.material_name,
                    "quantity": float(item.picked_quantity),
                    "unit_price": float(unit_price),
                    "total": float(item.picked_quantity * unit_price)
                })
        return breakdown

    async def _get_labor_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        records = await ReportingRecord.filter(tenant_id=tenant_id, work_order_id=work_order.id, status="approved").all()
        breakdown = []
        for r in records:
            hourly_rate = await self._get_standard_value(tenant_id, "work_center", r.work_center_id, "labor_rate")
            breakdown.append({
                "operation_name": r.operation_name,
                "worker_name": r.worker_name,
                "hours": float(r.work_hours),
                "hourly_rate": float(hourly_rate),
                "total": float(r.work_hours * hourly_rate)
            })
        return breakdown

    async def _get_manufacturing_cost_breakdown(self, tenant_id: int, work_order: WorkOrder) -> List[Dict[str, Any]]:
        # 简化版制造费用明细
        return [{"item": "工得分摊制造费用", "amount": float(await self._calculate_manufacturing_cost(tenant_id, work_order))}]

    async def _get_product_material_cost_breakdown(self, tenant_id: int, product: Material, quantity: Decimal) -> List[Dict[str, Any]]:
        from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
        from apps.kuaizhizao.utils.bom_helper import (
            get_bom_items_by_material_id,
            bom_line_required_quantity_decimal,
            bom_item_base_quantity,
        )

        cost_svc = InventoryCostService()
        bom_items = await get_bom_items_by_material_id(
            tenant_id=tenant_id, material_id=product.id, only_approved=True
        )
        breakdown: List[Dict[str, Any]] = []
        for bom_item in bom_items:
            component = await bom_item.component
            if not component:
                continue
            component_qty = bom_line_required_quantity_decimal(
                bom_item.quantity,
                bom_item_base_quantity(bom_item),
                quantity,
                Decimal(str(bom_item.waste_rate or 0)),
            )
            unit_price = await cost_svc.require_material_unit_cost(tenant_id, int(component.id))
            breakdown.append({
                "material_code": component.main_code or component.code,
                "material_name": component.name,
                "quantity": float(component_qty),
                "unit_price": float(unit_price),
                "total": float(component_qty * unit_price),
            })
        if not breakdown:
            unit_price = await cost_svc.require_material_unit_cost(tenant_id, product.id)
            breakdown.append({
                "material_code": product.main_code or product.code,
                "material_name": product.name,
                "quantity": float(quantity),
                "unit_price": float(unit_price),
                "total": float(quantity * unit_price),
            })
        return breakdown

    def _op_display_name(
        self,
        op_data: Dict[str, Any],
        operation_map: Dict[int, Any],
        uuid_to_operation: Dict[str, Any],
    ) -> str:
        name = op_data.get("name")
        if name:
            return str(name)
        op_id = op_data.get("operation_id") or op_data.get("operationId")
        if op_id and int(op_id) in operation_map:
            return operation_map[int(op_id)].name
        op_uuid = op_data.get("uuid") or op_data.get("operation_uuid")
        if op_uuid and str(op_uuid) in uuid_to_operation:
            return uuid_to_operation[str(op_uuid)].name
        code = op_data.get("code")
        if code:
            return str(code)
        return "工序"

    async def _get_product_labor_cost_breakdown(self, tenant_id: int, product: Material, quantity: Decimal) -> List[Dict[str, Any]]:
        from apps.master_data.models.process import ProcessRoute
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.models.work_order import WorkOrder

        breakdown: List[Dict[str, Any]] = []
        if product.process_route_id:
            route = await ProcessRoute.filter(
                tenant_id=tenant_id, id=product.process_route_id, deleted_at__isnull=True
            ).first()
            if route:
                rows = self._flatten_operation_sequence(route.operation_sequence)
                if rows:
                    operation_map, uuid_to_operation = await self._load_operations_for_route_rows(
                        tenant_id, rows
                    )
                    for op_data in rows:
                        std_time = self._operation_std_time_hours(op_data)
                        if std_time <= 0:
                            continue
                        wc_id = self._resolve_operation_work_center_id(
                            op_data, operation_map, uuid_to_operation
                        )
                        if not wc_id:
                            continue
                        hourly_rate = await self._get_standard_value(
                            tenant_id, "work_center", wc_id, "labor_rate"
                        )
                        breakdown.append({
                            "operation_name": self._op_display_name(
                                op_data, operation_map, uuid_to_operation
                            ),
                            "standard_time_hours": float(std_time),
                            "quantity": float(quantity),
                            "work_center_id": wc_id,
                            "hourly_rate": float(hourly_rate),
                            "total": float(std_time * quantity * hourly_rate),
                        })
                    if breakdown:
                        return breakdown

        total_hours = Decimal("0")
        recent_wos = await WorkOrder.filter(
            tenant_id=tenant_id,
            product_id=product.id,
            deleted_at__isnull=True,
        ).order_by("-updated_at").limit(20).values_list("id", flat=True)
        if recent_wos:
            records = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id__in=list(recent_wos),
                status="approved",
                deleted_at__isnull=True,
            ).all()
            total_qty = sum((Decimal(str(r.qualified_quantity or 0)) for r in records), Decimal("0"))
            total_report_hours = sum((Decimal(str(r.work_hours or 0)) for r in records), Decimal("0"))
            if total_qty > 0:
                total_hours = total_report_hours / total_qty

        if total_hours <= 0:
            return breakdown

        work_center_id = await self._resolve_product_work_center_id(tenant_id, product)
        if not work_center_id:
            return breakdown
        hourly_rate = await self._get_standard_value(
            tenant_id, "work_center", work_center_id, "labor_rate"
        )
        breakdown.append({
            "source": "历史报工工时",
            "standard_time_hours": float(total_hours),
            "quantity": float(quantity),
            "work_center_id": work_center_id,
            "hourly_rate": float(hourly_rate),
            "total": float(total_hours * quantity * hourly_rate),
        })
        return breakdown

    async def _get_product_manufacturing_cost_breakdown(
        self, tenant_id: int, product: Material, quantity: Decimal
    ) -> List[Dict[str, Any]]:
        from apps.master_data.models.process import ProcessRoute

        rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        breakdown: List[Dict[str, Any]] = []
        for rule in rules:
            if rule.calculation_method == "按比例":
                material_cost = await self._calculate_product_material_cost(tenant_id, product, quantity)
                rate = self._rule_overhead_ratio(rule)
                breakdown.append({
                    "rule_name": rule.name,
                    "calculation_method": "按比例",
                    "ratio": float(rate),
                    "base_material_cost": float(material_cost),
                    "total": float(material_cost * rate),
                })
            elif rule.calculation_method == "按工时":
                total_hours = await self._sum_product_std_time_hours(tenant_id, product)
                rows: List[Dict[str, Any]] = []
                if product.process_route_id:
                    route = await ProcessRoute.filter(
                        tenant_id=tenant_id, id=product.process_route_id, deleted_at__isnull=True
                    ).first()
                    if route:
                        rows = self._flatten_operation_sequence(route.operation_sequence)
                if rows:
                    operation_map, uuid_to_operation = await self._load_operations_for_route_rows(
                        tenant_id, rows
                    )
                    for op_data in rows:
                        std_time = self._operation_std_time_hours(op_data)
                        if std_time <= 0:
                            continue
                        wc_id = self._resolve_operation_work_center_id(
                            op_data, operation_map, uuid_to_operation
                        )
                        if not wc_id:
                            continue
                        rate = await self._get_standard_value(
                            tenant_id, "work_center", wc_id, "overhead_rate"
                        )
                        breakdown.append({
                            "rule_name": rule.name,
                            "calculation_method": "按工时",
                            "operation_name": self._op_display_name(
                                op_data, operation_map, uuid_to_operation
                            ),
                            "standard_time_hours": float(std_time),
                            "quantity": float(quantity),
                            "work_center_id": wc_id,
                            "overhead_rate": float(rate),
                            "total": float(std_time * quantity * rate),
                        })
                    continue
                if total_hours <= 0:
                    continue
                work_center_id = await self._resolve_product_work_center_id(tenant_id, product)
                if not work_center_id:
                    continue
                rate = await self._get_standard_value(
                    tenant_id, "work_center", work_center_id, "overhead_rate"
                )
                breakdown.append({
                    "rule_name": rule.name,
                    "calculation_method": "按工时",
                    "standard_time_hours": float(total_hours),
                    "quantity": float(quantity),
                    "work_center_id": work_center_id,
                    "overhead_rate": float(rate),
                    "total": float(total_hours * quantity * rate),
                })
        return breakdown

    async def get_cost_calculation_by_id(self, tenant_id: int, cost_calculation_id: int) -> CostCalculationResponse:
        cost_calculation = await self.get_by_id(tenant_id, cost_calculation_id, raise_if_not_found=True)
        return CostCalculationResponse.model_validate(cost_calculation)

    async def list_cost_calculations(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        calculation_type: Optional[str] = None,
        work_order_id: Optional[int] = None,
        product_id: Optional[int] = None,
        calculation_status: Optional[str] = None,
        keyword: Optional[str] = None,
        calculation_no: Optional[str] = None,
        work_order_code: Optional[str] = None,
        product_code: Optional[str] = None,
        product_name: Optional[str] = None,
        calculation_date_start: Optional[str] = None,
        calculation_date_end: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> tuple[List[CostCalculationResponse], int]:
        from apps.kuaicaiwu.services.cost_list_core import apply_cost_calculation_list_filters

        query = CostCalculation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query, order_expr = apply_cost_calculation_list_filters(
            query,
            keyword=keyword,
            calculation_no=calculation_no,
            work_order_code=work_order_code,
            product_code=product_code,
            product_name=product_name,
            calculation_type=calculation_type,
            calculation_status=calculation_status,
            work_order_id=work_order_id,
            product_id=product_id,
            calculation_date_start=calculation_date_start,
            calculation_date_end=calculation_date_end,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_field,
            sort_order=sort_order,
        )
        total = await query.count()
        calculations = await query.offset(skip).limit(limit).order_by(order_expr, "-id")
        items = [CostCalculationResponse.model_validate(calc) for calc in calculations]
        return items, total

    async def compare_costs(self, tenant_id: int, product_id: int) -> CostComparisonResponse:
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")
        settled_statuses = ("已核算", "已审核")
        standard_calculation = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_type="标准成本",
            calculation_status__in=settled_statuses,
            deleted_at__isnull=True
        ).order_by("-created_at").first()
        actual_calculation = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_type="实际成本",
            calculation_status__in=settled_statuses,
            deleted_at__isnull=True
        ).order_by("-created_at").first()
        if not standard_calculation:
            raise NotFoundError(f"产品 {product_id} 的标准成本不存在")
        if not actual_calculation:
            raise NotFoundError(f"产品 {product_id} 的实际成本不存在")
        standard_cost = standard_calculation.unit_cost
        actual_cost = actual_calculation.unit_cost
        cost_difference = actual_cost - standard_cost
        cost_difference_rate = (cost_difference / standard_cost * 100) if standard_cost > 0 else Decimal(0)
        material_cost_difference = actual_calculation.material_cost - standard_calculation.material_cost
        labor_cost_difference = actual_calculation.labor_cost - standard_calculation.labor_cost
        manufacturing_cost_difference = actual_calculation.manufacturing_cost - standard_calculation.manufacturing_cost
        difference_analysis = self._analyze_cost_difference(
            material_cost_difference, labor_cost_difference, manufacturing_cost_difference
        )
        return CostComparisonResponse(
            product_id=product.id,
            product_code=product.code,
            product_name=product.name,
            standard_cost=standard_cost,
            actual_cost=actual_cost,
            cost_difference=cost_difference,
            cost_difference_rate=cost_difference_rate,
            material_cost_difference=material_cost_difference,
            labor_cost_difference=labor_cost_difference,
            manufacturing_cost_difference=manufacturing_cost_difference,
            difference_analysis=difference_analysis,
        )

    async def analyze_cost(self, tenant_id: int, product_id: int) -> CostAnalysisResponse:
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")
        settled_statuses = ("已核算", "已审核")
        cost_calculation = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_status__in=settled_statuses,
            deleted_at__isnull=True
        ).order_by("-created_at").first()
        if not cost_calculation:
            raise NotFoundError(f"产品 {product_id} 的成本核算记录不存在")
        cost_composition = {
            "材料成本": cost_calculation.material_cost,
            "人工成本": cost_calculation.labor_cost,
            "制造费用": cost_calculation.manufacturing_cost,
        }
        cost_trend = []
        calculations = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            calculation_status__in=settled_statuses,
            deleted_at__isnull=True
        ).order_by("-calculation_date").limit(6).all()
        for calc in reversed(calculations):
            cost_trend.append({
                "date": to_api_isoformat(calc.calculation_date),
                "material_cost": float(calc.material_cost),
                "labor_cost": float(calc.labor_cost),
                "manufacturing_cost": float(calc.manufacturing_cost),
                "total_cost": float(calc.total_cost),
                "unit_cost": float(calc.unit_cost),
            })
        cost_breakdown = cost_calculation.cost_details or {}
        return CostAnalysisResponse(
            product_id=product.id,
            product_code=product.code,
            product_name=product.name,
            cost_composition=cost_composition,
            cost_trend=cost_trend,
            cost_breakdown=cost_breakdown,
        )

    async def get_cost_optimization(self, tenant_id: int, product_id: int) -> CostOptimizationResponse:
        product = await Material.filter(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True).first()
        if not product:
            raise NotFoundError(f"产品 {product_id} 不存在")
        cost_comparison = await self.compare_costs(tenant_id, product_id)
        suggestions = []
        potential_savings = Decimal(0)
        priority = "低"
        if abs(cost_comparison.material_cost_difference) > Decimal(100):
            suggestions.append({
                "type": "材料成本优化",
                "description": f"材料成本差异 {cost_comparison.material_cost_difference}，建议优化材料采购或使用替代材料",
                "priority": "高" if abs(cost_comparison.material_cost_difference) > Decimal(500) else "中",
            })
            potential_savings += abs(cost_comparison.material_cost_difference)
            if abs(cost_comparison.material_cost_difference) > Decimal(500):
                priority = "高"
        if abs(cost_comparison.labor_cost_difference) > Decimal(50):
            suggestions.append({
                "type": "人工成本优化",
                "description": f"人工成本差异 {cost_comparison.labor_cost_difference}，建议优化工艺流程或提高生产效率",
                "priority": "高" if abs(cost_comparison.labor_cost_difference) > Decimal(200) else "中",
            })
            potential_savings += abs(cost_comparison.labor_cost_difference)
            if abs(cost_comparison.labor_cost_difference) > Decimal(200) and priority != "高":
                priority = "中"
        if abs(cost_comparison.manufacturing_cost_difference) > Decimal(30):
            suggestions.append({
                "type": "制造费用优化",
                "description": f"制造费用差异 {cost_comparison.manufacturing_cost_difference}，建议优化设备利用率或降低制造费用",
                "priority": "中",
            })
            potential_savings += abs(cost_comparison.manufacturing_cost_difference)
            if priority == "低":
                priority = "中"
        return CostOptimizationResponse(
            product_id=product.id,
            product_code=product.code,
            product_name=product.name,
            suggestions=suggestions,
            potential_savings=potential_savings,
            priority=priority,
        )

    def _analyze_cost_difference(
        self,
        material_cost_difference: Decimal,
        labor_cost_difference: Decimal,
        manufacturing_cost_difference: Decimal
    ) -> str:
        analysis_parts = []
        if material_cost_difference > 0:
            analysis_parts.append(f"材料成本超支 {material_cost_difference}，可能原因：材料价格上涨、材料用量增加、材料浪费等")
        elif material_cost_difference < 0:
            analysis_parts.append(f"材料成本节约 {abs(material_cost_difference)}，可能原因：材料价格下降、材料用量减少、材料利用率提高等")
        if labor_cost_difference > 0:
            analysis_parts.append(f"人工成本超支 {labor_cost_difference}，可能原因：工时增加、工时单价上涨、生产效率下降等")
        elif labor_cost_difference < 0:
            analysis_parts.append(f"人工成本节约 {abs(labor_cost_difference)}，可能原因：工时减少、工时单价下降、生产效率提高等")
        if manufacturing_cost_difference > 0:
            analysis_parts.append(f"制造费用超支 {manufacturing_cost_difference}，可能原因：设备利用率下降、制造费用率上涨等")
        elif manufacturing_cost_difference < 0:
            analysis_parts.append(f"制造费用节约 {abs(manufacturing_cost_difference)}，可能原因：设备利用率提高、制造费用率下降等")
        return "；".join(analysis_parts) if analysis_parts else "成本差异在合理范围内"

    async def get_period_summary(self, tenant_id: int, year: int, month: int) -> Dict[str, Any]:
        """获取指定期间的生产数据摘要（用于结算前核对）"""
        from datetime import datetime
        from decimal import Decimal
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.production_picking import ProductionPicking
        from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
        from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService

        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)

        records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            reported_at__gte=start_date,
            reported_at__lt=end_date,
            status="approved"
        ).all()

        work_order_ids = list(set(r.work_order_id for r in records))
        wo_map = {wo.id: wo for wo in await WorkOrder.filter(id__in=work_order_ids).all()}

        product_summary = {}
        for r in records:
            wo = wo_map.get(r.work_order_id)
            if not wo:
                continue
            pid = wo.product_id
            if pid not in product_summary:
                product_summary[pid] = {
                    "product_name": wo.product_name,
                    "quantity": Decimal("0.00"),
                    "hours": Decimal("0.00"),
                    "material_cost": Decimal("0.00"),
                }
            product_summary[pid]["quantity"] += Decimal(str(r.qualified_quantity))
            product_summary[pid]["hours"] += Decimal(str(r.work_hours))

        cost_svc = InventoryCostService()
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            picking_time__gte=start_date,
            picking_time__lt=end_date,
            status="已完成",
        ).all()
        for p in pickings:
            wo = wo_map.get(p.work_order_id) or await WorkOrder.filter(id=p.work_order_id).first()
            if not wo:
                continue
            pid = wo.product_id
            if pid not in product_summary:
                product_summary[pid] = {
                    "product_name": wo.product_name,
                    "quantity": Decimal("0.00"),
                    "hours": Decimal("0.00"),
                    "material_cost": Decimal("0.00"),
                }
            items = await ProductionPickingItem.filter(picking_id=p.id).all()
            for item in items:
                unit_price = await cost_svc.require_material_unit_cost(tenant_id, int(item.material_id))
                product_summary[pid]["material_cost"] += Decimal(str(item.picked_quantity)) * unit_price

        return {
            "period": f"{year}-{month}",
            "items": [
                {
                    "product_id": pid,
                    "product_name": data["product_name"],
                    "quantity": float(data["quantity"]),
                    "hours": float(data["hours"]),
                    "material_cost": float(data["material_cost"]),
                }
                for pid, data in product_summary.items()
            ],
            "total_hours": float(sum(d["hours"] for d in product_summary.values())),
        }

    async def perform_monthly_settlement(
        self,
        tenant_id: int,
        year: int,
        month: int,
        indirect_costs: Dict[str, float],
        created_by: int
    ) -> List[CostCalculation]:
        """
        执行月度成本结转逻辑（落地实现）
        """
        logger.info(f"Starting monthly settlement for {tenant_id}, period {year}-{month}")

        # 1. 计算时间范围
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)

        # 2. 获取报工记录并按产品汇总产量/工时
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            reported_at__gte=start_date,
            reported_at__lt=end_date,
            status="approved"
        ).all()

        if not reporting_records:
            logger.warning(f"No approved reporting records found for period {year}-{month}")
            return []

        # 获取工单映射
        work_order_ids = list(set(r.work_order_id for r in reporting_records))
        work_orders = await WorkOrder.filter(id__in=work_order_ids).all()
        wo_map = {wo.id: wo for wo in work_orders}

        product_summary = {}
        total_period_hours = Decimal("0.00")

        for r in reporting_records:
            wo = wo_map.get(r.work_order_id)
            if not wo: continue
            
            pid = wo.product_id
            if pid not in product_summary:
                product_summary[pid] = {
                    "product_name": wo.product_name,
                    "product_code": wo.product_code,
                    "quantity": Decimal("0.00"),
                    "hours": Decimal("0.00"),
                    "material_cost": Decimal("0.00")
                }
            
            product_summary[pid]["quantity"] += Decimal(str(r.qualified_quantity))
            product_summary[pid]["hours"] += Decimal(str(r.work_hours))
            total_period_hours += Decimal(str(r.work_hours))

        # 3. 计算材料成本 (从对应期间的完工工单领料单汇总)
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            picking_time__gte=start_date,
            picking_time__lt=end_date,
            status="已完成"
        ).all()
        
        for p in pickings:
             wo = wo_map.get(p.work_order_id) or await WorkOrder.filter(id=p.work_order_id).first()
             if not wo: continue
             
             pid = wo.product_id
             # 即使该产品本月没报工，只要本月有领料完成且有关联，也计入（取决于结转逻辑，这里包含在 product_summary 中）
             if pid not in product_summary:
                 product_summary[pid] = {
                    "product_name": wo.product_name,
                    "product_code": wo.product_code,
                    "quantity": Decimal("0.00"),
                    "hours": Decimal("0.00"),
                    "material_cost": Decimal("0.00")
                }
                 
             items = await ProductionPickingItem.filter(picking_id=p.id).all()
             for item in items:
                 from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
                 unit_price = await InventoryCostService().require_material_unit_cost(
                     tenant_id, int(item.material_id)
                 )
                 product_summary[pid]["material_cost"] += Decimal(str(item.picked_quantity)) * unit_price

        # 4. 执行费用分摊（按制造费用规则 allocation_basis：工时或产量）
        overhead_rules = await CostRule.filter(
            tenant_id=tenant_id,
            rule_type="制造费用",
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        allocation_basis = "工时"
        for rule in overhead_rules:
            if rule.allocation_basis == "产量":
                allocation_basis = "产量"
                break

        total_indirect = Decimal(str(sum(indirect_costs.values())))
        payroll = Decimal(str(indirect_costs.get("payroll", 0)))
        overhead_base = total_indirect - payroll

        total_period_quantity = sum(
            (data["quantity"] for data in product_summary.values()), Decimal("0.00")
        )
        
        user_info = await self.get_user_info(created_by)
        results = []
        today = datetime.now().strftime("%Y%m%d")

        for pid, data in product_summary.items():
            if allocation_basis == "产量" and total_period_quantity > 0:
                ratio = data["quantity"] / total_period_quantity
            elif total_period_hours > 0:
                ratio = data["hours"] / total_period_hours
            else:
                ratio = Decimal(0)
            
            allocated_labor = payroll * ratio
            allocated_overhead = overhead_base * ratio
            
            total_cost = data["material_cost"] + allocated_labor + allocated_overhead
            unit_cost = total_cost / data["quantity"] if data["quantity"] > 0 else Decimal(0)
            
            calculation_no = await self.generate_code(
                tenant_id=tenant_id,
                code_type="COST_CALCULATION_CODE",
                prefix=f"MS{today}"
            )

            calculation = await CostCalculation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                calculation_no=calculation_no,
                calculation_type="月度结转",
                product_id=pid,
                product_code=data["product_code"],
                product_name=data["product_name"],
                quantity=data["quantity"],
                material_cost=data["material_cost"],
                labor_cost=allocated_labor,
                manufacturing_cost=allocated_overhead,
                total_cost=total_cost,
                unit_cost=unit_cost,
                calculation_date=date(year, month, 1), # 期间起始日
                calculation_status="已核算",
                created_by=created_by,
                updated_by=created_by,
                created_by_name=user_info["name"],
                updated_by_name=user_info["name"],
                remark=f"{year}年{month}月自动化月度结转（{allocation_basis}分摊）"
            )
            results.append(calculation)
            
        logger.info(f"Monthly settlement completed for {tenant_id}, generated {len(results)} records")
        return results
