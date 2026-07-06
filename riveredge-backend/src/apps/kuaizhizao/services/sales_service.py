"""
销售管理服务模块

提供销售管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import zoneinfo
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from tortoise.functions import Sum
from loguru import logger

from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_item import DemandItem

from apps.kuaizhizao.schemas.sales import (
    # 销售预测
    SalesForecastCreate, SalesForecastUpdate, SalesForecastResponse, SalesForecastListResponse,
    SalesForecastItemCreate, SalesForecastItemUpdate, SalesForecastItemResponse,
    # 销售订单
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderListResponse,
    SalesOrderItemCreate, SalesOrderItemUpdate, SalesOrderItemResponse,
)

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants import ReviewStatus
from apps.kuaizhizao.services.document_action_policy.sales_forecast import assert_sales_forecast_capability
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_sales_forecast_capabilities_on_response,
    enrich_sales_forecast_list_capabilities,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.user_service import UserService


class SalesForecastService(AppBaseService[SalesForecast]):
    """销售预测服务"""

    def __init__(self):
        super().__init__(SalesForecast)

    def _is_forecast_pushed_to_computation(self, forecast: Any, demand: Optional[Demand] = None) -> bool:
        if bool(getattr(forecast, "planning_pushed_to_computation", False)):
            return True
        if demand and bool(getattr(demand, "pushed_to_computation", False)):
            return True
        return False

    async def _forecast_has_downstream(self, tenant_id: int, forecast_id: int) -> bool:
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        return await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="sales_forecast",
            source_id=forecast_id,
            target_type__in=["demand", "demand_computation"],
        ).exists()

    async def _forecast_downstream_ids(self, tenant_id: int, forecast_ids: List[int]) -> set[int]:
        if not forecast_ids:
            return set()
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        rows = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="sales_forecast",
            source_id__in=forecast_ids,
            target_type__in=["demand", "demand_computation"],
        ).values_list("source_id", flat=True)
        return {int(x) for x in rows}

    async def _forecast_has_items_map(self, tenant_id: int, forecast_ids: List[int]) -> Dict[int, bool]:
        if not forecast_ids:
            return {}
        from tortoise.functions import Count

        rows = await SalesForecastItem.filter(
            tenant_id=tenant_id,
            forecast_id__in=forecast_ids,
        ).annotate(cnt=Count("id")).group_by("forecast_id").values("forecast_id", "cnt")
        return {int(r["forecast_id"]): int(r["cnt"] or 0) > 0 for r in rows}

    async def delete_sales_forecast(self, tenant_id: int, forecast_id: int) -> None:
        forecast = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=forecast_id, deleted_at__isnull=True
        )
        if not forecast:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        assert_sales_forecast_capability(forecast, "delete")
        deleted = await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).delete()
        if not deleted:
            raise BusinessLogicError("销售预测删除失败")

    async def create_sales_forecast(self, tenant_id: int, forecast_data: SalesForecastCreate, created_by: int) -> SalesForecastResponse:
        """创建销售预测"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            code = getattr(forecast_data, "forecast_code", None) or ""
            code = (code.strip() if isinstance(code, str) else "") or None
            if not code or code == "AUTO":
                today = datetime.now().strftime("%Y%m%d")
                try:
                    code = await self.generate_code(tenant_id, "SALES_FORECAST_CODE", prefix=f"SF{today}")
                except Exception as e:
                    if isinstance(e, ValidationError) and ("不存在" in str(e) or "未启用" in str(e)):
                        from core.services.default.default_values_service import DefaultValuesService
                        created = await DefaultValuesService.ensure_code_rule_for_page(
                            tenant_id, "kuaizhizao-sales-forecast"
                        )
                        if created:
                            try:
                                code = await self.generate_code(tenant_id, "SALES_FORECAST_CODE", prefix=f"SF{today}")
                            except Exception as e2:
                                logger.warning("销售预测编码规则补建后生成仍失败: %s", e2)
                        else:
                            logger.warning("销售预测编码规则生成失败: %s", e)
                    else:
                        logger.warning("销售预测编码规则生成失败: %s", e)
                if not code:
                    import uuid
                    code = f"SF{today}{uuid.uuid4().hex[:6].upper()}"

            # 准备创建数据，排除 forecast_code 后统一写入
            create_data = forecast_data.model_dump(exclude_unset=True, exclude={'created_by', 'forecast_code'})
            create_data['forecast_code'] = code
            create_data['created_by'] = created_by
            create_data['created_by_name'] = user_info["name"]
            
            forecast = await SalesForecast.create(
                tenant_id=tenant_id,
                **create_data
            )
            
            # 创建预测明细（如果提供了items）
            items_data = forecast_data.model_dump().get('items', [])
            if items_data:
                for item_data in items_data:
                    await SalesForecastItem.create(
                        tenant_id=tenant_id,
                        forecast_id=forecast.id,
                        **item_data
                    )

            # 与提交流程一致：蓝图配置无需审核时，创建后自动审核通过。
            # 不再自动联动需求池（Demand），避免形成「预测→需求计划」隐式链路。
            from infra.services.business_config_service import BusinessConfigService
            from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
            config_service = BusinessConfigService()
            audit_required = await config_service.check_audit_required(tenant_id, "sales_forecast")
            if not audit_required and str(getattr(forecast, "status", "") or "").strip() in ("草稿", "DRAFT"):
                await SalesForecast.filter(tenant_id=tenant_id, id=forecast.id).update(
                    status=DocumentStatus.AUDITED.value,
                    review_status=ReviewStatus.APPROVED.value,
                    updated_by=created_by
                )
                await self._try_auto_push_forecast_to_computation(
                    tenant_id=tenant_id,
                    forecast_id=forecast.id,
                    operator_id=created_by,
                )
                forecast = await SalesForecast.get(tenant_id=tenant_id, id=forecast.id)

            demand = await self._get_linked_demand_for_forecast(tenant_id, forecast.id)
            resp = SalesForecastResponse.model_validate(forecast)
            resp = enrich_sales_forecast_capabilities_on_response(
                forecast,
                resp,
                pushed_to_computation=self._is_forecast_pushed_to_computation(forecast, demand),
                has_downstream=await self._forecast_has_downstream(tenant_id, forecast.id),
                has_items=bool(items_data),
            )
            return resp

    async def get_sales_forecast_by_id(self, tenant_id: int, forecast_id: int) -> SalesForecastResponse:
        """根据ID获取销售预测（含明细，与列表 include_items 行为一致）"""
        forecast = await SalesForecast.get_or_none(
            tenant_id=tenant_id,
            id=forecast_id,
            deleted_at__isnull=True,
        )
        if not forecast:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        resp = SalesForecastResponse.model_validate(forecast)
        item_rows = await SalesForecastItem.filter(tenant_id=tenant_id, forecast_id=forecast_id).order_by("forecast_date").all()
        resp.items = [SalesForecastItemResponse.model_validate(it) for it in item_rows]
        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_forecast_lifecycle, get_document_milestones
        milestones = await get_document_milestones(forecast.tenant_id, "sales_forecast", forecast.id)
        demand = await self._get_linked_demand_for_forecast(tenant_id, forecast_id)
        pushed = bool(demand and getattr(demand, "pushed_to_computation", False))
        resp.lifecycle = get_sales_forecast_lifecycle(
            forecast,
            milestones=milestones,
            pushed_to_computation=pushed,
            delivery_progress=0.0,
            invoice_progress=0.0,
            items=None,
        )
        from core.services.approval.audit_record_enricher import enrich_record

        pushed = self._is_forecast_pushed_to_computation(forecast, demand)
        has_downstream = await self._forecast_has_downstream(tenant_id, forecast_id)
        has_items = bool(item_rows)
        resp = enrich_sales_forecast_capabilities_on_response(
            forecast,
            resp,
            pushed_to_computation=pushed,
            has_downstream=has_downstream,
            has_items=has_items,
        )
        return await enrich_record(tenant_id, "sales_forecast", resp)

    async def list_sales_forecasts(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> Dict[str, Any]:
        """获取销售预测列表"""
        query = SalesForecast.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('forecast_period'):
            query = query.filter(forecast_period=filters['forecast_period'])
        if filters.get('start_date'):
            query = query.filter(start_date__gte=filters['start_date'])
        if filters.get('end_date'):
            query = query.filter(end_date__lte=filters['end_date'])
        if filters.get('keyword'):
            query = query.filter(Q(forecast_code__icontains=filters['keyword']) | Q(forecast_name__icontains=filters['keyword']))

        # 获取总数
        total = await query.count()
        
        # 获取分页数据
        forecasts = await query.offset(skip).limit(limit).order_by('-created_at')

        forecast_ids = [f.id for f in forecasts]
        demand_by_fid: Dict[int, Demand] = {}
        if forecast_ids:
            demands = await Demand.filter(
                tenant_id=tenant_id,
                source_type="sales_forecast",
                source_id__in=forecast_ids,
                deleted_at__isnull=True,
            ).all()
            demand_by_fid = {d.source_id: d for d in demands}

        include_items = filters.get('include_items', False)
        items_by_forecast: Dict[int, List[SalesForecastItem]] = {}
        if include_items:
            # 批量获取明细
            forecast_ids = [f.id for f in forecasts]
            if forecast_ids:
                all_items = await SalesForecastItem.filter(tenant_id=tenant_id, forecast_id__in=forecast_ids).order_by('forecast_date').all()
                for item in all_items:
                    items_by_forecast.setdefault(item.forecast_id, []).append(item)

        from apps.kuaizhizao.services.document_lifecycle_service import get_sales_forecast_lifecycle
        downstream_ids = await self._forecast_downstream_ids(tenant_id, forecast_ids)
        has_items_by_id = await self._forecast_has_items_map(tenant_id, forecast_ids)
        pushed_by_id: Dict[int, bool] = {}
        for fid, f in zip(forecast_ids, forecasts):
            d = demand_by_fid.get(fid)
            pushed_by_id[fid] = self._is_forecast_pushed_to_computation(f, d)

        list_responses: List[SalesForecastListResponse] = []
        for forecast in forecasts:
            resp = SalesForecastListResponse.model_validate(forecast)
            fid = forecast.id
            d = demand_by_fid.get(fid)
            resp.lifecycle = get_sales_forecast_lifecycle(
                forecast,
                pushed_to_computation=pushed_by_id.get(fid, False),
            )
            if include_items:
                f_items = items_by_forecast.get(fid, [])
                resp.items = [SalesForecastItemResponse.model_validate(it) for it in f_items]
            list_responses.append(resp)

        enriched = enrich_sales_forecast_list_capabilities(
            forecasts,
            list_responses,
            pushed_by_id=pushed_by_id,
            downstream_by_id={fid: fid in downstream_ids for fid in forecast_ids},
            has_items_by_id=has_items_by_id,
        )
        result = [r.model_dump() for r in enriched]
        from core.services.approval.audit_record_enricher import enrich_data_payload

        return await enrich_data_payload(tenant_id, "sales_forecast", {
            "data": result, "total": total, "success": True
        })
        
    async def get_forecast_statistics(self, tenant_id: int) -> Dict[str, Any]:
        """获取销售预测统计（列表页指标卡，字段与销售订单 statistics 对齐）"""
        tz = zoneinfo.ZoneInfo("Asia/Shanghai")
        today = datetime.now(tz).date()
        base = SalesForecast.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        cancelled = ["CANCELLED", "已取消", "cancelled"]
        rejected_review = ["REJECTED", "已驳回", "审核驳回", "驳回", "rejected"]
        pending_review_vals = ["PENDING", "PENDING_REVIEW", "待审核", "pending_review"]
        in_progress_status = [
            "IN_PROGRESS", "进行中", "APPROVED", "已审核", "CONFIRMED", "已确认",
            "AUDITED", "RELEASED", "执行中", "EFFECTIVE", "已生效",
        ]
        completed = ["COMPLETED", "已完成", "completed", "CLOSED", "已关闭"]

        try:
            pending_review_count = await base.filter(
                review_status__in=pending_review_vals,
            ).exclude(status__in=cancelled).count()
        except Exception as e:
            logger.warning(f"sales-forecast-statistics pending_review_count: {e}")
            pending_review_count = 0

        try:
            today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=tz)
            today_end = today_start + timedelta(days=1)
            today_new_count = await base.filter(
                created_at__gte=today_start,
                created_at__lt=today_end,
            ).count()
        except Exception as e:
            logger.warning(f"sales-forecast-statistics today_new_count: {e}")
            today_new_count = 0

        try:
            in_progress_count = await base.filter(
                status__in=in_progress_status,
            ).exclude(review_status__in=rejected_review).exclude(status__in=cancelled + completed).count()
        except Exception as e:
            logger.warning(f"sales-forecast-statistics in_progress_count: {e}")
            in_progress_count = 0

        try:
            overdue_count = await base.filter(
                end_date__lt=today,
            ).exclude(status__in=cancelled + completed).count()
        except Exception as e:
            logger.warning(f"sales-forecast-statistics overdue_count: {e}")
            overdue_count = 0

        total_amount = 0.0
        trend_today_new: List[Dict[str, Any]] = []
        trend_today_amount: List[Dict[str, Any]] = []
        trend_pending_review: List[Dict[str, Any]] = []

        try:
            for i in range(6, -1, -1):
                day = today - timedelta(days=i)
                date_str = day.strftime("%Y-%m-%d")
                day_start = datetime.combine(day, datetime.min.time()).replace(tzinfo=tz)
                day_end = day_start + timedelta(days=1)
                cnt = await base.filter(created_at__gte=day_start, created_at__lt=day_end).count()
                trend_today_new.append({"date": date_str, "value": cnt})
                trend_today_amount.append({"date": date_str, "value": 0})
                try:
                    pr_cnt = await base.filter(
                        review_status__in=pending_review_vals,
                        created_at__lte=day_end,
                    ).exclude(status__in=cancelled).count()
                except Exception:
                    pr_cnt = pending_review_count if day == today else 0
                trend_pending_review.append({"date": date_str, "value": pr_cnt})
        except Exception as e:
            logger.warning(f"sales-forecast-statistics trends: {e}")
            fallback_dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
            trend_today_new = [{"date": d, "value": 0} for d in fallback_dates]
            trend_today_amount = [{"date": d, "value": 0} for d in fallback_dates]
            trend_pending_review = [{"date": d, "value": 0} for d in fallback_dates]

        yesterday_today_new = trend_today_new[-2]["value"] if len(trend_today_new) > 1 else 0
        yesterday_pending_review = (
            trend_pending_review[-2]["value"] if len(trend_pending_review) > 1 else 0
        )

        return {
            "today_new_count": today_new_count,
            "pending_review_count": pending_review_count,
            "in_progress_count": in_progress_count,
            "overdue_count": overdue_count,
            "total_amount": round(total_amount, 2),
            "yesterday_today_new": yesterday_today_new,
            "yesterday_pending_review": yesterday_pending_review,
            "trend_today_new": trend_today_new,
            "trend_today_amount": trend_today_amount,
            "trend_pending_review": trend_pending_review,
        }

    async def update_sales_forecast(
        self,
        tenant_id: int,
        forecast_id: int,
        forecast_data: SalesForecastUpdate,
        updated_by: int,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> SalesForecastResponse:
        """更新销售预测；若提供 items 则先删后增，覆盖全部明细。已审核预测更新后同步关联需求。"""
        from apps.kuaizhizao.constants import DocumentStatus, is_draft_status, normalize_status

        forecast_row = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=forecast_id, deleted_at__isnull=True
        )
        if not forecast_row:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        assert_sales_forecast_capability(forecast_row, "update")
        is_pending = normalize_status(forecast_row.status or "") == DocumentStatus.PENDING_REVIEW.value
        if is_pending and not approval_edit_context:
            from core.services.approval.approval_edit_guard import ApprovalEditGuard

            edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                tenant_id, "sales_forecast", forecast_id, updated_by
            )
            if not edit_ctx:
                raise BusinessLogicError("单据审核中，仅已开启改单权限的当前审批人可修改")
            approval_edit_context = edit_ctx

        if approval_edit_context:
            from core.config.audit_editable_fields import is_field_editable
            from infra.exceptions.exceptions import ValidationError

            node_editable = approval_edit_context.get("editable_fields")
            preview = forecast_data.model_dump(exclude_unset=True, exclude={"items"})
            for field in preview:
                if field in ("updated_by", "status", "review_status"):
                    continue
                if not is_field_editable("sales_forecast", field, node_editable):
                    raise ValidationError(f"字段「{field}」不允许在审核中修改")
            if forecast_data.items is not None and not is_field_editable(
                "sales_forecast", "items", node_editable
            ):
                raise ValidationError("字段「预测明细」不允许在审核中修改")

        forecast_before = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
        async with in_transaction():
            dumped = forecast_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            items_data = dumped.pop('items', None)
            update_data = {k: v for k, v in dumped.items() if k != 'items'}
            update_data['updated_by'] = updated_by

            await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(**update_data)

            if items_data is not None:
                await SalesForecastItem.filter(tenant_id=tenant_id, forecast_id=forecast_id).delete()
                for item_data in items_data:
                    await SalesForecastItem.create(
                        tenant_id=tenant_id,
                        forecast_id=forecast_id,
                        **item_data
                    )

            updated_forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
        # 只要有关联需求，预测任意保存都同步需求内容，使需求管理动态随上游变化
        demand_synced = await self._sync_demand_if_exists(tenant_id, forecast_id, updated_by)
        try:
            from apps.kuaizhizao.services.demand_change_event_service import DemandChangeEventService
            await DemandChangeEventService().create_event(
                tenant_id=tenant_id,
                event_type="order",
                source_type="sales_forecast",
                source_id=forecast_id,
                source_code=updated_forecast.forecast_code,
                source_name=updated_forecast.forecast_name or updated_forecast.forecast_code,
                changed_fields=["sales_forecast_updated"],
                payload={"forecast_id": forecast_id},
                effective_at=datetime.now(),
                trigger_reason="sales_forecast_updated",
                requested_by=updated_by,
                correlation_id=f"sales_forecast:{forecast_id}:{int(datetime.now().timestamp())}",
                auto_create_task=True,
            )
        except Exception:
            pass
        out = updated_forecast.model_dump()
        out["demand_synced"] = demand_synced
        return SalesForecastResponse(**out)

    async def _get_linked_demand_for_forecast(
        self, tenant_id: int, forecast_id: int
    ) -> Optional[Demand]:
        """获取与销售预测关联的 Demand"""
        return await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type="sales_forecast",
            source_id=forecast_id,
            deleted_at__isnull=True,
        )

    async def _sync_demand_if_exists(self, tenant_id: int, forecast_id: int, operator_id: int) -> bool:
        """
        历史兼容占位：销售预测不再自动同步到需求池（Demand）。
        仅保留显式「下推需求计算」路径创建/更新计算数据。
        """
        return False

    async def _create_demand_from_sales_forecast(
        self, tenant_id: int, forecast_id: int, created_by: int
    ) -> Demand:
        """从 SalesForecast 生成 Demand（source_type=sales_forecast, source_id=预测ID）"""
        from apps.kuaizhizao.constants import DemandStatus, ReviewStatus

        forecast = await SalesForecast.get(id=forecast_id)
        items = await SalesForecastItem.filter(
            tenant_id=tenant_id, forecast_id=forecast_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售预测无明细，无法自动产生需求")

        from decimal import Decimal
        total_qty = sum(Decimal(str(it.forecast_quantity)) for it in items)
        demand_items = []
        for it in items:
            demand_items.append({
                "material_id": it.material_id,
                "material_code": it.material_code,
                "material_name": it.material_name,
                "material_spec": it.material_spec,
                "material_unit": it.material_unit,
                "required_quantity": it.forecast_quantity,
                "forecast_date": it.forecast_date,
                "remaining_quantity": it.forecast_quantity,
                "delivery_status": "待交货",
            })

        demand = await Demand.create(
            tenant_id=tenant_id,
            demand_code=forecast.forecast_code,
            demand_type="sales_forecast",
            business_mode="MTS",
            demand_name=forecast.forecast_name or forecast.forecast_code,
            start_date=forecast.start_date,
            end_date=forecast.end_date,
            forecast_period=forecast.forecast_period,
            total_quantity=Decimal(str(total_qty)),
            total_amount=Decimal("0"),
            status=DemandStatus.AUDITED,
            review_status=ReviewStatus.APPROVED,
            reviewer_id=forecast.reviewer_id,
            reviewer_name=forecast.reviewer_name,
            review_time=forecast.review_time,
            priority=5,
            source_type="sales_forecast",
            source_id=forecast_id,
            source_code=forecast.forecast_code,
            created_by=created_by,
            updated_by=created_by,
        )
        for d in demand_items:
            await DemandItem.create(
                tenant_id=tenant_id,
                demand_id=demand.id,
                delivered_quantity=Decimal("0"),
                **d,
            )
        logger.info("从销售预测 %s 自动产生需求 %s", forecast.forecast_code, demand.demand_code)

        # 建立销售预测→Demand 的 DocumentRelation（支持单据追溯）
        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sales_forecast",
                    source_id=forecast_id,
                    source_code=forecast.forecast_code,
                    source_name=forecast.forecast_name or forecast.forecast_code,
                    target_type="demand",
                    target_id=demand.id,
                    target_code=demand.demand_code,
                    target_name=demand.demand_name or demand.demand_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="销售预测审核通过自动生成需求",
                ),
                created_by=created_by,
            )
        except Exception as e:
            logger.warning("创建销售预测→Demand 单据关联失败: %s", e)

        return demand

    async def approve_forecast(self, tenant_id: int, forecast_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> SalesForecastResponse:
        """审核销售预测"""
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus

        forecast_row = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=forecast_id, deleted_at__isnull=True
        )
        if not forecast_row:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        if rejection_reason:
            assert_sales_forecast_capability(forecast_row, "reject")
        else:
            assert_sales_forecast_capability(forecast_row, "approve")

        async with in_transaction():
            approver_name = await self.get_user_name(approved_by)

            review_status = ReviewStatus.REJECTED.value if rejection_reason else ReviewStatus.APPROVED.value
            status = DocumentStatus.REJECTED.value if rejection_reason else DocumentStatus.AUDITED.value

            await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            demand_synced = False

            updated_forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
            out = updated_forecast.model_dump()
            out["demand_synced"] = demand_synced
            if not rejection_reason:
                auto_push_result = await self._try_auto_push_forecast_to_computation(
                    tenant_id=tenant_id,
                    forecast_id=forecast_id,
                    operator_id=approved_by,
                )
                if auto_push_result:
                    out["auto_computation"] = auto_push_result
            return SalesForecastResponse(**out)

    async def withdraw_forecast_approval(
        self,
        tenant_id: int,
        forecast_id: int,
        withdrawn_by: int,
    ) -> SalesForecastResponse:
        """撤回审核：人工审→待审核，自动审→草稿。"""
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
        from core.services.approval.audit_transition import resolve_revoke_landing_phase

        forecast_row = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=forecast_id, deleted_at__isnull=True
        )
        if not forecast_row:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        has_downstream = await self._forecast_has_downstream(tenant_id, forecast_id)
        assert_sales_forecast_capability(
            forecast_row,
            "revoke_approval",
            has_downstream=has_downstream,
        )

        from infra.services.business_config_service import BusinessConfigService

        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "sales_forecast"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        target_status = (
            DocumentStatus.PENDING_REVIEW.value
            if landing == "pending"
            else DocumentStatus.DRAFT.value
        )

        async with in_transaction():
            await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(
                status=target_status,
                review_status=ReviewStatus.PENDING.value,
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                updated_by=withdrawn_by,
            )
            return await self.get_sales_forecast_by_id(tenant_id, forecast_id)

    async def _try_auto_push_forecast_to_computation(
        self,
        tenant_id: int,
        forecast_id: int,
        operator_id: int,
    ) -> Optional[Dict[str, Any]]:
        """按组织配置在审核通过后自动下推销售预测到需求计算。"""
        from infra.services.business_config_service import BusinessConfigService

        enabled = await BusinessConfigService().auto_push_sales_to_computation_on_approve(tenant_id)
        if not enabled:
            return None
        try:
            return await self.push_to_computation(
                tenant_id=tenant_id,
                forecast_id=forecast_id,
                user_id=operator_id,
            )
        except Exception as exc:
            logger.warning("销售预测自动下推需求计算失败，forecast_id=%s: %s", forecast_id, exc)
            return {"success": False, "message": str(exc)}

    async def add_forecast_item(self, tenant_id: int, forecast_id: int, item_data: SalesForecastItemCreate) -> SalesForecastItemResponse:
        """添加销售预测明细"""
        async with in_transaction():
            # 验证预测存在
            await self.get_sales_forecast_by_id(tenant_id, forecast_id)

            item = await SalesForecastItem.create(
                tenant_id=tenant_id,
                forecast_id=forecast_id,
                **item_data.model_dump(exclude_unset=True)
            )
            return SalesForecastItemResponse.model_validate(item)

    async def get_forecast_items(self, tenant_id: int, forecast_id: int) -> List[SalesForecastItemResponse]:
        """获取销售预测明细"""
        items = await SalesForecastItem.filter(tenant_id=tenant_id, forecast_id=forecast_id).order_by('forecast_date')
        return [SalesForecastItemResponse.model_validate(item) for item in items]

    async def submit_forecast(self, tenant_id: int, forecast_id: int, submitted_by: int) -> SalesForecastResponse:
        """
        提交销售预测
        
        将草稿状态的销售预测提交为待审核状态
        
        Args:
            tenant_id: 租户ID
            forecast_id: 销售预测ID
            submitted_by: 提交人ID
            
        Returns:
            SalesForecastResponse: 更新后的销售预测
            
        Raises:
            NotFoundError: 销售预测不存在
            BusinessLogicError: 销售预测状态不是草稿
        """
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus

        forecast_row = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=forecast_id, deleted_at__isnull=True
        )
        if not forecast_row:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        assert_sales_forecast_capability(forecast_row, "submit")

        async with in_transaction():
            # 检查业务配置：若无需审核，则提交后直接设为已审核（考虑中小企业实情）
            from infra.services.business_config_service import BusinessConfigService
            config_service = BusinessConfigService()
            audit_required = await config_service.check_audit_required(tenant_id, "sales_forecast")

            if not audit_required:
                await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(
                    status=DocumentStatus.CONFIRMED.value,
                    review_status=ReviewStatus.APPROVED.value,
                    updated_by=submitted_by
                )
                # 无需审核时不再自动创建 Demand，保持链路为「销售预测→需求计算（显式下推）」。
                await self._try_auto_push_forecast_to_computation(
                    tenant_id=tenant_id,
                    forecast_id=forecast_id,
                    operator_id=submitted_by,
                )
            else:
                await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(
                    status=DocumentStatus.PENDING_REVIEW.value,
                    review_status=ReviewStatus.PENDING.value,
                    updated_by=submitted_by
                )
            
            updated_forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)
            return updated_forecast

    async def withdraw_forecast(
        self,
        tenant_id: int,
        forecast_id: int,
        withdrawn_by: int,
    ) -> SalesForecastResponse:
        """撤回提交：待审核 → 草稿（提交人撤回，非反审核）"""
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus

        forecast_row = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=forecast_id, deleted_at__isnull=True
        )
        if not forecast_row:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        assert_sales_forecast_capability(forecast_row, "withdraw_submit")

        try:
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            await ApprovalInstanceService.cancel_approval(
                tenant_id=tenant_id,
                entity_type="sales_forecast",
                entity_id=forecast_id,
                operator_id=withdrawn_by,
            )
        except Exception as e:
            logger.warning("取消销售预测审批流程失败或无需取消: {}", e)

        await SalesForecast.filter(tenant_id=tenant_id, id=forecast_id).update(
            status=DocumentStatus.DRAFT.value,
            review_status=ReviewStatus.PENDING.value,
            reviewer_id=None,
            reviewer_name=None,
            review_time=None,
            review_remarks=None,
            updated_by=withdrawn_by,
        )
        return await self.get_sales_forecast_by_id(tenant_id, forecast_id)

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据批量导入销售预测
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建销售预测。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从 uni_import 组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '预测名称': 'forecast_name',
            '*预测名称': 'forecast_name',
            'forecast_name': 'forecast_name',
            '*forecast_name': 'forecast_name',
            '预测类型': 'forecast_type',
            'forecast_type': 'forecast_type',
            '预测周期': 'forecast_period',
            '*预测周期': 'forecast_period',
            'forecast_period': 'forecast_period',
            '*forecast_period': 'forecast_period',
            '开始日期': 'start_date',
            '*开始日期': 'start_date',
            'start_date': 'start_date',
            '*start_date': 'start_date',
            '结束日期': 'end_date',
            '*结束日期': 'end_date',
            'end_date': 'end_date',
            '*end_date': 'end_date',
            '备注': 'notes',
            'notes': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['forecast_name', 'forecast_period', 'start_date', 'end_date']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                forecast_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str:
                                # 日期字段需要转换
                                if field in ['start_date', 'end_date']:
                                    try:
                                        from datetime import datetime as dt
                                        # 尝试多种日期格式
                                        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                            try:
                                                forecast_data[field] = dt.strptime(value_str, fmt).date()
                                                break
                                            except ValueError:
                                                continue
                                        else:
                                            raise ValueError(f"日期格式错误：{value_str}")
                                    except Exception as e:
                                        errors.append({
                                            "row": row_idx,
                                            "error": f"日期格式错误：{value_str}，错误：{str(e)}"
                                        })
                                        failure_count += 1
                                        break
                                else:
                                    forecast_data[field] = value_str
                
                # 验证必填字段
                if not forecast_data.get('forecast_name') or not forecast_data.get('forecast_period'):
                    errors.append({
                        "row": row_idx,
                        "error": "预测名称或预测周期为空"
                    })
                    failure_count += 1
                    continue
                
                if 'start_date' not in forecast_data or 'end_date' not in forecast_data:
                    errors.append({
                        "row": row_idx,
                        "error": "开始日期或结束日期为空或格式错误"
                    })
                    failure_count += 1
                    continue
                
                # 设置默认值
                forecast_data.setdefault('forecast_type', 'MTS')
                from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
                forecast_data.setdefault('status', DocumentStatus.DRAFT.value)
                forecast_data.setdefault('review_status', ReviewStatus.PENDING.value)
                
                # 创建销售预测
                forecast_create = SalesForecastCreate(**forecast_data)
                await self.create_sales_forecast(tenant_id, forecast_create, created_by)
                success_count += 1
                
            except Exception as e:
                logger.error(f"导入销售预测失败（第{row_idx}行）: {str(e)}")
                errors.append({
                    "row": row_idx,
                    "error": str(e)
                })
                failure_count += 1
        
        return {
            "success": True,
            "message": "导入完成",
            "total": success_count + failure_count,
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出销售预测到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        
        # 查询所有符合条件的销售预测（不分页）
        forecasts = await self.list_sales_forecasts(tenant_id, skip=0, limit=10000, **filters)
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"sales_forecasts_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '预测编号', '预测名称', '预测类型', '预测周期', 
                '开始日期', '结束日期', '状态', '审核状态', 
                '审核人', '审核时间', '备注', '创建时间'
            ])
            
            # 写入数据
            for forecast in forecasts:
                writer.writerow([
                    forecast.forecast_code,
                    forecast.forecast_name,
                    forecast.forecast_type,
                    forecast.forecast_period,
                    forecast.start_date.strftime('%Y-%m-%d') if forecast.start_date else '',
                    forecast.end_date.strftime('%Y-%m-%d') if forecast.end_date else '',
                    forecast.status,
                    forecast.review_status,
                    forecast.reviewer_name or '',
                    forecast.review_time.strftime('%Y-%m-%d %H:%M:%S') if forecast.review_time else '',
                    forecast.notes or '',
                    forecast.created_at.strftime('%Y-%m-%d %H:%M:%S') if forecast.created_at else '',
                ])
        
        return file_path

    async def preview_push_to_computation(
        self,
        tenant_id: int,
        forecast_id: int,
    ) -> Dict[str, Any]:
        """下推需求计算预览：返回预测明细数量、已下推、可下推，不实际创建。"""
        from apps.kuaizhizao.services.demand_service import DemandService
        from apps.kuaizhizao.services.document_action_policy.sales_forecast import (
            derive_sales_forecast_capabilities,
        )
        from apps.master_data.services.material_service import MaterialService

        forecast_row = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=forecast_id, deleted_at__isnull=True
        )
        if not forecast_row:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")

        demand = await self._get_linked_demand_for_forecast(tenant_id, forecast_id)
        pushed = self._is_forecast_pushed_to_computation(forecast_row, demand)
        item_count = await SalesForecastItem.filter(
            tenant_id=tenant_id, forecast_id=forecast_id
        ).count()
        caps = derive_sales_forecast_capabilities(
            forecast_row,
            pushed_to_computation=pushed,
            has_items=item_count > 0,
        )
        push_allowed = caps.push_computation.allowed
        blocking_reason = caps.push_computation.reason if not push_allowed else None

        if demand and push_allowed and not pushed:
            preview = await DemandService().preview_push_demand_to_computation(
                tenant_id, demand.id
            )
            preview["forecast_code"] = forecast_row.forecast_code
            preview["demand_exists"] = True
            return preview

        items = await SalesForecastItem.filter(
            tenant_id=tenant_id, forecast_id=forecast_id
        ).order_by("id")
        if not items:
            raise BusinessLogicError("销售预测无明细，无法下推需求计算")

        material_ids = [
            int(it.material_id)
            for it in items
            if getattr(it, "material_id", None) and int(it.material_id) > 0
        ]
        bom_map = await MaterialService.batch_check_has_bom(
            tenant_id=tenant_id,
            material_ids=material_ids,
            only_active=True,
        )

        preview_items = []
        for it in items:
            qty = float(it.forecast_quantity or 0)
            if qty <= 0:
                continue
            material_id = int(it.material_id) if getattr(it, "material_id", None) else None
            preview_items.append({
                "item_id": int(it.id),
                "material_id": material_id,
                "material_code": str(it.material_code or "").strip(),
                "material_name": str(it.material_name or "").strip(),
                "quantity": float(qty),
                "pushed_quantity": float(qty) if pushed else 0.0,
                "max_push_quantity": 0.0 if pushed or not push_allowed else float(qty),
                "forecast_date": str(it.forecast_date) if it.forecast_date else None,
                "forecast_month": str(it.forecast_month) if getattr(it, "forecast_month", None) else None,
                "has_bom": bom_map.get(material_id, False) if material_id else False,
            })

        if not preview_items:
            push_allowed = False
            blocking_reason = blocking_reason or "sales_forecast.push_computation.no_items"

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "demand_computation",
            "summary": (
                f"请确认将下推的预测明细（{pushable_count}/{len(preview_items)} 行可下推）"
                if push_allowed
                else "当前销售预测不可下推需求计算"
            ),
            "forecast_code": forecast_row.forecast_code,
            "demand_exists": demand is not None,
            "items": preview_items,
            "has_blocking_issues": not push_allowed,
            "blocking_reason": blocking_reason if not push_allowed else None,
            "tip": "确认后将创建需求并下推需求计算任务；整单下推后不可重复操作。",
        }

    async def push_to_computation(
        self,
        tenant_id: int,
        forecast_id: int,
        planning_horizon: int = 12,
        time_bucket: str = "week",
        user_id: int = None
    ) -> Dict[str, Any]:
        """
        下推到需求计算（统一使用 demand_computation，替代原 MRP 运算）
        
        从销售预测获取或创建 Demand，然后下推到 DemandComputation。
        
        Args:
            tenant_id: 租户ID
            forecast_id: 销售预测ID
            planning_horizon: 计划周期（月数，默认12个月，保留参数兼容）
            time_bucket: 时间粒度（week/month，保留参数兼容）
            user_id: 用户ID（可选）
            
        Returns:
            Dict: 需求计算结果，含 computation_id、computation_code 等
        """
        from apps.kuaizhizao.services.demand_service import DemandService

        forecast_row = await SalesForecast.get_or_none(
            tenant_id=tenant_id, id=forecast_id, deleted_at__isnull=True
        )
        if not forecast_row:
            raise NotFoundError(f"销售预测不存在: {forecast_id}")
        demand = await self._get_linked_demand_for_forecast(tenant_id, forecast_id)
        pushed = self._is_forecast_pushed_to_computation(forecast_row, demand)
        item_count = await SalesForecastItem.filter(tenant_id=tenant_id, forecast_id=forecast_id).count()
        assert_sales_forecast_capability(
            forecast_row,
            "push_computation",
            pushed_to_computation=pushed,
            has_items=item_count > 0,
        )

        forecast = await self.get_sales_forecast_by_id(tenant_id, forecast_id)

        if not demand:
            demand = await self._create_demand_from_sales_forecast(
                tenant_id, forecast_id, user_id or forecast.created_by
            )

        result = await DemandService().push_to_computation(
            tenant_id=tenant_id,
            demand_id=demand.id,
            created_by=user_id or forecast.created_by,
        )
        return {
            "forecast_id": forecast_id,
            "forecast_code": forecast.forecast_code,
            "demand_computation": result,
            "computation_id": result.get("computation_id"),
            "computation_code": result.get("computation_code"),
            "message": result.get("message", "需求计算下推成功"),
        }

    async def push_to_mrp(
        self,
        tenant_id: int,
        forecast_id: int,
        planning_horizon: int = 12,
        time_bucket: str = "week",
        user_id: int = None
    ) -> Dict[str, Any]:
        """兼容旧命名：push_to_mrp -> push_to_computation。"""
        return await self.push_to_computation(
            tenant_id=tenant_id,
            forecast_id=forecast_id,
            planning_horizon=planning_horizon,
            time_bucket=time_bucket,
            user_id=user_id,
        )



class SalesOrderService(AppBaseService[SalesOrder]):
    """销售订单服务"""

    def __init__(self):
        super().__init__(SalesOrder)

    async def create_sales_order(self, tenant_id: int, order_data: SalesOrderCreate, created_by: int) -> SalesOrderResponse:
        """创建销售订单"""
        async with in_transaction():
            from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
            
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "SALES_ORDER_CODE", prefix=f"SO{today}")

            # 提取items（如果存在）
            items_data = order_data.model_dump().get('items', [])
            
            # 如果order_data中已包含order_code，则排除它（因为我们要使用生成的编码）
            order_dict = order_data.model_dump(exclude_unset=True, exclude={'created_by', 'order_code', 'items'})
            order_dict['order_code'] = code
            
            order = await SalesOrder.create(
                tenant_id=tenant_id,
                created_by=created_by,
                created_by_name=user_info.get("name", ""),
                **order_dict
            )
            
            # 创建订单明细（仅传入模型字段，required_quantity/item_amount 映射为 order_quantity/total_amount）
            if items_data:
                for item_data in items_data:
                    order_quantity = item_data.get('order_quantity') or item_data.get('required_quantity') or item_data.get('quantity') or 0
                    order_quantity = float(order_quantity) if order_quantity is not None else 0
                    delivered_quantity = float(item_data.get('delivered_quantity') or 0)
                    remaining_quantity = item_data.get('remaining_quantity')
                    if remaining_quantity is not None:
                        remaining_quantity = float(remaining_quantity)
                    else:
                        remaining_quantity = order_quantity - delivered_quantity
                    total_amt = item_data.get('total_amount') if item_data.get('total_amount') is not None else item_data.get('item_amount')
                    total_amt = float(total_amt) if total_amt is not None else (order_quantity * float(item_data.get('unit_price') or 0))
                    delivery_date = item_data.get('delivery_date')
                    if delivery_date is None:
                        delivery_date = order_dict.get('delivery_date')
                    if hasattr(delivery_date, 'isoformat'):
                        delivery_date = date.fromisoformat(delivery_date.isoformat()[:10]) if delivery_date else date.today()
                    elif isinstance(delivery_date, str) and len(delivery_date) >= 10:
                        delivery_date = date.fromisoformat(delivery_date[:10])
                    elif isinstance(delivery_date, date):
                        pass
                    else:
                        delivery_date = date.today()
                    await SalesOrderItem.create(
                        tenant_id=tenant_id,
                        sales_order_id=order.id,
                        material_id=item_data.get('material_id') or 0,
                        material_code=(item_data.get('material_code') or '')[:50],
                        material_name=(item_data.get('material_name') or '')[:200],
                        material_spec=(item_data.get('material_spec') or '')[:200] or None,
                        material_unit=(item_data.get('material_unit') or '')[:20],
                        order_quantity=order_quantity,
                        delivered_quantity=delivered_quantity,
                        remaining_quantity=remaining_quantity,
                        unit_price=float(item_data.get('unit_price') or 0),
                        total_amount=total_amt,
                        delivery_date=delivery_date,
                        delivery_status=item_data.get('delivery_status') or '待交货',
                        work_order_id=item_data.get('work_order_id'),
                        work_order_code=(item_data.get('work_order_code') or '')[:50] or None,
                        notes=item_data.get('notes'),
                    )
            
            return SalesOrderResponse.model_validate(order)

    async def get_sales_order_by_id(
        self, tenant_id: int, order_id: int, include_items: bool = False
    ) -> SalesOrderResponse:
        """根据ID获取销售订单，可选包含订单明细"""
        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"销售订单不存在: {order_id}")
        resp = SalesOrderResponse.model_validate(order)
        if include_items:
            items = await SalesOrderItem.filter(
                tenant_id=tenant_id, sales_order_id=order_id
            ).order_by("id")
            resp = resp.model_copy(update={"items": [SalesOrderItemResponse.model_validate(it) for it in items]})
        return resp

    async def list_sales_orders(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[SalesOrderListResponse]:
        """
        获取销售订单列表
        
        注意：返回数组格式，与基础数据管理APP保持一致
        前端在 request 函数中手动包装为 { data, total, success } 格式
        """
        query = SalesOrder.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('customer_id'):
            query = query.filter(customer_id=filters['customer_id'])
        if filters.get('order_type'):
            query = query.filter(order_type=filters['order_type'])
        if filters.get('delivery_date_start'):
            query = query.filter(delivery_date__gte=filters['delivery_date_start'])
        if filters.get('delivery_date_end'):
            query = query.filter(delivery_date__lte=filters['delivery_date_end'])

        # 获取分页数据
        orders = await query.offset(skip).limit(limit).order_by('-created_at')
        
        # 返回数组格式（与车间页面保持一致）
        return [SalesOrderListResponse.model_validate(order).model_dump() for order in orders]

    async def update_sales_order(self, tenant_id: int, order_id: int, order_data: SalesOrderUpdate, updated_by: int) -> SalesOrderResponse:
        """更新销售订单"""
        async with in_transaction():
            order = await self.get_sales_order_by_id(tenant_id, order_id)
            update_data = order_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by

            await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(**update_data)
            updated_order = await self.get_sales_order_by_id(tenant_id, order_id)
            return updated_order

    async def approve_order(self, tenant_id: int, order_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> SalesOrderResponse:
        """审核销售订单"""
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, REVIEW_STATUS_ALIASES

        async with in_transaction():
            order = await self.get_sales_order_by_id(tenant_id, order_id)

            current_review = str(order.review_status or "").strip()
            if REVIEW_STATUS_ALIASES.get(current_review, current_review) != ReviewStatus.PENDING.value:
                raise BusinessLogicError("销售订单审核状态不是待审核")

            approver_name = await self.get_user_name(approved_by)

            review_status = ReviewStatus.REJECTED.value if rejection_reason else ReviewStatus.APPROVED.value
            status = DocumentStatus.REJECTED.value if rejection_reason else DocumentStatus.AUDITED.value

            await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            updated_order = await self.get_sales_order_by_id(tenant_id, order_id)
            return updated_order

    async def confirm_order(self, tenant_id: int, order_id: int, confirmed_by: int) -> SalesOrderResponse:
        """确认销售订单（转为MTO模式执行）"""
        async with in_transaction():
            order = await self.get_sales_order_by_id(tenant_id, order_id)

            from apps.kuaizhizao.constants import DocumentStatus, LEGACY_AUDITED_VALUES

            if order.status not in LEGACY_AUDITED_VALUES:
                raise BusinessLogicError("只有已审核状态的销售订单才能确认")

            await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(
                status=DocumentStatus.CONFIRMED.value,
                updated_by=confirmed_by
            )

            # TODO: 触发LRP运算
            # TODO: 生成专属采购订单
            # TODO: 生成专属工单

            updated_order = await self.get_sales_order_by_id(tenant_id, order_id)
            return updated_order

    async def add_order_item(self, tenant_id: int, order_id: int, item_data: SalesOrderItemCreate) -> SalesOrderItemResponse:
        """添加销售订单明细"""
        async with in_transaction():
            # 验证订单存在
            await self.get_sales_order_by_id(tenant_id, order_id)

            # 计算剩余数量
            remaining_quantity = item_data.order_quantity - item_data.delivered_quantity

            item = await SalesOrderItem.create(
                tenant_id=tenant_id,
                sales_order_id=order_id,
                remaining_quantity=remaining_quantity,
                **item_data.model_dump(exclude_unset=True)
            )

            # 更新订单总数量和总金额
            await self._update_order_totals(tenant_id, order_id)

            return SalesOrderItemResponse.model_validate(item)

    async def get_order_items(self, tenant_id: int, order_id: int) -> List[SalesOrderItemResponse]:
        """获取销售订单明细"""
        items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=order_id).order_by('delivery_date')
        return [SalesOrderItemResponse.model_validate(item) for item in items]

    async def push_to_lrp(
        self,
        tenant_id: int,
        order_id: int,
        planning_horizon: int = 3,
        consider_capacity: bool = False,
        user_id: int = None
    ) -> Dict[str, Any]:
        """
        下推到需求计算（统一使用 demand_computation，替代原 LRP 运算）
        
        从销售订单获取或创建 Demand，然后下推到 DemandComputation。
        保留 planning_horizon、consider_capacity 参数以兼容调用方。
        
        Args:
            tenant_id: 租户ID
            order_id: 销售订单ID
            planning_horizon: 计划周期（月数，保留参数兼容）
            consider_capacity: 是否考虑产能（保留参数兼容）
            user_id: 用户ID（可选）
            
        Returns:
            Dict: 需求计算结果，含 computation_id、computation_code 等
        """
        order = await self.get_sales_order_by_id(tenant_id, order_id)
        from apps.kuaizhizao.services.sales_order_service import SalesOrderService as SalesOrderSvc
        result = await SalesOrderSvc().push_sales_order_to_computation(
            tenant_id=tenant_id,
            sales_order_id=order_id,
            created_by=user_id or order.created_by,
        )
        return {
            "order_id": order_id,
            "order_code": order.order_code,
            "demand_computation": result,
            "computation_id": result.get("computation_id"),
            "computation_code": result.get("computation_code"),
            "message": result.get("message", "需求计算下推成功"),
        }

    async def push_to_delivery(
        self,
        tenant_id: int,
        order_id: int,
        created_by: int,
        delivery_quantities: Optional[Dict[int, float]] = None
    ) -> Dict[str, Any]:
        """
        下推到销售出库
        
        从销售订单下推，自动生成销售出库单
        
        Args:
            tenant_id: 租户ID
            order_id: 销售订单ID
            created_by: 创建人ID
            delivery_quantities: 出库数量字典 {item_id: quantity}，如果不提供则使用订单未出库数量
            
        Returns:
            Dict: 包含创建的销售出库单信息
            
        Raises:
            NotFoundError: 销售订单不存在
            BusinessLogicError: 销售订单未审核或已全部出库
        """
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService
        from apps.kuaizhizao.schemas.warehouse import SalesDeliveryCreate, SalesDeliveryItemCreate
        from decimal import Decimal
        
        # 验证销售订单存在且已审核
        from apps.kuaizhizao.constants import ORDER_PUSHABLE_STATUSES

        order = await self.get_sales_order_by_id(tenant_id, order_id)
        if order.status not in ORDER_PUSHABLE_STATUSES:
            raise BusinessLogicError("只有已审核、已确认或进行中状态的销售订单才能下推到销售出库")
        
        # 获取订单明细
        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id
        ).all()
        
        if not order_items:
            raise BusinessLogicError("销售订单没有明细，无法生成出库单")
        
        # 检查是否有未出库的明细
        has_outstanding = any(
            (item.delivered_quantity or 0) < (item.order_quantity or 0) 
            for item in order_items
        )
        if not has_outstanding:
            raise BusinessLogicError("销售订单已全部出库，无法再次生成出库单")
        
        # 创建销售出库单
        delivery_service = SalesDeliveryService()
        
        # 构建出库单明细
        delivery_items = []
        for item in order_items:
            # 确定出库数量
            if delivery_quantities and item.id in delivery_quantities:
                delivery_quantity = Decimal(str(delivery_quantities[item.id]))
            else:
                delivery_quantity = Decimal(str(item.order_quantity or 0)) - Decimal(str(item.delivered_quantity or 0))
            
            # 跳过数量为0的明细
            if delivery_quantity <= 0:
                continue
            
            # 验证出库数量不超过未出库数量
            outstanding = Decimal(str(item.order_quantity or 0)) - Decimal(str(item.delivered_quantity or 0))
            if delivery_quantity > outstanding:
                raise ValidationError(f"物料 {item.material_code} 的出库数量 {delivery_quantity} 超过未出库数量 {outstanding}")
            
            delivery_items.append(SalesDeliveryItemCreate(
                material_id=item.material_id,
                material_code=item.material_code or '',
                material_name=item.material_name or '',
                material_unit=item.material_unit or '件',
                delivery_quantity=float(delivery_quantity),
                unit_price=float(item.unit_price or 0),
                total_amount=float(delivery_quantity * Decimal(str(item.unit_price or 0)))
            ))
        
        if not delivery_items:
            raise BusinessLogicError("没有可出库的明细")

        # 统一按物料默认仓库解析出库仓，禁止写死默认仓库
        from apps.master_data.models.material import Material
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )

        material_wh_cache: Dict[int, Optional[tuple[int, str]]] = {}
        resolved_wh_pairs: List[tuple[int, str]] = []
        for row in delivery_items:
            material_id = int(row.material_id or 0)
            if material_id <= 0:
                raise ValidationError("销售出库明细缺少物料ID，无法解析出库仓库")
            if material_id not in material_wh_cache:
                material = await Material.get_or_none(
                    tenant_id=tenant_id,
                    id=material_id,
                    deleted_at__isnull=True,
                )
                if not material:
                    raise ValidationError(f"物料不存在: {material_id}")
                material_wh_cache[material_id] = await resolve_primary_default_warehouse_from_material(
                    tenant_id=tenant_id,
                    material=material,
                )
            resolved = material_wh_cache[material_id]
            if not resolved:
                raise ValidationError(f"物料 {row.material_code or material_id} 未配置默认仓库，无法生成销售出库单")
            resolved_wh_pairs.append((int(resolved[0]), str(resolved[1])))

        unique_warehouse_ids = {wid for wid, _ in resolved_wh_pairs}
        if len(unique_warehouse_ids) != 1:
            raise ValidationError(
                "当前出库明细对应多个默认仓库，请先拆分单据后再生成销售出库单"
            )
        resolved_wh_id, resolved_wh_name = resolved_wh_pairs[0]
        
        # 创建出库单
        delivery_data = SalesDeliveryCreate(
            sales_order_id=order_id,
            sales_order_code=order.order_code,
            customer_id=order.customer_id,
            customer_name=order.customer_name or '',
            warehouse_id=resolved_wh_id,
            warehouse_name=resolved_wh_name,
            items=delivery_items
        )
        
        delivery = await delivery_service.create_sales_delivery(
            tenant_id=tenant_id,
            delivery_data=delivery_data,
            created_by=created_by,
            # 下推仅生成待出库单，批号/序列号在仓库确认出库时录入（与发货通知下推一致）
            require_batch_serial_on_create=False,
        )
        
        return {
            "order_id": order_id,
            "order_code": order.order_code,
            "delivery_id": delivery.id if hasattr(delivery, 'id') else None,
            "delivery_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
            "message": "销售出库单创建成功"
        }

    async def update_delivery_status(self, tenant_id: int, order_id: int, item_id: int, delivered_quantity: float, updated_by: int) -> SalesOrderItemResponse:
        """更新交货状态"""
        async with in_transaction():
            item = await SalesOrderItem.get_or_none(tenant_id=tenant_id, id=item_id, sales_order_id=order_id)
            if not item:
                raise NotFoundError(f"销售订单明细不存在: {item_id}")

            new_delivered_quantity = item.delivered_quantity + delivered_quantity
            if new_delivered_quantity > item.order_quantity:
                raise ValidationError("交货数量不能超过订单数量")

            new_remaining_quantity = item.order_quantity - new_delivered_quantity
            delivery_status = "已交货" if new_remaining_quantity <= 0 else "部分交货"

            await SalesOrderItem.filter(tenant_id=tenant_id, id=item_id).update(
                delivered_quantity=new_delivered_quantity,
                remaining_quantity=new_remaining_quantity,
                delivery_status=delivery_status,
                updated_by=updated_by
            )

            # 更新订单总数量
            await self._update_order_totals(tenant_id, order_id)

            updated_item = await SalesOrderItem.get(tenant_id=tenant_id, id=item_id)
            return SalesOrderItemResponse.model_validate(updated_item)

    async def _update_order_totals(self, tenant_id: int, order_id: int):
        """更新订单总数量和总金额"""
        # 计算总数量和总金额
        result = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=order_id).aggregate(
            total_quantity=Sum('order_quantity'),
            total_delivered=Sum('delivered_quantity'),
            total_amount=Sum('total_amount')
        )

        total_quantity = result.get('total_quantity', 0) or 0
        total_delivered = result.get('total_delivered', 0) or 0
        total_amount = result.get('total_amount', 0) or 0

        # 判断订单状态
        if total_delivered >= total_quantity and total_quantity > 0:
            status = "已完成"
        elif total_delivered > 0:
            status = "部分交货"
        else:
            status = "已确认"

        await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(
            total_quantity=total_quantity,
            total_amount=total_amount,
            status=status
        )

    async def submit_order(self, tenant_id: int, order_id: int, submitted_by: int) -> SalesOrderResponse:
        """
        提交销售订单
        
        将草稿状态的销售订单提交为待审核状态
        
        Args:
            tenant_id: 租户ID
            order_id: 销售订单ID
            submitted_by: 提交人ID
            
        Returns:
            SalesOrderResponse: 更新后的销售订单
            
        Raises:
            NotFoundError: 销售订单不存在
            BusinessLogicError: 销售订单状态不是草稿
        """
        async with in_transaction():
            order = await self.get_sales_order_by_id(tenant_id, order_id)
            
            from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, is_draft_status

            if not is_draft_status(order.status):
                raise BusinessLogicError(f"只有草稿状态的销售订单才能提交，当前状态：{order.status}")
            
            # 更新状态为待审核
            await SalesOrder.filter(tenant_id=tenant_id, id=order_id).update(
                status=DocumentStatus.PENDING_REVIEW.value,
                review_status=ReviewStatus.PENDING.value,
                updated_by=submitted_by
            )
            
            updated_order = await self.get_sales_order_by_id(tenant_id, order_id)
            return updated_order

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据批量导入销售订单
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建销售订单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从 uni_import 组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '客户名称': 'customer_name',
            '*客户名称': 'customer_name',
            'customer_name': 'customer_name',
            '*customer_name': 'customer_name',
            '订单日期': 'order_date',
            '*订单日期': 'order_date',
            'order_date': 'order_date',
            '*order_date': 'order_date',
            '交货日期': 'delivery_date',
            '*交货日期': 'delivery_date',
            'delivery_date': 'delivery_date',
            '*delivery_date': 'delivery_date',
            '订单类型': 'order_type',
            'order_type': 'order_type',
            '发货方式': 'shipping_method',
            'shipping_method': 'shipping_method',
            '收货地址': 'shipping_address',
            'shipping_address': 'shipping_address',
            '付款条件': 'payment_terms',
            'payment_terms': 'payment_terms',
            '备注': 'notes',
            'notes': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['customer_name', 'order_date', 'delivery_date']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                order_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            value_str = str(value).strip()
                            if value_str:
                                # 日期字段需要转换
                                if field in ['order_date', 'delivery_date']:
                                    try:
                                        from datetime import datetime as dt
                                        # 尝试多种日期格式
                                        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                            try:
                                                order_data[field] = dt.strptime(value_str, fmt).date()
                                                break
                                            except ValueError:
                                                continue
                                        else:
                                            raise ValueError(f"日期格式错误：{value_str}")
                                    except Exception as e:
                                        errors.append({
                                            "row": row_idx,
                                            "error": f"日期格式错误：{value_str}，错误：{str(e)}"
                                        })
                                        failure_count += 1
                                        break
                                else:
                                    order_data[field] = value_str
                
                # 验证必填字段
                if not order_data.get('customer_name') or not order_data.get('order_date') or not order_data.get('delivery_date'):
                    errors.append({
                        "row": row_idx,
                        "error": "客户名称、订单日期或交货日期为空"
                    })
                    failure_count += 1
                    continue
                
                # 设置默认值
                order_data.setdefault('order_type', 'MTO')
                from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
                order_data.setdefault('status', DocumentStatus.DRAFT.value)
                order_data.setdefault('review_status', ReviewStatus.PENDING.value)
                
                # 创建销售订单
                from apps.kuaizhizao.schemas.sales import SalesOrderCreate
                order_create_data = SalesOrderCreate(**order_data)
                
                await self.create_sales_order(
                    tenant_id=tenant_id,
                    order_data=order_create_data,
                    created_by=created_by
                )
                
                success_count += 1
                
            except Exception as e:
                errors.append({
                    "row": row_idx,
                    "error": f"导入失败：{str(e)}"
                })
                failure_count += 1
                logger.error(f"导入销售订单失败（第{row_idx}行）：{str(e)}")
        
        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "data": {
                "success_count": success_count,
                "failure_count": failure_count,
                "errors": errors
            }
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出销售订单到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        from datetime import datetime
        
        # 查询所有符合条件的销售订单（不分页）
        orders = await self.list_sales_orders(tenant_id, skip=0, limit=10000, **filters)
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"sales_orders_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '订单编号', '客户名称', '订单类型', '订单日期', 
                '交货日期', '状态', '审核状态', '总数量', '总金额',
                '发货方式', '收货地址', '付款条件', '备注', '创建时间'
            ])
            
            # 写入数据
            for order in orders:
                writer.writerow([
                    order.order_code,
                    order.customer_name,
                    order.order_type,
                    order.order_date.strftime('%Y-%m-%d') if order.order_date else '',
                    order.delivery_date.strftime('%Y-%m-%d') if order.delivery_date else '',
                    order.status,
                    order.review_status,
                    str(order.total_quantity) if order.total_quantity else '0',
                    str(order.total_amount) if order.total_amount else '0',
                    order.shipping_method or '',
                    order.shipping_address or '',
                    order.payment_terms or '',
                    order.notes or '',
                    order.created_at.strftime('%Y-%m-%d %H:%M:%S') if order.created_at else '',
                ])
        
        return file_path
