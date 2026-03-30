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
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError

from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
from apps.kuaizhizao.services.demand_source_chain_service import DemandSourceChainService
from apps.kuaizhizao.services.outsource_service import OutsourceService
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderBatchUpdateDatesRequest,
    WorkOrderOperationBatchUpdateDatesRequest,
    WorkOrderResponse,
    MaterialShortageResponse,
    WorkOrderFreezeRequest,
    WorkOrderUnfreezeRequest,
    WorkOrderPriorityRequest,
    WorkOrderBatchPriorityRequest,
    WorkOrderMergeRequest,
    WorkOrderMergeResponse,
    WorkOrderSplitRequest,
    WorkOrderSplitResponse,
    WorkOrderOperationResponse,
    WorkOrderOperationsUpdateRequest,
    WorkOrderOperationDispatch,
)
from apps.kuaizhizao.schemas.rework_order import (
    ReworkOrderCreate,
    ReworkOrderUpdate,
    ReworkOrderResponse,
    ReworkOrderListResponse,
    ReworkOrderFromWorkOrderRequest,
)
from apps.kuaizhizao.schemas.outsource_order import (
    OutsourceOrderCreate,
    OutsourceOrderCreateFromWorkOrder,
    OutsourceOrderUpdate,
    OutsourceOrderResponse,
    OutsourceOrderListResponse,
)

router = APIRouter(tags=["Kuaige Zhizao - Production Execution"])


# ============ 工单管理 API ============

@router.post("/work-orders", response_model=WorkOrderResponse, summary="创建工单")
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


@router.get("/work-orders/statistics", summary="获取工单统计（用于指标卡片）")
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
    rb = ReportingRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)
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


@router.get("/work-orders", summary="获取工单列表")
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
    keyword: Optional[str] = Query(None, description="关键词搜索（工单编码、名称、产品名称）"),
    planned_start_from: Optional[str] = Query(None, description="计划开始日期起（YYYY-MM-DD）"),
    planned_start_to: Optional[str] = Query(None, description="计划开始日期止（YYYY-MM-DD）"),
    planned_end_from: Optional[str] = Query(None, description="计划结束日期起（YYYY-MM-DD）"),
    planned_end_to: Optional[str] = Query(None, description="计划结束日期止（YYYY-MM-DD）"),
    order_by: Optional[str] = Query(None, description="排序字段，如 code、-created_at（前缀-表示降序）"),
    include_operations: bool = Query(False, description="是否包含工序（用于甘特图展示设备/模具/工装）"),
    include_readiness: bool = Query(
        True,
        description="是否计算齐套率（BOM+库存）；工单列表页建议 false 以大幅提升首屏速度，齐套率列可为空",
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
            planned_start_from=planned_start_from,
            planned_start_to=planned_start_to,
            planned_end_from=planned_end_from,
            planned_end_to=planned_end_to,
            order_by=safe_order_by,
            include_operations=include_operations,
            include_readiness=include_readiness,
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


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderResponse, summary="获取工单详情")
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


@router.get("/work-orders/{work_order_id}/demand-source-chain", summary="获取工单需求来源链路")
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


@router.get("/work-orders/{work_order_id}/operations", summary="获取工单工序列表")
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


@router.put("/work-orders/{work_order_id}/operations", response_model=List[WorkOrderOperationResponse], summary="更新工单工序")
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


@router.post("/work-orders/{work_order_id}/operations/{operation_id}/dispatch", response_model=WorkOrderOperationResponse, summary="派工工单工序")
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


@router.post("/work-orders/{work_order_id}/operations/{operation_id}/start", response_model=WorkOrderOperationResponse, summary="开始工单工序")
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


@router.get("/work-orders/execution-config", summary="获取工单执行配置（领料确认策略）")
async def get_work_order_execution_config(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    from infra.services.business_config_service import BusinessConfigService
    from apps.kuaizhizao.services.warehouse_service import ProductionPickingService

    policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
    can_confirm_picking, role_codes = await ProductionPickingService().can_user_confirm_picking(
        tenant_id=tenant_id,
        user_id=current_user.id,
    )
    return {
        **policy,
        "current_user_role_codes": sorted(role_codes),
        "current_user_can_confirm_picking": can_confirm_picking,
    }


@router.get("/work-orders/{work_order_id}/picking-confirmation-status", summary="检查工单领料确认状态")
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


@router.put("/work-orders/{work_order_id}", response_model=WorkOrderResponse, summary="更新工单")
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


@router.put("/work-orders/batch-update-dates", summary="批量更新工单计划日期")
async def batch_update_work_order_dates(
    request: WorkOrderBatchUpdateDatesRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量更新工单计划日期（甘特图拖拽后持久化）

    - **updates**: 更新项列表，每项包含 work_order_id、planned_start_date、planned_end_date
    """
    await WorkOrderService().batch_update_dates(
        tenant_id=tenant_id,
        updates=request.updates,
        updated_by=current_user.id,
    )
    return {"success": True, "message": "更新成功"}


@router.put("/work-orders/batch-update-operation-dates", summary="批量更新工序计划日期")
async def batch_update_work_order_operation_dates(
    request: WorkOrderOperationBatchUpdateDatesRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量更新工序计划日期（工序级派工，甘特图拖拽工序后持久化）

    - **updates**: 更新项列表，每项包含 operation_id、planned_start_date、planned_end_date
    """
    await WorkOrderService().batch_update_operation_dates(
        tenant_id=tenant_id,
        updates=request.updates,
        updated_by=current_user.id,
    )
    return {"success": True, "message": "更新成功"}


@router.delete("/work-orders/{work_order_id}", summary="删除工单")
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


@router.post("/work-orders/{work_order_id}/split", response_model=WorkOrderSplitResponse, summary="拆分工单")
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


@router.post("/work-orders/{work_order_id}/freeze", response_model=WorkOrderResponse, summary="冻结工单")
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


@router.post("/work-orders/{work_order_id}/unfreeze", response_model=WorkOrderResponse, summary="解冻工单")
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


@router.put("/work-orders/{work_order_id}/priority", response_model=WorkOrderResponse, summary="设置工单优先级")
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


@router.put("/work-orders/batch-priority", response_model=List[WorkOrderResponse], summary="批量设置工单优先级")
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


@router.post("/work-orders/merge", response_model=WorkOrderMergeResponse, summary="合并工单")
async def merge_work_orders(
    merge_data: WorkOrderMergeRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderMergeResponse:
    """
    合并工单

    - **merge_data**: 合并数据（work_order_ids: 要合并的工单ID列表（至少2个）, remarks: 合并备注（可选））
    """
    return await WorkOrderService().merge_work_orders(
        tenant_id=tenant_id,
        merge_data=merge_data,
        created_by=current_user.id
    )


@router.post("/work-orders/{work_order_id}/rework", response_model=ReworkOrderResponse, summary="从工单创建返工单")
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

@router.post("/rework-orders", response_model=ReworkOrderResponse, summary="创建返工单")
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


@router.get("/rework-orders", response_model=List[ReworkOrderListResponse], summary="获取返工单列表")
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


@router.get("/rework-orders/{rework_order_id}", response_model=ReworkOrderResponse, summary="获取返工单详情")
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


@router.put("/rework-orders/{rework_order_id}", response_model=ReworkOrderResponse, summary="更新返工单")
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


@router.delete("/rework-orders/{rework_order_id}", summary="删除返工单")
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


@router.post("/work-orders/{work_order_id}/outsource", response_model=OutsourceOrderResponse, summary="从工单创建工序委外")
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

@router.post("/outsource-orders", response_model=OutsourceOrderResponse, summary="创建工序委外")
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


@router.get("/outsource-orders", response_model=List[OutsourceOrderListResponse], summary="获取工序委外列表")
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


@router.get("/outsource-orders/{outsource_order_id}", response_model=OutsourceOrderResponse, summary="获取工序委外详情")
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


@router.put("/outsource-orders/{outsource_order_id}", response_model=OutsourceOrderResponse, summary="更新工序委外")
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


@router.delete("/outsource-orders/{outsource_order_id}", summary="删除工序委外")
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


@router.post("/outsource-orders/{outsource_order_id}/link-purchase-receipt", response_model=OutsourceOrderResponse, summary="关联采购入库单")
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


@router.get("/work-orders/{work_order_id}/check-shortage", response_model=MaterialShortageResponse, summary="检查工单缺料")
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


@router.post("/work-orders/{work_order_id}/release", response_model=WorkOrderResponse, summary="下达工单")
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


@router.post("/work-orders/{work_order_id}/revoke", response_model=WorkOrderResponse, summary="撤回工单")
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


@router.post("/work-orders/{work_order_id}/complete", response_model=WorkOrderResponse, summary="指定结束工单")
async def manually_complete_work_order(
    work_order_id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> WorkOrderResponse:
    """
    指定结束工单

    将工单状态改为已完成，并标记为指定结束。
    指定结束的工单也允许撤回（如果工单没有产生过报工记录）。

    - **work_order_id**: 工单ID
    """
    return await WorkOrderService().manually_complete_work_order(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        completed_by=current_user.id
    )


@router.get("/work-orders/delayed", summary="查询延期工单")
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


@router.get("/work-orders/delay-analysis", summary="延期原因分析")
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
