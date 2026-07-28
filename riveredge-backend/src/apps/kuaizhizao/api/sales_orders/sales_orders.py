"""
销售订单管理 API 路由模块

提供销售订单相关的API接口。

Author: Luigi Lu
Date: 2026-01-19
"""

from typing import Optional, Dict, Any, List
from datetime import date, datetime, timedelta
import zoneinfo
import uuid
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException, Body, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from loguru import logger
from tortoise.exceptions import FieldError

from core.api.deps import get_current_user, get_current_tenant
from core.api.deps.access import require_permission_codes
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, NotFoundError, BusinessLogicError

from apps.kuaizhizao.services.sales_order_service import SalesOrderService
from apps.kuaizhizao.services.sales_order_ocr_service import SalesOrderOcrService
from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
from apps.kuaizhizao.schemas.document_relation import ChangeImpactResponse
from apps.kuaizhizao.schemas.sales_order import (
    SalesOrderCreate,
    SalesOrderUpdate,
    SalesOrderResponse,
    SalesOrderListResponse,
    SalesOrderItemCreate,
    SalesOrderItemUpdate,
    SalesOrderItemResponse,
    SalesOrderRemindCreate,
    SalesOrderTrackingResponse,
)
from apps.kuaizhizao.schemas.quote import QuoteBreakdownResponse
from apps.kuaizhizao.schemas.sales_order_ocr import SalesOrderOcrParseTextRequest, SalesOrderOcrResult

# 初始化服务实例
sales_order_service = SalesOrderService()
document_relation_service = DocumentRelationNewService()

# 创建路由
router = APIRouter(
    prefix="/sales-orders",
    tags=["App - Kuaige Zhizao - Sales Order Management"],
    dependencies=[Depends(require_kuaizhizao_module_access("sales-order"))],
)


async def _mask_sales_order_payload(
    *,
    tenant_id: int,
    user_id: int,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    return await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaizhizao:sales-order",
        payload=payload,
    )


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
    trace_id: Optional[str] = None,
) -> HTTPException:
    tid = trace_id or uuid.uuid4().hex
    logger.warning(
        "sales_order_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        tid,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": tid},
    )


@router.post("", response_model=SalesOrderResponse, summary="Create sales order")
async def create_sales_order(
    sales_order_data: SalesOrderCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建销售订单
    
    销售订单编码会自动生成：SO-YYYYMMDD-序号
    """
    try:
        result = await sales_order_service.create_sales_order(
            tenant_id=tenant_id,
            sales_order_data=sales_order_data,
            created_by=current_user.id
        )
        return result
    except ValidationError as e:
        raise _http_exception_with_trace(http_status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/sales-orders", tenant_id)
    except Exception as e:
        logger.exception("创建销售订单失败: {}", e)
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "创建销售订单失败", "/sales-orders", tenant_id)


@router.post("/pull-from-quotation", response_model=Dict[str, Any], summary="Build sales order from quotation")
async def pull_sales_order_from_quotation(
    quotation_id: int = Body(..., embed=True, description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """销售订单域加载建单：从报价单创建销售订单（单一直接上游）。"""
    try:
        return await sales_order_service.pull_sales_order_from_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            created_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/pull-from-quotation", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/pull-from-quotation", tenant_id)
    except Exception as e:
        logger.error(f"从报价单加载生成销售订单失败: {e}")
        raise _http_exception_with_trace(
            http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            "从报价单加载生成销售订单失败",
            "/sales-orders/pull-from-quotation",
            tenant_id,
        )


@router.post("/pull-from-sales-contract", response_model=Dict[str, Any], summary="Build sales order from sales contract")
async def pull_sales_order_from_sales_contract(
    body: Dict[str, Any] = Body(..., description="contract_id 必填；selected_item_ids/release_lines 可选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """销售订单域加载建单：从销售合同创建销售订单。"""
    contract_id_raw = body.get("contract_id")
    if contract_id_raw is None:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, "必须提供销售合同ID", "/sales-orders/pull-from-sales-contract", tenant_id)
    try:
        contract_id = int(contract_id_raw)
    except (TypeError, ValueError):
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, "销售合同ID格式无效", "/sales-orders/pull-from-sales-contract", tenant_id)

    selected_item_ids = body.get("selected_item_ids")
    release_lines = body.get("release_lines")
    try:
        return await sales_order_service.pull_sales_order_from_sales_contract(
            tenant_id=tenant_id,
            contract_id=contract_id,
            created_by=current_user.id,
            selected_item_ids=selected_item_ids if isinstance(selected_item_ids, list) else None,
            release_lines=release_lines if isinstance(release_lines, list) else None,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/pull-from-sales-contract", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/pull-from-sales-contract", tenant_id)
    except Exception as e:
        logger.error(f"从销售合同加载生成销售订单失败: {e}")
        raise _http_exception_with_trace(
            http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            "从销售合同加载生成销售订单失败",
            "/sales-orders/pull-from-sales-contract",
            tenant_id,
        )


@router.post(
    "/ocr-parse-text",
    response_model=SalesOrderOcrResult,
    response_model_by_alias=True,
    summary="Parse sales order from natural language text (KU-AI)",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def parse_sales_order_from_text(
    body: SalesOrderOcrParseTextRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """根据自然语言描述或对话补充，结构化销售订单字段。"""
    try:
        return await SalesOrderOcrService.extract_from_text(
            tenant_id=tenant_id,
            text=body.text,
            context=body.context,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/ocr-parse-text", tenant_id)
    except Exception as e:
        logger.exception("sales order OCR parse text failed tenant_id={}", tenant_id)
        raise _http_exception_with_trace(
            http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"对话录单解析失败: {str(e)}",
            "/sales-orders/ocr-parse-text",
            tenant_id,
        )


@router.post(
    "/ocr-extract",
    response_model=SalesOrderOcrResult,
    response_model_by_alias=True,
    summary="OCR extract sales order from image (KU-AI)",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def extract_sales_order_from_image(
    file: UploadFile = File(..., description="销售订单/合同/单据图片"),
    tenant_id: int = Depends(get_current_tenant),
):
    """上传单据图片，通过 KU-AI 视觉模型识别并结构化销售订单字段。"""
    try:
        image_bytes = await file.read()
        return await SalesOrderOcrService.extract_from_image(
            tenant_id=tenant_id,
            image_bytes=image_bytes,
            content_type=file.content_type,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/ocr-extract", tenant_id)
    except Exception as e:
        logger.exception("sales order OCR extract failed tenant_id={}", tenant_id)
        raise _http_exception_with_trace(
            http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"OCR 识别失败: {str(e)}",
            "/sales-orders/ocr-extract",
            tenant_id,
        )


# 销售订单可排序字段白名单（防止注入）
SALES_ORDER_SORTABLE_FIELDS = frozenset({
    "order_code", "customer_name", "order_date", "delivery_date",
    "total_quantity", "total_amount", "status", "review_status",
    "salesman_name", "contract_code",
    "created_at", "updated_at",
})


@router.get("/statistics", summary="Sales order statistics (KPI cards)")
async def get_sales_order_statistics(
    list_scope: Optional[str] = Query(None, description="列表范围：all/mine/department"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    返回销售订单各维度数量，用于列表页指标卡片。
    指标：活动订单、待审核、执行中、逾期未交、总金额。
    """
    from apps.kuaizhizao.models.sales_order import SalesOrder

    from core.utils.timezone_utils import resolve_business_datetime, to_site_date

    today = to_site_date(resolve_business_datetime())
    # 基础过滤：租户隔离 + 未删除
    base = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    base = await sales_order_service._apply_sales_order_list_scope(
        base,
        tenant_id=tenant_id,
        current_user=current_user,
        list_scope=list_scope,
    )
    count = await base.count()
    logger.info(f"get_sales_order_statistics: tenant_id={tenant_id}, total_count={count}")
    audited = ("AUDITED", "已审核", "CONFIRMED", "已确认")
    pending_review = ("PENDING", "PENDING_REVIEW", "待审核")

    try:
        # 1. 活跃订单：排除已取消、已驳回
        active_count = await base.exclude(
            status__in=["CANCELLED", "已取消"],
        ).exclude(
            review_status__in=["REJECTED", "已驳回", "审核驳回", "驳回"],
        ).count()
    except Exception as e:
        logger.warning(f"sales-order-statistics active_count: {e}")
        active_count = 0

    try:
        # 2. 待审核
        pending_review_count = await base.filter(
            review_status__in=list(pending_review),
        ).count()
    except Exception as e:
        logger.warning(f"sales-order-statistics pending_review_count: {e}")
        pending_review_count = 0

    try:
        # 3. 今日新签订单
        today_new_count = await base.filter(
            order_date=today
        ).count()
    except Exception as e:
        logger.warning(f"sales-order-statistics today_new_count: {e}")
        today_new_count = 0

    try:
        # 4. 执行中：已审核/已确认，排除驳回
        in_progress_count = await base.filter(
            status__in=list(audited),
        ).exclude(
            review_status__in=["REJECTED", "已驳回", "审核驳回", "驳回"],
        ).count()
    except Exception as e:
        logger.warning(f"sales-order-statistics in_progress_count: {e}")
        in_progress_count = 0

    try:
        # 5. 未清订单量 (Unfulfilled)：非取消、非完成、非驳回的订单
        unfulfilled_count = await base.exclude(
            status__in=["CANCELLED", "已取消", "COMPLETED", "已完成", "FINISHED"],
        ).exclude(
            review_status__in=["REJECTED", "已驳回", "审核驳回", "驳回"],
        ).count()
    except Exception as e:
        logger.warning(f"sales-order-statistics unfulfilled_count: {e}")
        unfulfilled_count = 0

    try:
        # 6. 逾期未交：交货日期 < 今天，且已审核/已确认（未完成）
        overdue_count = await base.filter(
            delivery_date__lt=today,
            status__in=list(audited),
        ).exclude(
            review_status__in=["REJECTED", "已驳回", "审核驳回", "驳回"],
        ).count()
    except Exception as e:
        logger.warning(f"sales-order-statistics overdue_count: {e}")
        overdue_count = 0

    try:
        from datetime import timedelta

        def _sum(vals):
            """Python 端安全求和，兼容 Decimal / None"""
            return float(sum(v for v in vals if v is not None))

        # 6. 今日新签总额
        today_amounts = await base.filter(
            order_date=today
        ).exclude(
            status__in=["CANCELLED", "已取消"],
        ).values_list("total_amount", flat=True)
        today_new_amount = _sum(today_amounts)

        # 7. 年度总额
        year_start = date(today.year, 1, 1)
        year_amounts = await base.filter(
            order_date__gte=year_start
        ).exclude(
            status__in=["CANCELLED", "已取消"],
        ).exclude(
            review_status__in=["REJECTED", "已驳回", "审核驳回", "驳回"],
        ).values_list("total_amount", flat=True)
        annual_total_amount = _sum(year_amounts)

        # 去年同期累计
        last_year_start = date(today.year - 1, 1, 1)
        last_year_today = today.replace(year=today.year - 1)
        last_year_amounts = await base.filter(
            order_date__gte=last_year_start,
            order_date__lte=last_year_today,
        ).exclude(
            status__in=["CANCELLED", "已取消"],
        ).values_list("total_amount", flat=True)
        last_annual_total = _sum(last_year_amounts)

        annual_total_yoy = round(((annual_total_amount - last_annual_total) / last_annual_total * 100), 1) if last_annual_total > 0 else 0
        avg_delivery_cycle = 5.2

        # 8. 近7天趋势数据（{ date, value }[] 格式，用于折线图指标卡）
        trend_today_new = []
        trend_today_amount = []
        trend_overdue = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            date_str = day.strftime("%Y-%m-%d")
            cnt = await base.filter(order_date=day).count()
            trend_today_new.append({"date": date_str, "value": cnt})
            day_amounts = await base.filter(
                order_date=day
            ).exclude(status__in=["CANCELLED", "已取消"]).values_list("total_amount", flat=True)
            trend_today_amount.append({"date": date_str, "value": round(_sum(day_amounts), 2)})
            # 当日逾期数：交货日<当日 且 当日未完成
            try:
                od_cnt = await base.filter(
                    delivery_date__lt=day,
                    status__in=list(audited),
                ).exclude(
                    review_status__in=["REJECTED", "已驳回", "审核驳回", "驳回"],
                ).exclude(status__in=["COMPLETED", "已完成", "FINISHED"]).count()
            except Exception:
                od_cnt = overdue_count if day == today else 0
            trend_overdue.append({"date": date_str, "value": od_cnt})

        # 年度总额趋势：近7个月每月签约额（{ date, value } 格式）
        trend_annual = []
        for i in range(6, -1, -1):
            target_month = today.month - i
            target_year = today.year
            while target_month <= 0:
                target_month += 12
                target_year -= 1
            month_start = date(target_year, target_month, 1)
            if target_month == 12:
                month_end = date(target_year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(target_year, target_month + 1, 1) - timedelta(days=1)
            month_amounts = await base.filter(
                order_date__gte=month_start,
                order_date__lte=month_end,
            ).exclude(status__in=["CANCELLED", "已取消"]).exclude(
                review_status__in=["REJECTED", "已驳回", "审核驳回", "驳回"],
            ).values_list("total_amount", flat=True)
            trend_annual.append({"date": f"{target_year}-{target_month:02d}", "value": round(_sum(month_amounts), 2)})

    except Exception as e:
        logger.warning(f"sales-order-statistics amount/trends error: {e}")
        today_new_amount = 0
        annual_total_amount = 0
        annual_total_yoy = 0
        avg_delivery_cycle = 0
        _fallback_dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
        trend_today_new = [{"date": d, "value": 0} for d in _fallback_dates]
        trend_today_amount = [{"date": d, "value": 0} for d in _fallback_dates]
        trend_overdue = [{"date": d, "value": 0} for d in _fallback_dates]
        trend_annual = []
        for i in range(6, -1, -1):
            tm = today.month - i
            ty = today.year
            while tm <= 0:
                tm += 12
                ty -= 1
            trend_annual.append({"date": f"{ty}-{tm:02d}", "value": 0})

    trend_unfulfilled = [{"date": x["date"], "value": unfulfilled_count} for x in trend_today_new]
    trend_pending_review = [{"date": x["date"], "value": pending_review_count} for x in trend_today_new]

    # 昨日对比值（用于「较昨日」展示）
    yesterday_today_new = trend_today_new[-2]["value"] if len(trend_today_new) > 1 else 0
    yesterday_today_amount = trend_today_amount[-2]["value"] if len(trend_today_amount) > 1 else 0
    yesterday_overdue = trend_overdue[-2]["value"] if len(trend_overdue) > 1 else 0
    yesterday_unfulfilled = trend_unfulfilled[-2]["value"] if len(trend_unfulfilled) > 1 else 0
    yesterday_pending_review = trend_pending_review[-2]["value"] if len(trend_pending_review) > 1 else 0

    return {
        "active_count": active_count,
        "pending_review_count": pending_review_count,
        "today_new_count": today_new_count,
        "today_new_amount": round(today_new_amount, 2),
        "in_progress_count": in_progress_count,
        "unfulfilled_count": unfulfilled_count,
        "overdue_count": overdue_count,
        "annual_total_amount": round(annual_total_amount, 2),
        "annual_total_yoy": annual_total_yoy,
        "avg_delivery_cycle": avg_delivery_cycle,
        "yesterday_today_new": yesterday_today_new,
        "yesterday_today_amount": yesterday_today_amount,
        "yesterday_overdue": yesterday_overdue,
        "yesterday_unfulfilled": yesterday_unfulfilled,
        "yesterday_pending_review": yesterday_pending_review,
        "trend_today_new": trend_today_new,
        "trend_today_amount": trend_today_amount,
        "trend_overdue": trend_overdue,
        "trend_unfulfilled": trend_unfulfilled,
        "trend_pending_review": trend_pending_review,
        "trend_annual": trend_annual,
        "trends": {
            "today_new": [x["value"] for x in trend_today_new],
            "today_new_amount": [x["value"] for x in trend_today_amount],
            "unfulfilled": [x["value"] for x in trend_unfulfilled],
            "annual_total": [x["value"] for x in trend_annual],
        }
    }



@router.get("", response_model=SalesOrderListResponse, summary="List sales orders")
async def list_sales_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="订单状态"),
    review_status: Optional[str] = Query(None, description="审核状态"),
    lifecycle_stage: Optional[str] = Query(None, description="生命周期阶段（与列表展示一致，如 执行中、已生效）"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    customer_id: Optional[int] = Query(None, description="客户 ID"),
    customer_name: Optional[str] = Query(None, description="客户名称（模糊匹配）"),
    order_code: Optional[str] = Query(None, description="订单编码（模糊匹配）"),
    contract_code: Optional[str] = Query(None, description="关联合同编码（模糊匹配）"),
    salesman_id: Optional[int] = Query(None, description="销售员 ID"),
    keyword: Optional[str] = Query(None, description="关键词搜索（订单编码、客户、销售员、合同编码）"),
    order_by: Optional[str] = Query(None, description="排序字段，如 order_code、-created_at（前缀-表示降序）"),
    include_items: bool = Query(False, description="是否包含订单明细"),
    list_scope: Optional[str] = Query(None, description="列表范围：all/mine/department"),
    pullable_only: Optional[bool] = Query(
        None,
        description="仅可加载建单；需配合 pull_target",
    ),
    pull_target: Optional[str] = Query(
        None,
        description="加载目标：sales_order_change；与 pullable_only 组合使用",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取销售订单列表
    
    支持按状态、审核状态、日期范围筛选，支持多字段排序。
    """
    # 校验 order_by 防止注入
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in SALES_ORDER_SORTABLE_FIELDS:
            safe_order_by = order_by

    try:
        result = await sales_order_service.list_sales_orders(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            status=status,
            review_status=review_status,
            lifecycle_stage=lifecycle_stage,
            start_date=start_date,
            end_date=end_date,
            customer_id=customer_id,
            customer_name=customer_name,
            order_code=order_code,
            contract_code=contract_code,
            salesman_id=salesman_id,
            keyword=keyword,
            order_by=safe_order_by,
            include_items=include_items,
            list_scope=list_scope,
            pullable_only=pullable_only,
            pull_target=pull_target,
            current_user=current_user,
        )
        payloads = [row.model_dump() for row in result.data]
        masked_payloads = await PermissionPolicyService.apply_field_masks_to_list(
            tenant_id=tenant_id,
            user_id=current_user.id,
            resource="kuaizhizao:sales-order",
            payloads=payloads,
        )
        masked_data = [SalesOrderResponse(**masked) for masked in masked_payloads]
        return SalesOrderListResponse(
            data=masked_data,
            total=result.total,
            success=result.success,
        )
    except Exception as e:
        logger.exception(f"获取销售订单列表失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, f"获取销售订单列表失败: {str(e)}", "/sales-orders", tenant_id)


@router.get("/{sales_order_id}/print", summary="Print sales order")
async def print_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印销售订单（与报价单打印入口一致，供详情页 PDF/打印）。"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="sales_order",
            document_id=sales_order_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/print", tenant_id
        )
    except ValidationError as e:
        raise _http_exception_with_trace(
            http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/print", tenant_id
        )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


@router.get("/{sales_order_id}/print-variables", summary="Sales order print variables")
async def get_sales_order_print_variables(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """与 `_format_sales_order_data` 一致。"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    try:
        variables = await DocumentPrintService().get_document_variables_for_print(
            tenant_id, "sales_order", sales_order_id
        )
        return {"success": True, "variables": variables}
    except NotFoundError as e:
        raise _http_exception_with_trace(
            http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/print-variables", tenant_id
        )


@router.get("/{sales_order_id}", response_model=SalesOrderResponse, summary="Get sales order")
async def get_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    include_items: bool = Query(False, description="是否包含订单明细"),
    include_duration: bool = Query(False, description="是否包含耗时统计"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取销售订单详情
    
    - **include_items**: 是否包含订单明细
    - **include_duration**: 是否包含耗时统计信息
    """
    try:
        result = await sales_order_service.get_sales_order_by_id(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            include_items=include_items,
            include_duration=include_duration,
            current_user=current_user,
        )
        masked_payload = await _mask_sales_order_payload(
            tenant_id=tenant_id,
            user_id=current_user.id,
            payload=result.model_dump(),
        )
        return SalesOrderResponse(**masked_payload)
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}", tenant_id)
    except Exception as e:
        logger.error(f"获取销售订单详情失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "获取销售订单详情失败", "/sales-orders/{sales_order_id}", tenant_id)


@router.get("/{sales_order_id}/tracking", response_model=SalesOrderTrackingResponse, summary="Sales order trace view")
async def get_sales_order_tracking(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取销售订单全息追踪视图
    
    返回订单从接单、备料、生产到最终发货的全局进度与明细（赋能销售人员）。
    """
    try:
        result = await sales_order_service.get_sales_order_tracking(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/tracking", tenant_id)
    except Exception as e:
        logger.error(f"获取销售订单追踪视图失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "获取销售订单追踪视图失败", "/sales-orders/{sales_order_id}/tracking", tenant_id)


@router.get("/{sales_order_id}/change-impact", response_model=ChangeImpactResponse, summary="Sales order change impact")
async def get_sales_order_change_impact(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取销售订单变更对下游的影响范围（排程管理增强）
    返回受影响的需求、需求计算、生产计划、工单及建议操作。
    """
    try:
        return await document_relation_service.get_change_impact_sales_order(
            tenant_id=tenant_id,
            order_id=sales_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/change-impact", tenant_id)
    except Exception as e:
        logger.error(f"获取销售订单变更影响失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "获取变更影响失败", "/sales-orders/{sales_order_id}/change-impact", tenant_id)


@router.put("/{sales_order_id}", response_model=SalesOrderResponse, summary="Update sales order")
async def update_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    sales_order_data: SalesOrderUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新销售订单
    
    只能更新草稿状态的销售订单。
    """
    try:
        result = await sales_order_service.update_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            sales_order_data=sales_order_data,
            updated_by=current_user.id,
            current_user=current_user,
        )
        masked_payload = await _mask_sales_order_payload(
            tenant_id=tenant_id,
            user_id=current_user.id,
            payload=result.model_dump(),
        )
        return SalesOrderResponse(**masked_payload)
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(http_status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/sales-orders/{sales_order_id}", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}", tenant_id)
    except Exception as e:
        logger.error(f"更新销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "更新销售订单失败", "/sales-orders/{sales_order_id}", tenant_id)


@router.post("/{sales_order_id}/submit", response_model=SalesOrderResponse, summary="Submit sales order")
async def submit_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    提交销售订单
    
    将销售订单状态从"草稿"改为"已提交"，进入审核流程。
    """
    try:
        result = await sales_order_service.submit_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            submitted_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/submit", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/submit", tenant_id)
    except Exception as e:
        logger.error(f"提交销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "提交销售订单失败", "/sales-orders/{sales_order_id}/submit", tenant_id)


@router.post("/{sales_order_id}/approve", response_model=SalesOrderResponse, summary="Approve sales order")
async def approve_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    审核通过销售订单
    
    将销售订单审核状态改为"已通过"。
    """
    try:
        result = await sales_order_service.approve_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            approved_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/approve", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/approve", tenant_id)
    except Exception as e:
        logger.error(f"审核通过销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "审核通过销售订单失败", "/sales-orders/{sales_order_id}/approve", tenant_id)


@router.post("/{sales_order_id}/unapprove", response_model=SalesOrderResponse, summary="Unapprove sales order")
async def unapprove_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    反审核销售订单
    
    将销售订单状态从"已审核"或"已驳回"恢复为"待审核"状态。
    """
    try:
        result = await sales_order_service.unapprove_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            unapproved_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/unapprove", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/unapprove", tenant_id)
    except Exception as e:
        logger.error(f"反审核销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "反审核销售订单失败", "/sales-orders/{sales_order_id}/unapprove", tenant_id)


@router.post("/{sales_order_id}/reject", response_model=SalesOrderResponse, summary="Reject sales order")
async def reject_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    rejection_reason: str = Query(..., description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    驳回销售订单
    
    将销售订单审核状态改为"已驳回"，并记录驳回原因。
    """
    try:
        result = await sales_order_service.reject_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            approved_by=current_user.id,
            rejection_reason=rejection_reason
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/reject", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/reject", tenant_id)
    except Exception as e:
        logger.error(f"驳回销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "驳回销售订单失败", "/sales-orders/{sales_order_id}/reject", tenant_id)


@router.get("/{sales_order_id}/push-to-computation/preview", response_model=Dict[str, Any], summary="Preview demand computation push")
async def preview_push_sales_order_to_computation(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """下推需求计算预览：返回将执行的操作，不实际下推"""
    try:
        result = await sales_order_service.preview_push_sales_order_to_computation(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-computation/preview", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-computation/preview", tenant_id)


@router.post("/{sales_order_id}/push-to-computation", response_model=Dict[str, Any], summary="Push sales order to demand computation")
async def push_sales_order_to_computation(
    sales_order_id: int = Path(..., description="销售订单ID"),
    payload: Optional[Dict[str, Any]] = Body(
        None,
        description="可选：selected_item_ids=[1,2]，selected_quantities={\"1\": 100}",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    下推销售订单到需求计算
    
    将已审核的销售订单下推到物料需求运算，生成需求计算任务。
    """
    selected_item_ids = None
    selected_quantities = None
    if isinstance(payload, dict):
        raw_ids = payload.get("selected_item_ids")
        if isinstance(raw_ids, list):
            selected_item_ids = raw_ids
        raw_qty = payload.get("selected_quantities")
        if isinstance(raw_qty, dict):
            selected_quantities = {}
            for k, v in raw_qty.items():
                try:
                    selected_quantities[int(k)] = float(v)
                except (TypeError, ValueError):
                    continue
    try:
        result = await sales_order_service.push_sales_order_to_computation(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
            selected_item_ids=selected_item_ids,
            selected_quantities=selected_quantities,
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-computation", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-computation", tenant_id)
    except Exception as e:
        logger.error(f"下推销售订单到需求计算失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "下推销售订单到需求计算失败", "/sales-orders/{sales_order_id}/push-to-computation", tenant_id)


@router.get("/{sales_order_id}/push-to-work-order/preview", response_model=Dict[str, Any], summary="Direct push to work order preview")
async def preview_push_sales_order_to_work_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """直推工单预览：返回将生成的工单列表，不实际创建"""
    try:
        result = await sales_order_service.preview_push_sales_order_to_work_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-work-order/preview", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-work-order/preview", tenant_id)


@router.post("/{sales_order_id}/push-to-work-order", response_model=Dict[str, Any], summary="Direct push sales order to work order")
async def push_sales_order_to_work_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    body: Optional[Dict[str, Any]] = Body(
        default=None,
        description="可选：push_mode=draft|confirm，work_order_granularity=grouped|per_unit，selected_item_ids=[1,2]，selected_quantities={\"1\": 2}，selected_work_centers={\"1\": 3}",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    直推销售订单到工单（跳过需求计算）
    
    订单明细直接转为工单，不要求BOM，原材料由用户自行计算采购。
    """
    try:
        payload = body or {}
        selected_item_ids = payload.get("selected_item_ids")
        if not isinstance(selected_item_ids, list):
            selected_item_ids = None
        selected_quantities_raw = payload.get("selected_quantities")
        selected_quantities = None
        if isinstance(selected_quantities_raw, dict):
            selected_quantities = {}
            for k, v in selected_quantities_raw.items():
                try:
                    selected_quantities[int(k)] = float(v)
                except Exception:
                    continue
        selected_work_centers_raw = payload.get("selected_work_centers")
        selected_work_centers = None
        if isinstance(selected_work_centers_raw, dict):
            selected_work_centers = {}
            for k, v in selected_work_centers_raw.items():
                try:
                    item_id = int(k)
                    center_id = int(v)
                    if center_id > 0:
                        selected_work_centers[item_id] = center_id
                except Exception:
                    continue
        result = await sales_order_service.push_sales_order_to_work_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
            selected_item_ids=selected_item_ids,
            selected_quantities=selected_quantities,
            selected_work_centers=selected_work_centers,
            work_order_granularity=payload.get("work_order_granularity"),
            push_mode=payload.get("push_mode"),
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-work-order", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-work-order", tenant_id)
    except Exception as e:
        logger.error(f"直推工单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "直推工单失败", "/sales-orders/{sales_order_id}/push-to-work-order", tenant_id)


@router.post("/{sales_order_id}/remind", response_model=Dict[str, Any], summary="Send sales order reminder")
async def create_sales_order_reminder(
    sales_order_id: int = Path(..., description="销售订单ID"),
    data: SalesOrderRemindCreate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    发送销售订单提醒
    
    选择提醒对象、提醒操作，填写备注后发送站内信给指定用户。
    """
    try:
        result = await sales_order_service.create_sales_order_reminder(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            recipient_user_uuid=data.recipient_user_uuid,
            action_type=data.action_type,
            remarks=data.remarks,
            created_by=current_user.id,
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/remind", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/remind", tenant_id)
    except Exception as e:
        logger.error(f"发送提醒失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "发送提醒失败", "/sales-orders/{sales_order_id}/remind", tenant_id)


@router.post("/{sales_order_id}/withdraw-from-computation", response_model=SalesOrderResponse, summary="Withdraw sales order from demand computation")
async def withdraw_sales_order_from_computation(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    撤回销售订单的需求计算

    将已下推到需求计算的销售订单撤回，清除计算记录及关联。
    若下游单据（工单/采购单/生产计划/采购申请）未执行，允许撤回并级联删除；已执行则不允许撤回。
    """
    try:
        result = await sales_order_service.withdraw_sales_order_from_computation(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/withdraw-from-computation", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/withdraw-from-computation", tenant_id)
    except Exception as e:
        logger.error(f"撤回销售订单需求计算失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "撤回销售订单需求计算失败", "/sales-orders/{sales_order_id}/withdraw-from-computation", tenant_id)


@router.post("/{sales_order_id}/confirm", response_model=SalesOrderResponse, summary="Confirm sales order")
async def confirm_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    确认销售订单（转为执行模式）
    """
    try:
        result = await sales_order_service.confirm_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            confirmed_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/confirm", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/confirm", tenant_id)
    except Exception as e:
        logger.error(f"确认销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "确认销售订单失败", "/sales-orders/{sales_order_id}/confirm", tenant_id)


@router.get("/{sales_order_id}/push-to-shipment-notice/preview", response_model=Dict[str, Any], summary="Push to shipment notice preview")
async def preview_push_sales_order_to_shipment_notice(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到发货通知单预览
    """
    try:
        result = await sales_order_service.preview_push_sales_order_to_shipment_notice(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-shipment-notice/preview", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-shipment-notice/preview", tenant_id)
    except Exception as e:
        logger.error(f"下推发货通知单预览失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "下推发货通知单预览失败", "/sales-orders/{sales_order_id}/push-to-shipment-notice/preview", tenant_id)


@router.post("/{sales_order_id}/push-to-shipment-notice", response_model=Dict[str, Any], summary="Push to shipment notice")
async def push_sales_order_to_shipment_notice(
    sales_order_id: int = Path(..., description="销售订单ID"),
    body: Optional[Dict[str, Any]] = Body(
        default=None,
        description="可选：selected_item_ids=[1,2]，selected_quantities={\"1\": 2}，line_warehouses={\"1\": 3}",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到发货通知单
    """
    try:
        payload = body or {}
        selected_item_ids = payload.get("selected_item_ids")
        if not isinstance(selected_item_ids, list):
            selected_item_ids = None
        selected_quantities_raw = payload.get("selected_quantities")
        selected_quantities = None
        if isinstance(selected_quantities_raw, dict):
            selected_quantities = {}
            for k, v in selected_quantities_raw.items():
                try:
                    selected_quantities[int(k)] = float(v)
                except Exception:
                    continue
        warehouse_id_raw = payload.get("warehouse_id")
        warehouse_id = None
        if warehouse_id_raw is not None:
            try:
                warehouse_id = int(warehouse_id_raw)
            except (TypeError, ValueError):
                warehouse_id = None
        warehouse_name = payload.get("warehouse_name")
        if warehouse_name is not None:
            warehouse_name = str(warehouse_name).strip() or None
        line_warehouses_raw = payload.get("line_warehouses")
        line_warehouses = None
        if isinstance(line_warehouses_raw, dict):
            line_warehouses = {}
            for k, v in line_warehouses_raw.items():
                try:
                    line_warehouses[int(k)] = int(v)
                except (TypeError, ValueError):
                    continue
            if not line_warehouses:
                line_warehouses = None
        result = await sales_order_service.push_sales_order_to_shipment_notice(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
            selected_item_ids=selected_item_ids,
            selected_quantities=selected_quantities,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            line_warehouses=line_warehouses,
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-shipment-notice", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-shipment-notice", tenant_id)
    except Exception as e:
        logger.error(f"下推发货通知单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "下推发货通知单失败", "/sales-orders/{sales_order_id}/push-to-shipment-notice", tenant_id)


@router.get("/{sales_order_id}/push-to-invoice/preview", response_model=Dict[str, Any], summary="Push to sales invoice preview")
async def preview_push_sales_order_to_invoice(
    sales_order_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await sales_order_service.preview_push_sales_order_to_invoice(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-invoice/preview", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-invoice/preview", tenant_id)


@router.get(
    "/{sales_order_id}/backfill-sales-contract/preview",
    response_model=Dict[str, Any],
    summary="Preview backfill sales contract from sales order",
)
async def preview_backfill_sales_contract_from_sales_order(
    sales_order_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    from apps.kuaizhizao.services.sales_contract_service import SalesContractService

    try:
        return await SalesContractService().preview_backfill_contract_from_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(
            http_status.HTTP_404_NOT_FOUND,
            str(e),
            "/sales-orders/{sales_order_id}/backfill-sales-contract/preview",
            tenant_id,
        )
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(
            http_status.HTTP_400_BAD_REQUEST,
            str(e),
            "/sales-orders/{sales_order_id}/backfill-sales-contract/preview",
            tenant_id,
        )
    except FieldError as e:
        raise _http_exception_with_trace(
            http_status.HTTP_400_BAD_REQUEST,
            str(e),
            "/sales-orders/{sales_order_id}/backfill-sales-contract/preview",
            tenant_id,
        )


@router.get("/{sales_order_id}/push-to-delivery/preview", response_model=Dict[str, Any], summary="Push to sales delivery preview")
async def preview_push_sales_order_to_delivery(
    sales_order_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await sales_order_service.preview_push_sales_order_to_delivery(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-delivery/preview", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-delivery/preview", tenant_id)


@router.get("/{sales_order_id}/push-to-sales-return/preview", response_model=Dict[str, Any], summary="Push to sales return preview")
async def preview_push_sales_order_to_sales_return(
    sales_order_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await sales_order_service.preview_push_sales_order_to_sales_return(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-sales-return/preview", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-sales-return/preview", tenant_id)


@router.post("/{sales_order_id}/push-to-invoice", response_model=Dict[str, Any], summary="Push to sales invoice")
async def push_sales_order_to_invoice(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到销售发票（销项发票）
    """
    try:
        result = await sales_order_service.push_sales_order_to_invoice(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-invoice", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-invoice", tenant_id)
    except Exception as e:
        tid = uuid.uuid4().hex
        logger.exception(
            "下推销售发票失败 trace_id={} sales_order_id={} tenant_id={}: {}",
            tid,
            sales_order_id,
            tenant_id,
            e,
        )
        raise _http_exception_with_trace(
            http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"下推销售发票失败：{e}",
            "/sales-orders/{sales_order_id}/push-to-invoice",
            tenant_id,
            trace_id=tid,
        )


@router.post("/{sales_order_id}/push-to-delivery", summary="Push to sales delivery")
async def push_sales_order_to_delivery(
    sales_order_id: int = Path(..., description="销售订单ID"),
    body: Optional[Dict[str, Any]] = Body(
        default=None,
        description="可选：delivery_quantities={\"1\": 2}，line_warehouses={\"1\": 3}，warehouse_id=1",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到销售出库
    """
    try:
        payload = body or {}
        delivery_quantities_raw = payload.get("delivery_quantities", payload)
        delivery_quantities = None
        if isinstance(delivery_quantities_raw, dict):
            delivery_quantities = {}
            for k, v in delivery_quantities_raw.items():
                if k in ("line_warehouses", "warehouse_id", "warehouse_name"):
                    continue
                try:
                    delivery_quantities[int(k)] = float(v)
                except (TypeError, ValueError):
                    continue
            if not delivery_quantities:
                delivery_quantities = None
        warehouse_id_raw = payload.get("warehouse_id")
        warehouse_id = None
        if warehouse_id_raw is not None:
            try:
                warehouse_id = int(warehouse_id_raw)
            except (TypeError, ValueError):
                warehouse_id = None
        warehouse_name = payload.get("warehouse_name")
        if warehouse_name is not None:
            warehouse_name = str(warehouse_name).strip() or None
        line_warehouses_raw = payload.get("line_warehouses")
        line_warehouses = None
        if isinstance(line_warehouses_raw, dict):
            line_warehouses = {}
            for k, v in line_warehouses_raw.items():
                try:
                    line_warehouses[int(k)] = int(v)
                except (TypeError, ValueError):
                    continue
            if not line_warehouses:
                line_warehouses = None
        result = await sales_order_service.push_sales_order_to_delivery(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
            delivery_quantities=delivery_quantities,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            line_warehouses=line_warehouses,
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-delivery", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-delivery", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-delivery", tenant_id)
    except Exception as e:
        logger.error(f"下推销售出库失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, f"下推销售出库失败：{e}", "/sales-orders/{sales_order_id}/push-to-delivery", tenant_id)


@router.post("/{sales_order_id}/push-to-sales-return", response_model=Dict[str, Any], summary="Push to sales return")
async def push_sales_order_to_sales_return(
    sales_order_id: int = Path(..., description="销售订单ID"),
    body: Optional[Dict[str, Any]] = Body(
        default=None,
        description="必填：warehouse_id；可选：warehouse_name、return_quantities={\"item_id\": qty}、batch_numbers={\"item_id\": batch}、return_code",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """从销售订单下推到销售退货单。"""
    payload = body or {}
    warehouse_id_raw = payload.get("warehouse_id")
    if warehouse_id_raw is None:
        raise _http_exception_with_trace(
            http_status.HTTP_400_BAD_REQUEST,
            "必须提供退货仓库ID",
            "/sales-orders/{sales_order_id}/push-to-sales-return",
            tenant_id,
        )
    try:
        warehouse_id = int(warehouse_id_raw)
    except (TypeError, ValueError):
        raise _http_exception_with_trace(
            http_status.HTTP_400_BAD_REQUEST,
            "退货仓库ID格式无效",
            "/sales-orders/{sales_order_id}/push-to-sales-return",
            tenant_id,
        )

    return_quantities_raw = payload.get("return_quantities")
    return_quantities = None
    if isinstance(return_quantities_raw, dict):
        return_quantities = {}
        for k, v in return_quantities_raw.items():
            try:
                return_quantities[int(k)] = float(v)
            except Exception:
                continue

    batch_numbers_raw = payload.get("batch_numbers")
    batch_numbers = None
    if isinstance(batch_numbers_raw, dict):
        batch_numbers = {}
        for k, v in batch_numbers_raw.items():
            try:
                batch_text = str(v or "").strip()
                if batch_text:
                    batch_numbers[int(k)] = batch_text
            except Exception:
                continue

    try:
        return await sales_order_service.push_sales_order_to_sales_return(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
            warehouse_id=warehouse_id,
            warehouse_name=payload.get("warehouse_name"),
            return_quantities=return_quantities,
            batch_numbers=batch_numbers,
            return_code=payload.get("return_code"),
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/push-to-sales-return", tenant_id)
    except (BusinessLogicError, ValidationError) as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/push-to-sales-return", tenant_id)
    except Exception as e:
        logger.error(f"下推销售退货单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "下推销售退货单失败", "/sales-orders/{sales_order_id}/push-to-sales-return", tenant_id)



@router.post("/{sales_order_id}/withdraw", response_model=SalesOrderResponse, summary="Withdraw submitted sales order")
async def withdraw_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    撤回已提交的销售订单
    
    只有“待审核”状态的订单可以撤回，撤回后恢复为“草稿”状态。
    """
    try:
        result = await sales_order_service.withdraw_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            withdrawn_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}/withdraw", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}/withdraw", tenant_id)
    except Exception as e:
        logger.error(f"撤回销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "撤回销售订单失败", "/sales-orders/{sales_order_id}/withdraw", tenant_id)


@router.delete("/{sales_order_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="Delete sales order")
async def delete_sales_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除销售订单
    
    只有“草稿”状态的订单可以删除。
    """
    try:
        await sales_order_service.delete_sales_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            current_user=current_user,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/{sales_order_id}", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(http_status.HTTP_400_BAD_REQUEST, str(e), "/sales-orders/{sales_order_id}", tenant_id)
    except Exception as e:
        logger.error(f"删除销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "删除销售订单失败", "/sales-orders/{sales_order_id}", tenant_id)

@router.post("/batch-submit", response_model=Dict[str, Any], summary="Batch submit sales orders")
async def bulk_submit_sales_orders(
    ids: List[int] = Body(..., description="订单ID列表"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """批量提交销售订单 (草稿 -> 待审核)"""
    try:
        return await sales_order_service.bulk_submit_sales_orders(
            tenant_id=tenant_id,
            sales_order_ids=ids,
            submitted_by=current_user.id
        )
    except Exception as e:
        logger.error(f"批量提交失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "批量提交失败", "/sales-orders/batch-submit", tenant_id)


@router.post("/batch-approve", response_model=Dict[str, Any], summary="Batch approve sales orders")
async def bulk_approve_sales_orders(
    ids: List[int] = Body(..., description="订单ID列表"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """批量审核通过销售订单 (待审核 -> 已审核)"""
    try:
        return await sales_order_service.bulk_approve_sales_orders(
            tenant_id=tenant_id,
            sales_order_ids=ids,
            approved_by=current_user.id
        )
    except Exception as e:
        logger.error(f"批量审核失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "批量审核失败", "/sales-orders/batch-approve", tenant_id)


@router.post("/batch-withdraw", response_model=Dict[str, Any], summary="Batch withdraw sales orders")
async def bulk_withdraw_sales_orders(
    ids: List[int] = Body(..., description="订单ID列表"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """批量撤回销售订单 (已提交 → 草稿：待审核或免审已生效)"""
    try:
        return await sales_order_service.bulk_withdraw_sales_orders(
            tenant_id=tenant_id,
            sales_order_ids=ids,
            withdrawn_by=current_user.id
        )
    except Exception as e:
        logger.error(f"批量撤回失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "批量撤回失败", "/sales-orders/batch-withdraw", tenant_id)


@router.post("/batch-unapprove", response_model=Dict[str, Any], summary="Batch unapprove sales orders")
async def bulk_unapprove_sales_orders(
    ids: List[int] = Body(..., description="订单ID列表"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """批量反审核销售订单 (已审核 -> 待审核)"""
    try:
        return await sales_order_service.bulk_unapprove_sales_orders(
            tenant_id=tenant_id,
            sales_order_ids=ids,
            unapproved_by=current_user.id
        )
    except Exception as e:
        logger.error(f"批量反审核失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "批量反审核失败", "/sales-orders/batch-unapprove", tenant_id)


@router.post("/batch-close", response_model=Dict[str, Any], summary="Batch close sales orders")
async def bulk_close_sales_orders(
    ids: List[int] = Body(..., description="订单ID列表"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """批量关闭销售订单：终止剩余未执行部分，已履约数据保留。"""
    try:
        return await sales_order_service.bulk_close_sales_orders(
            tenant_id=tenant_id,
            sales_order_ids=ids,
            closed_by=current_user.id,
        )
    except Exception as e:
        logger.error(f"批量关闭失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "批量关闭失败", "/sales-orders/batch-close", tenant_id)


@router.post("/batch-delete", response_model=Dict[str, Any], summary="Batch delete sales orders")
async def bulk_delete_sales_orders(
    ids: List[int] = Body(..., description="要删除的销售订单ID列表"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量删除销售订单
    
    只有“草稿”状态的订单可以删除。
    返回成功删除的数量和失败的详情。
    """
    try:
        result = await sales_order_service.bulk_delete_sales_orders(
            tenant_id=tenant_id,
            sales_order_ids=ids
        )
        return result
    except Exception as e:
        logger.error(f"批量删除销售订单失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "批量删除销售订单失败", "/sales-orders/batch-delete", tenant_id)


@router.get("/quote-breakdown/{material_id}", response_model=QuoteBreakdownResponse, summary="Product quote breakdown (agile pricing)")
async def get_quote_breakdown(
    material_id: int = Path(..., description="产品 ID"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据产品 ID 获取其 BOM 层级的预估成本及工艺费，辅助销售核价。
    """
    try:
        result = await sales_order_service.get_quote_breakdown(
            tenant_id=tenant_id,
            material_id=material_id
        )
        return result
    except NotFoundError as e:
        raise _http_exception_with_trace(http_status.HTTP_404_NOT_FOUND, str(e), "/sales-orders/quote-breakdown/{material_id}", tenant_id)
    except Exception as e:
        logger.error(f"获取核价明细失败: {e}")
        raise _http_exception_with_trace(http_status.HTTP_500_INTERNAL_SERVER_ERROR, "获取核价明细失败", "/sales-orders/quote-breakdown/{material_id}", tenant_id)

