"""
工单、返工单、工序委外 API 路由模块

提供工单、返工单、工序委外管理的API接口。
"""

from typing import List, Optional, Dict, Any
from datetime import date, datetime
from fastapi import APIRouter, Depends, Query, status as http_status, HTTPException
from fastapi.responses import JSONResponse
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from core.api.deps.access import require_permission_codes
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
from apps.kuaizhizao.services.demand_source_chain_service import DemandSourceChainService
from apps.kuaizhizao.services.outsource_service import OutsourceService
from apps.kuaizhizao.schemas.visual_scheduling import (
    OperationBatchUpdateDatesResult,
    OperationBatchUpdateStationsResult,
    WorkOrderBatchUpdateDatesResult,
)
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderBatchUpdateDatesRequest,
    WorkOrderOperationBatchUpdateDatesRequest,
    WorkOrderOperationBatchUpdateStationsRequest,
    WorkOrderSchedulingQuickActionRequest,
    WorkOrderSchedulingQuickActionResult,
    WorkOrderResponse,
    MaterialShortageResponse,
    WorkOrderFreezeRequest,
    WorkOrderUnfreezeRequest,
    WorkOrderPriorityRequest,
    WorkOrderBatchPriorityRequest,
    WorkOrderMergeRequest,
    WorkOrderMergeResponse,
    WorkOrderMergeIntoGroupRequest,
    WorkOrderMergeIntoGroupResponse,
    WorkOrderDissolveGroupRequest,
    WorkOrderDissolveGroupResponse,
    WorkOrderCreatePeerGroupRequest,
    WorkOrderCreatePeerGroupResponse,
    WorkOrderSplitRequest,
    WorkOrderSplitResponse,
    WorkOrderOperationResponse,
    WorkOrderOperationsUpdateRequest,
    WorkOrderOperationDispatch,
    WorkOrderKittingAnalysisResponse,
    WorkOrderTrackingPreviewRequest,
    WorkOrderTrackingPreviewResponse,
    WorkOrderConfirmTrackingRequest,
    WorkOrderCompleteRequest,
)
from apps.kuaizhizao.schemas.work_order_score import (
    WorkOrderScoreResponse,
    WorkOrderScoreConfigResponse,
    WorkOrderBatchScoreRefreshRequest,
)
from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
from apps.kuaizhizao.schemas.rework_order import (
    ReworkOrderCreate,
    ReworkOrderUpdate,
    ReworkOrderResponse,
    ReworkOrderListResponse,
    ReworkOrderFromWorkOrderRequest,
    ReworkReportingCreate,
    ReworkReportingOptionsResponse,
)
from apps.kuaizhizao.schemas.reporting_record import ReportingRecordResponse
from apps.kuaizhizao.schemas.station import OperationPauseRequest, OperationCompleteRequest
from apps.kuaizhizao.services.station_service import StationService
from apps.kuaizhizao.schemas.outsource_order import (
    OutsourceOrderCreate,
    OutsourceOrderCreateFromWorkOrder,
    OutsourceOrderUpdate,
    OutsourceOrderResponse,
    OutsourceOrderListResponse,
    OutsourceOptionResponse,
)

router = APIRouter(
    tags=["App · Kuaige Zhizao · Production Execution"],
    dependencies=[Depends(require_kuaizhizao_module_access("work-order"))],
)


# ============ 工单管理 API ============

@router.post("/work-orders", response_model=WorkOrderResponse, summary="Create work order")
async def create_work_order(
    work_order: WorkOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    创建工单

    - **work_order**: 工单创建数据
    - **current_user**: 当前用户
    - **tenant_id**: 当前组织ID

    返回创建的工单信息。
    """
    return await WorkOrderService().create_work_order(
        tenant_id=tenant_id,
        work_order_data=work_order,
        created_by=current_user.id
    )


@router.post(
    "/work-orders/tracking/preview",
    response_model=WorkOrderTrackingPreviewResponse,
    summary="Preview batch/serial numbers for work order",
)
async def preview_work_order_tracking(
    body: WorkOrderTrackingPreviewRequest,
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderTrackingPreviewResponse:
    """按物料追踪模式预览批号/序列号（不占用流水号）。"""
    from apps.master_data.models.material import Material
    from apps.kuaizhizao.services.work_order_tracking_service import WorkOrderTrackingService

    material = await Material.get_or_none(
        id=body.product_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    if not material:
        raise HTTPException(status_code=404, detail="物料不存在")
    preview = await WorkOrderTrackingService().preview_tracking_numbers(
        tenant_id=tenant_id,
        material=material,
        quantity=body.quantity,
        batch_rule_id=body.batch_rule_id,
        serial_rule_id=body.serial_rule_id,
    )
    return WorkOrderTrackingPreviewResponse.model_validate(preview)


@router.post(
    "/work-orders/{work_order_id}/confirm-tracking",
    response_model=WorkOrderResponse,
    summary="Confirm work order batch/serial tracking",
)
async def confirm_work_order_tracking(
    work_order_id: int,
    body: WorkOrderConfirmTrackingRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    _: None = Depends(require_permission_codes("kuaizhizao:work-order:confirm_adjustment")),
) -> WorkOrderResponse:
    """完工时确认或修改批号/序列号（不改工单状态）。"""
    return await WorkOrderService().confirm_work_order_tracking(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        updated_by=current_user.id,
        confirmed_batch_no=body.confirmed_batch_no,
        confirmed_serial_no=body.confirmed_serial_no,
    )


@router.post(
    "/work-orders/create-peer-group",
    response_model=WorkOrderCreatePeerGroupResponse,
    summary="Create peer-level work order group with detail lines",
)
async def create_peer_group_work_orders(
    body: WorkOrderCreatePeerGroupRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderCreatePeerGroupResponse:
    """
    新建平级组工单：按明细表批量创建工单并编入同一虚拟工单组。
    """
    from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService

    items = [
        {
            "product_id": it.product_id,
            "quantity": it.quantity,
            "priority": it.priority,
            "process_route_id": it.process_route_id,
            "allow_operation_jump": it.allow_operation_jump,
            "over_report_mode": it.over_report_mode,
            "over_report_value": it.over_report_value,
        }
        for it in body.items
    ]
    result = await WorkOrderGroupService().create_peer_group_work_orders(
        tenant_id=tenant_id,
        items=items,
        group_name=body.group_name,
        production_mode=body.production_mode,
        sales_order_id=body.sales_order_id,
        planned_start_date=body.planned_start_date,
        planned_end_date=body.planned_end_date,
        created_by=current_user.id,
    )
    return WorkOrderCreatePeerGroupResponse.model_validate(result)


@router.get("/work-orders/statistics", summary="Work order statistics (KPI cards)")
async def get_work_order_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    返回工单各维度数量，用于列表页指标卡片。
    指标：进行中、今日完成、逾期、草稿、已完成。
    使用单次 SQL 聚合查询替代 5 次 count，减少数据库往返。
    """
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    sql_ok = False
    in_progress_count = 0
    completed_today_count = 0
    overdue_count = 0
    draft_count = 0
    completed_count = 0
    total_count = 0

    try:
        from tortoise import Tortoise
        conn = Tortoise.get_connection("default")
        if hasattr(conn, "execute_query_dict"):
            rows = await conn.execute_query_dict(
                """
                SELECT
                    COUNT(*) AS total_count,
                    COUNT(*) FILTER (WHERE status IN ('released', 'in_progress')) AS in_progress_count,
                    COUNT(*) FILTER (WHERE status = 'completed' AND actual_end_date >= $1 AND actual_end_date <= $2) AS completed_today_count,
                    COUNT(*) FILTER (WHERE status IN ('released', 'in_progress') AND planned_end_date < $1) AS overdue_count,
                    COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
                    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
                FROM apps_kuaizhizao_work_orders
                WHERE tenant_id = $3 AND deleted_at IS NULL
                """,
                [today_start, today_end, tenant_id],
            )
            if rows and len(rows) > 0:
                r = rows[0]
                total_count = int(r.get("total_count", 0) or 0)
                in_progress_count = int(r.get("in_progress_count", 0) or 0)
                completed_today_count = int(r.get("completed_today_count", 0) or 0)
                overdue_count = int(r.get("overdue_count", 0) or 0)
                draft_count = int(r.get("draft_count", 0) or 0)
                completed_count = int(r.get("completed_count", 0) or 0)
                sql_ok = True
    except Exception as e:
        logger.warning(f"work-order-statistics 聚合查询失败，回退到分次查询: {e}")

    if not sql_ok:
        from apps.kuaizhizao.models.work_order import WorkOrder
        base = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        total_count = await base.count()
        in_progress_count = await base.filter(status__in=["released", "in_progress"]).count()
        completed_today_count = await base.filter(
            status="completed",
            actual_end_date__gte=today_start,
            actual_end_date__lte=today_end,
        ).count()
        overdue_count = await base.filter(
            status__in=["released", "in_progress"],
            planned_end_date__lt=today_start,
        ).count()
        draft_count = await base.filter(status="draft").count()
        completed_count = await base.filter(status="completed").count()

    # 补充前端指标卡需要的字段（基于现有数据合理计算）
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.reporting_record import ReportingRecord
    rb = ReportingRecord.filter(tenant_id=tenant_id)
    try:
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        today_vals = await rb.filter(
            reported_at__gte=today_start,
            reported_at__lte=today_end,
        ).values_list("qualified_quantity", flat=True)
        qualified_output_today = int(sum(float(v or 0) for v in today_vals))
    except Exception:
        qualified_output_today = 0

    total_wip = in_progress_count  # 在制品数 = 进行中工单数
    completion_rate = round(completed_count / total_count * 100, 1) if total_count > 0 else 0
    # 一次合格率：completed / (completed + overdue) 的简化近似
    denom = completed_count + overdue_count or 1
    first_pass_yield = round(completed_count / denom * 100, 1)
    # 计划达成率：completed_today / (completed_today + overdue) 的简化近似
    plan_denom = completed_today_count + overdue_count or 1
    plan_achievement_rate = round(completed_today_count / plan_denom * 100, 1)
    manufacturing_lead_time = 0  # 需复杂计算，暂返回 0

    # 近7天趋势数据（真实数据，用于折线图指标卡）
    from datetime import timedelta as td
    from tortoise.expressions import Q
    trend_completed = []      # 每日完成工单数
    trend_output = []        # 每日合格产出（报工汇总）
    trend_yield = []          # 每日合格率（%）
    trend_operation_count = []  # 每日工序完成数量（报工记录数）
    trend_overdue = []        # 每日逾期工单数（计划结束日<当日且当日未完成）
    for i in range(6, -1, -1):
        d = today - td(days=i)
        date_str = d.strftime("%Y-%m-%d")
        day_start = datetime.combine(d, datetime.min.time())
        day_end = datetime.combine(d, datetime.max.time())
        # 当日完成的工单数
        try:
            wo_base = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="completed")
            cnt = await wo_base.filter(
                actual_end_date__gte=day_start,
                actual_end_date__lte=day_end,
            ).count()
        except Exception:
            cnt = 0
        trend_completed.append({"date": date_str, "value": cnt})
        # 当日逾期数：计划结束日<当日 且 当日结束时未完成（进行中 或 实际完成日>当日）
        try:
            overdue_base = WorkOrder.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, planned_end_date__lt=day_end
            )
            overdue_cnt = await overdue_base.filter(
                Q(status__in=["released", "in_progress"]) | Q(status="completed", actual_end_date__gt=day_end)
            ).count()
        except Exception:
            overdue_cnt = 0
        trend_overdue.append({"date": date_str, "value": overdue_cnt})
        # 当日合格产出、不合格产出、工序完成数、合格率
        try:
            day_records = await rb.filter(
                reported_at__gte=day_start,
                reported_at__lte=day_end,
            ).values_list("qualified_quantity", "unqualified_quantity")
            out_sum = 0
            unq_sum = 0
            for q, u in day_records:
                out_sum += float(q or 0)
                unq_sum += float(u or 0)
            op_count = len(day_records)  # 工序完成数量 = 报工记录数
            total_qty = out_sum + unq_sum
            yield_pct = round(out_sum / total_qty * 100, 1) if total_qty > 0 else 0
        except Exception:
            out_sum = 0
            op_count = 0
            yield_pct = 0
        trend_output.append({"date": date_str, "value": int(out_sum)})
        trend_operation_count.append({"date": date_str, "value": op_count})
        trend_yield.append({"date": date_str, "value": yield_pct})

    # 今日合格率（合格数量 / 总报工数量）
    try:
        today_records = await rb.filter(
            reported_at__gte=today_start,
            reported_at__lte=today_end,
        ).values_list("qualified_quantity", "unqualified_quantity")
        today_qualified = sum(float(q or 0) for q, _ in today_records)
        today_unqualified = sum(float(u or 0) for _, u in today_records)
        today_total = today_qualified + today_unqualified
        qualified_rate_today = round(today_qualified / today_total * 100, 1) if today_total > 0 else 0
        operation_completed_today = len(today_records)
    except Exception:
        qualified_rate_today = 0
        operation_completed_today = 0

    trend_wip = [{"date": x["date"], "value": total_wip} for x in trend_completed]
    trend_draft = [{"date": x["date"], "value": draft_count} for x in trend_completed]

    # 昨日对比值（从趋势数据倒数第二天获取，用于「较昨日」展示）
    yesterday_completed_count = trend_completed[-2]["value"] if len(trend_completed) > 1 else 0
    yesterday_operation_count = trend_operation_count[-2]["value"] if len(trend_operation_count) > 1 else 0
    yesterday_qualified_output = trend_output[-2]["value"] if len(trend_output) > 1 else 0
    yesterday_qualified_rate = trend_yield[-2]["value"] if len(trend_yield) > 1 else 0
    yesterday_wip = trend_wip[-2]["value"] if len(trend_wip) > 1 else 0
    yesterday_overdue_count = trend_overdue[-2]["value"] if len(trend_overdue) > 1 else 0
    yesterday_draft_count = trend_draft[-2]["value"] if len(trend_draft) > 1 else 0

    return {
        "in_progress_count": in_progress_count,
        "completed_today_count": completed_today_count,
        "overdue_count": overdue_count,
        "draft_count": draft_count,
        "completed_count": completed_count,
        "total_count": total_count,
        "completion_rate": completion_rate,
        "qualified_output_today": qualified_output_today,
        "qualified_rate_today": qualified_rate_today,
        "operation_completed_today": operation_completed_today,
        "total_wip": total_wip,
        "yesterday_completed_count": yesterday_completed_count,
        "yesterday_operation_count": yesterday_operation_count,
        "yesterday_qualified_output": yesterday_qualified_output,
        "yesterday_qualified_rate": yesterday_qualified_rate,
        "yesterday_wip": yesterday_wip,
        "yesterday_overdue_count": yesterday_overdue_count,
        "yesterday_draft_count": yesterday_draft_count,
        "first_pass_yield": first_pass_yield,
        "plan_achievement_rate": plan_achievement_rate,
        "manufacturing_lead_time": manufacturing_lead_time,
        "trend_completed": trend_completed,
        "trend_output": trend_output,
        "trend_yield": trend_yield,
        "trend_operation_count": trend_operation_count,
        "trend_wip": trend_wip,
        "trend_overdue": trend_overdue,
        "trend_draft": trend_draft,
        "trends": {
            "output": [x["value"] for x in trend_output],
            "completed": [x["value"] for x in trend_completed],
            "yield": [x["value"] for x in trend_yield],
            "operation_count": [x["value"] for x in trend_operation_count],
            "wip": [total_wip] * 7,
            "overdue": [x["value"] for x in trend_overdue],
            "draft": [x["value"] for x in trend_draft],
        },
    }


# 工单可排序字段白名单（防止注入）
WORK_ORDER_SORTABLE_FIELDS = frozenset({
    "code", "name", "product_code", "product_name", "quantity",
    "status", "priority", "production_mode", "sales_order_code",
    "planned_start_date", "planned_end_date", "actual_start_date", "actual_end_date",
    "completed_quantity", "qualified_quantity", "created_at", "updated_at",
})


@router.get("/work-orders", summary="List work orders")
async def list_work_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="工单编码（模糊搜索）"),
    name: Optional[str] = Query(None, description="工单名称（模糊搜索）"),
    product_name: Optional[str] = Query(None, description="产品名称（模糊搜索）"),
    production_mode: Optional[str] = Query(None, description="生产模式（MTS/MTO）"),
    status: Optional[str] = Query(None, description="工单状态"),
    workshop_id: Optional[int] = Query(None, description="车间ID"),
    work_center_id: Optional[int] = Query(None, description="工作中心ID"),
    assigned_worker_id: Optional[int] = Query(None, description="分配员工ID（只看当前用户时传入）"),
    keyword: Optional[str] = Query(
        None,
        description="关键词搜索（工单编码、名称、产品、来源订单号等）",
    ),
    sales_order_code: Optional[str] = Query(None, description="来源订单号（销售订单编码，模糊）"),
    planned_start_from: Optional[str] = Query(None, description="计划开始日期起（YYYY-MM-DD）"),
    planned_start_to: Optional[str] = Query(None, description="计划开始日期止（YYYY-MM-DD）"),
    planned_end_from: Optional[str] = Query(None, description="计划结束日期起（YYYY-MM-DD）"),
    planned_end_to: Optional[str] = Query(None, description="计划结束日期止（YYYY-MM-DD）"),
    order_by: Optional[str] = Query(None, description="排序字段，如 code、-created_at（前缀-表示降序）"),
    include_operations: bool = Query(False, description="是否包含工序（用于甘特图展示设备/模具/工装）"),
    include_operation_steps: bool = Query(
        False,
        description="是否返回工序步骤摘要（列表工序列 / 运营看板同口径）",
    ),
    include_readiness: bool = Query(
        False,
        description="是否强制重算当前页齐套率并写库；默认 false，列表读持久化 readiness_rate",
    ),
    include_scores: bool = Query(
        False,
        description="是否附带排程/备料综合分（读缓存快照，不触发重算）",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取工单列表

    支持多种筛选条件的高级搜索。
    返回格式：{ "data": [], "total": 0, "success": true }
    """
    # 校验 order_by 防止注入
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in WORK_ORDER_SORTABLE_FIELDS:
            safe_order_by = order_by

    try:
        service = WorkOrderService()
        result, total = await service.list_work_orders(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            code=code,
            name=name,
            product_name=product_name,
            production_mode=production_mode,
            status=status,
            workshop_id=workshop_id,
            work_center_id=work_center_id,
            assigned_worker_id=assigned_worker_id,
            keyword=keyword,
            sales_order_code=sales_order_code,
            planned_start_from=planned_start_from,
            planned_start_to=planned_start_to,
            planned_end_from=planned_end_from,
            planned_end_to=planned_end_to,
            order_by=safe_order_by,
            include_operations=include_operations,
            include_operation_steps=include_operation_steps,
            include_readiness=include_readiness,
            include_scores=include_scores,
        )
        return {
            "data": result,
            "total": total,
            "success": True
        }
    except Exception as e:
        from loguru import logger
        logger.error(f"获取工单列表失败: {str(e)}")
        logger.exception(e)
        raise


# 静态子路径须注册在 /work-orders/{work_order_id} 之前，否则 execution-config 会被当成整数 ID 解析（422）
@router.get("/work-orders/execution-config", summary="Work order execution config")
async def get_work_order_execution_config(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from infra.services.business_config_service import BusinessConfigService
    from apps.kuaizhizao.services.warehouse_service import ProductionPickingService

    policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
    last_inbound_mode = await BusinessConfigService().get_last_operation_auto_inbound_mode(tenant_id)
    default_production_worker_mode = await BusinessConfigService().get_reporting_default_production_worker_mode(
        tenant_id
    )
    can_confirm_picking, role_codes = await ProductionPickingService().can_user_confirm_picking(
        tenant_id=tenant_id,
        user_id=current_user.id,
    )
    return {
        **policy,
        "last_operation_auto_inbound_mode": last_inbound_mode,
        "default_production_worker_mode": default_production_worker_mode,
        "current_user_role_codes": sorted(role_codes),
        "current_user_can_confirm_picking": can_confirm_picking,
    }


@router.get("/work-orders/score-config", response_model=WorkOrderScoreConfigResponse, summary="Get work order score config")
async def get_work_order_score_config(
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderScoreConfigResponse:
    """获取租户工单综合打分配置（权重模板）。"""
    return await WorkOrderScoreService().get_score_config(tenant_id)


@router.post("/work-orders/scores/batch-refresh", summary="Batch refresh work order scores")
async def batch_refresh_work_order_scores(
    body: WorkOrderBatchScoreRefreshRequest,
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """批量刷新工单综合分（管理员/定时任务亦可用）。"""
    return await WorkOrderScoreService().batch_refresh(
        tenant_id=tenant_id,
        work_order_ids=body.work_order_ids,
        scenarios=body.scenarios,
        include_kitting=False,
    )


@router.get("/work-orders/delayed", summary="List delayed work orders")
async def get_delayed_work_orders(
    days_threshold: int = Query(0, ge=0, description="延期天数阈值（默认0，即只要超过计划结束日期就算延期）"),
    status: Optional[str] = Query(None, description="工单状态过滤（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    查询延期工单

    根据计划结束日期和当前日期，查询所有延期的工单。

    - **days_threshold**: 延期天数阈值（默认0）
    - **status**: 工单状态过滤（可选）
    """
    delayed_orders = await WorkOrderService().check_delayed_work_orders(
        tenant_id=tenant_id,
        days_threshold=days_threshold,
        status=status
    )
    return JSONResponse(
        content={
            "total": len(delayed_orders),
            "delayed_orders": delayed_orders
        },
        status_code=http_status.HTTP_200_OK
    )


@router.get("/work-orders/delay-analysis", summary="Delay root-cause analysis")
async def analyze_delay_reasons(
    work_order_id: Optional[int] = Query(None, description="工单ID（可选，如果为None则分析所有延期工单）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    分析延期原因

    分析工单延期的原因，包括缺料、产能不足、质量问题等。

    - **work_order_id**: 工单ID（可选，如果为None则分析所有延期工单）
    """
    result = await WorkOrderService().analyze_delay_reasons(
        tenant_id=tenant_id,
        work_order_id=work_order_id
    )
    return JSONResponse(
        content=result,
        status_code=http_status.HTTP_200_OK
    )


@router.get("/work-orders/{work_order_id:int}", response_model=WorkOrderResponse, summary="Get work order")
async def get_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    根据ID获取工单详情

    - **work_order_id**: 工单ID
    """
    return await WorkOrderService().get_work_order_by_id(
        tenant_id=tenant_id,
        work_order_id=work_order_id
    )


@router.get("/work-orders/{work_order_id}/demand-source-chain", summary="Work order demand source chain")
async def get_work_order_demand_chain(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取工单的需求来源追溯链路

    追溯路径：WorkOrder → DemandComputation → Demand → SalesOrder/SalesForecast
    """
    try:
        service = DemandSourceChainService()
        return await service.get_work_order_demand_chain(tenant_id, work_order_id)
    except Exception as e:
        if isinstance(e, NotFoundError):
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
        logger.exception("获取工单需求来源链路失败")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取需求来源链路失败: {str(e)}",
        )


@router.get("/work-orders/{work_order_id}/operations", summary="List work order operations")
async def get_work_order_operations(
    work_order_id: int,
    include_meta: bool = Query(
        False,
        description="为 true 时返回对象 { manufacturing_mode, operations }，列表行展开时单次请求即可；默认仍为工序数组",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取工单工序列表

    - **work_order_id**: 工单ID
    - **include_meta**: 为 true 时返回带制造模式的 JSON 对象，兼容默认数组格式
    """
    return await WorkOrderService().get_work_order_operations(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        include_meta=include_meta,
    )


@router.put("/work-orders/{work_order_id}/operations", response_model=List[WorkOrderOperationResponse], summary="Update work order operation")
async def update_work_order_operations(
    work_order_id: int,
    operations_data: WorkOrderOperationsUpdateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[WorkOrderOperationResponse]:
    """
    更新工单工序

    支持工序的增删改和顺序调整。已报工的工序不允许修改。

    - **work_order_id**: 工单ID
    - **operations_data**: 工序数据（operations: 工序列表）
    """
    return await WorkOrderService().update_work_order_operations(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operations_data=operations_data,
        updated_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/operations/{operation_id}/dispatch", response_model=WorkOrderOperationResponse, summary="Dispatch work order operation")
async def dispatch_work_order_operation(
    work_order_id: int,
    operation_id: int,
    dispatch_data: WorkOrderOperationDispatch,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderOperationResponse:
    """
    派工工单工序

    分配工序给具体的人员或设备。

    - **work_order_id**: 工单ID
    - **operation_id**: 工序ID
    - **dispatch_data**: 派工数据（worker_id, equipment_id等）
    """
    return await WorkOrderService().dispatch_work_order_operation(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operation_id=operation_id,
        dispatch_data=dispatch_data,
        dispatched_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/operations/{operation_id}/start", response_model=WorkOrderOperationResponse, summary="Start work order operation")
async def start_work_order_operation(
    work_order_id: int,
    operation_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderOperationResponse:
    """
    开始工单工序

    将工序状态从 pending 更新为 in_progress，并记录实际开始时间。

    - **work_order_id**: 工单ID
    - **operation_id**: 工序ID（工单工序的ID，不是工序模板的ID）
    """
    return await WorkOrderService().start_work_order_operation(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        operation_id=operation_id,
        started_by=current_user.id
    )


@router.post(
    "/work-orders/{work_order_id}/operations/{operation_id}/pause",
    summary="Pause work order operation (station downtime)",
)
async def pause_work_order_operation(
    work_order_id: int,
    operation_id: int,
    data: OperationPauseRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await StationService().pause_work_order_operation(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=operation_id,
            data=data,
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/work-orders/{work_order_id}/operations/{operation_id}/resume",
    summary="Resume paused work order operation",
)
async def resume_work_order_operation(
    work_order_id: int,
    operation_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await StationService().resume_work_order_operation(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=operation_id,
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/work-orders/{work_order_id}/operations/{operation_id}/complete",
    response_model=WorkOrderOperationResponse,
    summary="Complete work order operation (station end)",
)
async def complete_work_order_operation(
    work_order_id: int,
    operation_id: int,
    data: OperationCompleteRequest | None = None,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderOperationResponse:
    remarks = data.remarks if data else None
    try:
        return await StationService().complete_work_order_operation(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=operation_id,
            completed_by=current_user.id,
            remarks=remarks,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/work-orders/{work_order_id}/picking-confirmation-status", summary="Check picking confirmation status")
async def get_work_order_picking_confirmation_status(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    service = WorkOrderService()
    has_confirmed = await service.has_confirmed_picking_for_work_order(tenant_id, work_order_id)
    return {
        "work_order_id": work_order_id,
        "has_confirmed_picking": has_confirmed,
    }


@router.get(
    "/work-orders/{work_order_id}/default-inbound-warehouse",
    summary="Resolve default inbound warehouse for work order",
)
async def get_work_order_default_inbound_warehouse(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

    wo = await WorkOrder.get_or_none(
        tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
    )
    if not wo:
        raise HTTPException(status_code=404, detail=f"工单不存在: {work_order_id}")

    resolved = await FinishedGoodsReceiptService().resolve_default_inbound_warehouse_for_work_order(
        tenant_id=tenant_id,
        work_order=wo,
    )
    if not resolved:
        return {"warehouse_id": None, "warehouse_name": None}
    wh_id, wh_name = resolved
    return {"warehouse_id": wh_id, "warehouse_name": wh_name}


@router.put("/work-orders/{work_order_id:int}", response_model=WorkOrderResponse, summary="Update work order")
async def update_work_order(
    work_order_id: int,
    work_order: WorkOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    更新工单信息

    - **work_order_id**: 工单ID
    - **work_order**: 工单更新数据
    """
    return await WorkOrderService().update_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        work_order_data=work_order,
        updated_by=current_user.id
    )


@router.put(
    "/work-orders/batch-update-dates",
    response_model=WorkOrderBatchUpdateDatesResult,
    summary="Batch update work order planned dates",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def batch_update_work_order_dates(
    request: WorkOrderBatchUpdateDatesRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderBatchUpdateDatesResult:
    """批量更新工单计划日期（甘特图拖拽后持久化）。"""
    raw = await WorkOrderService().batch_update_dates(
        tenant_id=tenant_id,
        updates=request.updates,
        updated_by=current_user.id,
    )
    return WorkOrderBatchUpdateDatesResult(**raw)


@router.put(
    "/work-orders/batch-update-operation-dates",
    response_model=OperationBatchUpdateDatesResult,
    summary="Batch update operation planned dates",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def batch_update_work_order_operation_dates(
    request: WorkOrderOperationBatchUpdateDatesRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OperationBatchUpdateDatesResult:
    """批量更新工序计划日期（工序级派工，甘特图拖拽工序后持久化）。"""
    raw = await WorkOrderService().batch_update_operation_dates(
        tenant_id=tenant_id,
        updates=request.updates,
        updated_by=current_user.id,
    )
    return OperationBatchUpdateDatesResult(**raw)


@router.put(
    "/work-orders/batch-update-operation-stations",
    response_model=OperationBatchUpdateStationsResult,
    summary="Batch update operation assigned stations",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def batch_update_work_order_operation_stations(
    request: WorkOrderOperationBatchUpdateStationsRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OperationBatchUpdateStationsResult:
    """批量更新工序指派工位（可视排产跨工位改派）。"""
    raw = await WorkOrderService().batch_update_operation_stations(
        tenant_id=tenant_id,
        updates=request.updates,
        updated_by=current_user.id,
    )
    return OperationBatchUpdateStationsResult(**raw)


@router.post(
    "/work-orders/scheduling-quick-action",
    response_model=WorkOrderSchedulingQuickActionResult,
    summary="Scheduling quick actions for overdue/frozen work orders",
    dependencies=[Depends(require_permission_codes("kuaizhizao:plan-management-scheduling:update"))],
)
async def scheduling_quick_action(
    body: WorkOrderSchedulingQuickActionRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderSchedulingQuickActionResult:
    """可视排产快捷处置：延期确认 / 转异常 / 解冻申请。"""
    raw = await WorkOrderService().scheduling_quick_action(
        tenant_id=tenant_id,
        body=body,
        handled_by=current_user.id,
    )
    return WorkOrderSchedulingQuickActionResult(**raw)


@router.delete("/work-orders/{work_order_id:int}", summary="Delete work order")
async def delete_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除工单（软删除）

    - **work_order_id**: 工单ID
    """
    await WorkOrderService().delete_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id
    )

    return JSONResponse(
        content={"message": "工单删除成功"},
        status_code=http_status.HTTP_200_OK
    )


@router.post("/work-orders/{work_order_id}/split", response_model=WorkOrderSplitResponse, summary="Split work order")
async def split_work_order(
    work_order_id: int,
    split_data: WorkOrderSplitRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderSplitResponse:
    """
    拆分工单

    支持按数量拆分（将大工单拆分成多个小工单）。
    按工序拆分功能暂未实现。

    - **work_order_id**: 原工单ID
    - **split_data**: 拆分数据（split_type、split_quantities或split_count）
    """
    return await WorkOrderService().split_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        split_data=split_data,
        created_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/freeze", response_model=WorkOrderResponse, summary="Freeze work order")
async def freeze_work_order(
    work_order_id: int,
    freeze_data: WorkOrderFreezeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    冻结工单

    - **work_order_id**: 工单ID
    - **freeze_data**: 冻结数据（包含冻结原因）
    """
    return await WorkOrderService().freeze_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        freeze_data=freeze_data,
        frozen_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/unfreeze", response_model=WorkOrderResponse, summary="Unfreeze work order")
async def unfreeze_work_order(
    work_order_id: int,
    unfreeze_data: WorkOrderUnfreezeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    解冻工单

    - **work_order_id**: 工单ID
    - **unfreeze_data**: 解冻数据（可选解冻原因）
    """
    return await WorkOrderService().unfreeze_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        unfreeze_data=unfreeze_data,
        unfrozen_by=current_user.id
    )


@router.put("/work-orders/{work_order_id}/priority", response_model=WorkOrderResponse, summary="Set work order priority")
async def set_work_order_priority(
    work_order_id: int,
    priority_data: WorkOrderPriorityRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    设置工单优先级

    - **work_order_id**: 工单ID
    - **priority_data**: 优先级数据（priority: low/normal/high/urgent）
    """
    return await WorkOrderService().set_work_order_priority(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        priority_data=priority_data,
        updated_by=current_user.id
    )


@router.put("/work-orders/batch-priority", response_model=List[WorkOrderResponse], summary="Batch set work order priority")
async def batch_set_work_order_priority(
    batch_data: WorkOrderBatchPriorityRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[WorkOrderResponse]:
    """
    批量设置工单优先级

    - **batch_data**: 批量优先级数据（work_order_ids: 工单ID列表, priority: low/normal/high/urgent）
    """
    return await WorkOrderService().batch_set_work_order_priority(
        tenant_id=tenant_id,
        batch_data=batch_data,
        updated_by=current_user.id
    )


@router.post("/work-orders/merge", response_model=WorkOrderMergeResponse, summary="Merge work orders")
async def merge_work_orders(
    merge_data: WorkOrderMergeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderMergeResponse:
    """
    合并工单（累加数量为一张新工单，原工单取消）

    - **merge_data**: 合并数据（work_order_ids: 要合并的工单ID列表（至少2个）, remarks: 合并备注（可选））
    """
    return await WorkOrderService().merge_work_orders(
        tenant_id=tenant_id,
        merge_data=merge_data,
        created_by=current_user.id
    )


@router.post(
    "/work-orders/merge-into-group",
    response_model=WorkOrderMergeIntoGroupResponse,
    summary="Merge work orders into work order group",
)
async def merge_work_orders_into_group(
    merge_data: WorkOrderMergeIntoGroupRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderMergeIntoGroupResponse:
    """
    将多张工单编入同一工单组（原工单保留，仅在列表中以组展示）。
    """
    from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService

    result = await WorkOrderGroupService().merge_work_orders_into_group(
        tenant_id=tenant_id,
        work_order_ids=merge_data.work_order_ids,
        root_work_order_id=merge_data.root_work_order_id,
        created_by=current_user.id,
        remarks=merge_data.remarks,
    )
    return WorkOrderMergeIntoGroupResponse.model_validate(result)


@router.post(
    "/work-orders/dissolve-group",
    response_model=WorkOrderDissolveGroupResponse,
    summary="Dissolve work order groups",
)
async def dissolve_work_order_groups(
    body: WorkOrderDissolveGroupRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderDissolveGroupResponse:
    """
    解除编组：取消组内工单与委外单的编组关系，工单与委外单保留。
    """
    from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService

    result = await WorkOrderGroupService().dissolve_work_order_groups(
        tenant_id=tenant_id,
        work_order_group_ids=body.work_order_group_ids,
        updated_by=current_user.id,
    )
    return WorkOrderDissolveGroupResponse.model_validate(result)


@router.post("/work-orders/{work_order_id}/rework", response_model=ReworkOrderResponse, summary="Create rework order from work order")
async def create_rework_order_from_work_order(
    work_order_id: int,
    request_data: ReworkOrderFromWorkOrderRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkOrderResponse:
    """
    从工单创建返工单

    根据原工单信息创建返工单，自动关联原工单。返工单编码自动生成：返工-{原工单号}-{序号}

    - **work_order_id**: 原工单ID
    - **request_data**: 返工单创建请求数据（返工原因、返工类型等，部分字段可从原工单继承）
    """
    return await ReworkOrderService().create_rework_order_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        request_data=request_data,
        created_by=current_user.id
    )


# ============ 返工单管理 API ============

@router.post("/rework-orders", response_model=ReworkOrderResponse, summary="Create rework order")
async def create_rework_order(
    rework_order: ReworkOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkOrderResponse:
    """
    创建返工单

    - **rework_order**: 返工单创建数据
    """
    return await ReworkOrderService().create_rework_order(
        tenant_id=tenant_id,
        rework_order_data=rework_order,
        created_by=current_user.id
    )


@router.get("/rework-orders", response_model=List[ReworkOrderListResponse], summary="List rework orders")
async def list_rework_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    code: Optional[str] = Query(None, description="返工单编码（模糊搜索）"),
    status: Optional[str] = Query(None, description="返工单状态"),
    original_work_order_id: Optional[int] = Query(None, description="原工单ID"),
    product_name: Optional[str] = Query(None, description="产品名称（模糊搜索）"),
    rework_type: Optional[str] = Query(None, description="返工类型"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[ReworkOrderListResponse]:
    """
    获取返工单列表

    支持多种筛选条件的高级搜索。
    """
    return await ReworkOrderService().list_rework_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        code=code,
        status=status,
        original_work_order_id=original_work_order_id,
        product_name=product_name,
        rework_type=rework_type,
    )


@router.get("/rework-orders/{rework_order_id}", response_model=ReworkOrderResponse, summary="Get rework order")
async def get_rework_order(
    rework_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkOrderResponse:
    """
    根据ID获取返工单详情

    - **rework_order_id**: 返工单ID
    """
    return await ReworkOrderService().get_rework_order_by_id(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id
    )


@router.put("/rework-orders/{rework_order_id}", response_model=ReworkOrderResponse, summary="Update rework order")
async def update_rework_order(
    rework_order_id: int,
    rework_order: ReworkOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkOrderResponse:
    """
    更新返工单信息

    - **rework_order_id**: 返工单ID
    - **rework_order**: 返工单更新数据
    """
    return await ReworkOrderService().update_rework_order(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id,
        rework_order_data=rework_order,
        updated_by=current_user.id
    )


@router.delete("/rework-orders/{rework_order_id}", summary="Delete rework order")
async def delete_rework_order(
    rework_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除返工单（软删除）

    - **rework_order_id**: 返工单ID
    """
    await ReworkOrderService().delete_rework_order(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id
    )

    return JSONResponse(
        content={"message": "返工单删除成功"},
        status_code=http_status.HTTP_200_OK
    )


@router.get(
    "/rework-orders/{rework_order_id}/reporting-options",
    response_model=ReworkReportingOptionsResponse,
    summary="Get rework order reporting options",
)
async def get_rework_order_reporting_options(
    rework_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReworkReportingOptionsResponse:
    """返工报工：可选工序与剩余可报工数量（首道报工固定为创建时指定的起始工序）。"""
    return await ReworkOrderService().get_rework_reporting_options(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id,
    )


@router.post(
    "/rework-orders/{rework_order_id}/report",
    response_model=ReportingRecordResponse,
    summary="Create reporting record for rework order",
)
async def create_rework_order_reporting(
    rework_order_id: int,
    reporting_data: ReworkReportingCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ReportingRecordResponse:
    """返工报工：首次必须在起始工序；之后可选原工单任意工序并录入数量。"""
    return await ReworkOrderService().create_rework_reporting(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id,
        reporting_data=reporting_data,
        reported_by=current_user.id,
    )


@router.get(
    "/work-orders/{work_order_id}/outsource-options",
    response_model=List[OutsourceOptionResponse],
    summary="List outsource options for work order operations",
)
async def list_work_order_outsource_options(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceOptionResponse]:
    """
    获取工单各工序的可委外数量

    - **work_order_id**: 工单ID
    """
    return await OutsourceService().list_outsource_options(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
    )


@router.post("/work-orders/{work_order_id}/outsource", response_model=OutsourceOrderResponse, summary="Create outsourced operation from work order")
async def create_outsource_order_from_work_order(
    work_order_id: int,
    outsource_data: OutsourceOrderCreateFromWorkOrder,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    从工单工序创建工序委外

    根据工单工序信息创建工序委外单，自动关联工单和工序。

    - **work_order_id**: 工单ID
    - **outsource_data**: 工序委外单创建数据（工单工序ID、供应商ID、委外数量等）
    """
    return await OutsourceService().create_outsource_order_from_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        work_order_operation_id=outsource_data.work_order_operation_id,
        supplier_id=outsource_data.supplier_id,
        outsource_quantity=outsource_data.outsource_quantity,
        unit_price=outsource_data.unit_price,
        planned_start_date=outsource_data.planned_start_date,
        planned_end_date=outsource_data.planned_end_date,
        remarks=outsource_data.remarks,
        created_by=current_user.id
    )


# ============ 工序委外管理 API ============

@router.post("/outsource-orders", response_model=OutsourceOrderResponse, summary="Create outsourced operation")
async def create_outsource_order(
    outsource_order: OutsourceOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    创建工序委外

    - **outsource_order**: 工序委外单创建数据
    """
    return await OutsourceService().create_outsource_order(
        tenant_id=tenant_id,
        outsource_order_data=outsource_order,
        created_by=current_user.id
    )


@router.get("/outsource-orders", response_model=List[OutsourceOrderListResponse], summary="List outsourced operations")
async def list_outsource_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    work_order_id: Optional[int] = Query(None, description="工单ID"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    status: Optional[str] = Query(None, description="工序委外状态"),
    code: Optional[str] = Query(None, description="工序委外单编码（模糊搜索）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[OutsourceOrderListResponse]:
    """
    获取工序委外列表

    支持多种筛选条件的高级搜索。
    """
    return await OutsourceService().list_outsource_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        work_order_id=work_order_id,
        supplier_id=supplier_id,
        status=status,
        code=code,
    )


@router.get("/outsource-orders/{outsource_order_id}", response_model=OutsourceOrderResponse, summary="Get outsourced operation")
async def get_outsource_order(
    outsource_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    根据ID获取工序委外详情

    - **outsource_order_id**: 工序委外单ID
    """
    return await OutsourceService().get_outsource_order_by_id(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id
    )


@router.put("/outsource-orders/{outsource_order_id}", response_model=OutsourceOrderResponse, summary="Update outsourced operation")
async def update_outsource_order(
    outsource_order_id: int,
    outsource_order: OutsourceOrderUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    更新工序委外信息

    - **outsource_order_id**: 工序委外单ID
    - **outsource_order**: 工序委外单更新数据
    """
    return await OutsourceService().update_outsource_order(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id,
        outsource_order_data=outsource_order,
        updated_by=current_user.id
    )


@router.delete("/outsource-orders/{outsource_order_id}", summary="Delete outsourced operation")
async def delete_outsource_order(
    outsource_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    """
    删除工序委外（软删除）

    - **outsource_order_id**: 工序委外单ID
    """
    await OutsourceService().delete_outsource_order(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id,
        deleted_by=current_user.id
    )

    return JSONResponse(
        content={"message": "工序委外删除成功"},
        status_code=http_status.HTTP_200_OK
    )


@router.post("/outsource-orders/{outsource_order_id}/link-purchase-receipt", response_model=OutsourceOrderResponse, summary="Link purchase receipt")
async def link_purchase_receipt_to_outsource_order(
    outsource_order_id: int,
    purchase_receipt_id: int = Query(..., description="采购入库单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> OutsourceOrderResponse:
    """
    关联采购入库单（工序委外入库）

    - **outsource_order_id**: 工序委外单ID
    - **purchase_receipt_id**: 采购入库单ID
    """
    return await OutsourceService().link_purchase_receipt(
        tenant_id=tenant_id,
        outsource_order_id=outsource_order_id,
        purchase_receipt_id=purchase_receipt_id,
        updated_by=current_user.id
    )


@router.get("/work-orders/{work_order_id}/check-shortage", response_model=MaterialShortageResponse, summary="Check work order material shortage")
async def check_work_order_shortage(
    work_order_id: int,
    warehouse_id: Optional[int] = Query(None, description="仓库ID（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialShortageResponse:
    """
    检查工单缺料情况

    根据工单的BOM和当前库存，检查是否存在缺料。

    - **work_order_id**: 工单ID
    - **warehouse_id**: 仓库ID（可选，如果为None则查询所有仓库）
    """
    result = await WorkOrderService().check_material_shortage(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        warehouse_id=warehouse_id
    )
    return MaterialShortageResponse(**result)


@router.get(
    "/work-orders/{work_order_id}/push-production-picking/preview",
    summary="Preview push work order to production picking",
)
async def preview_push_work_order_to_production_picking(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """工单下推生产领料预览：返回齐套明细数量、已领料、可领料量。"""
    from apps.kuaizhizao.services.warehouse_service import ProductionPickingService
    from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

    try:
        return await ProductionPickingService().preview_push_work_order_to_production_picking(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/work-orders/{work_order_id}/kitting-analysis",
    response_model=WorkOrderKittingAnalysisResponse,
    summary="Work order kitting analysis",
)
async def get_work_order_kitting_analysis(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderKittingAnalysisResponse:
    """
    BOM 展开 + 已领料 + 库位库存，返回齐套率与明细（与前端齐套分析面板、列表悬停一致）。
    """
    try:
        return await WorkOrderService().get_work_order_kitting_analysis(tenant_id, work_order_id)
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/work-orders/{work_order_id}/release", response_model=WorkOrderResponse, summary="Release work order")
async def release_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    下达工单

    将工单状态从"草稿"更新为"已下达"。
    是否检查缺料由业务配置「缺料拦截级别」决定：
    0=不拦截，1=下达拦截，2=下达+开工拦截，3=下达+开工+报工拦截。

    - **work_order_id**: 工单ID
    """
    from infra.services.business_config_service import BusinessConfigService
    block_level = await BusinessConfigService().get_material_shortage_block_level(tenant_id)
    check_shortage = block_level >= 1
    return await WorkOrderService().release_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        released_by=current_user.id,
        check_shortage=check_shortage
    )


@router.post("/work-orders/{work_order_id}/revoke", response_model=WorkOrderResponse, summary="Withdraw work order")
async def revoke_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    撤回工单

    将已下达或指定结束的工单撤回为草稿状态。
    撤回条件：
    - 工单状态为 'released'（已下达）或 'completed'（已完成且为指定结束）
    - 工单没有产生过报工记录

    - **work_order_id**: 工单ID
    """
    return await WorkOrderService().revoke_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        revoked_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/complete", response_model=WorkOrderResponse, summary="Force-close work order")
async def manually_complete_work_order(
    work_order_id: int,
    body: Optional[WorkOrderCompleteRequest] = None,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    指定结束工单

    将工单状态改为已完成，并标记为指定结束。
    可附带确认批号/序列号；未传则沿用计划值或按规则生成。
    """
    req = body or WorkOrderCompleteRequest()
    return await WorkOrderService().manually_complete_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        completed_by=current_user.id,
        confirmed_batch_no=req.confirmed_batch_no,
        confirmed_serial_no=req.confirmed_serial_no,
    )


@router.get(
    "/work-orders/{work_order_id}/scores",
    response_model=WorkOrderScoreResponse,
    summary="Get work order composite score",
)
async def get_work_order_score(
    work_order_id: int,
    scenario: str = Query("scheduling", description="场景 scheduling/picking"),
    refresh_if_stale: bool = Query(False, description="缓存过期时自动重算"),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderScoreResponse:
    """获取单工单综合分及分解明细。"""
    score = await WorkOrderScoreService().get_score(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        scenario=scenario,
        refresh_if_stale=refresh_if_stale,
    )
    if not score:
        raise HTTPException(status_code=404, detail="工单不存在或未启用综合打分")
    return score


@router.post(
    "/work-orders/{work_order_id}/scores/refresh",
    response_model=List[WorkOrderScoreResponse],
    summary="Refresh work order composite scores",
)
async def refresh_work_order_scores(
    work_order_id: int,
    scenarios: Optional[List[str]] = Query(None, description="场景列表，默认 scheduling+picking"),
    tenant_id: int = Depends(get_current_tenant),
) -> List[WorkOrderScoreResponse]:
    """手动刷新单工单综合分。"""
    return await WorkOrderScoreService().refresh_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        scenarios=scenarios,
        include_kitting=True,
    )
