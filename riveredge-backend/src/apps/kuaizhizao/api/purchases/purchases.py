"""
采购订单API接口

提供采购订单相关的REST API接口。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import date
from typing import List, Optional, Dict, Any
import base64

from fastapi import APIRouter, Depends, Query, Path, Body
from fastapi.responses import JSONResponse, HTMLResponse, Response

from core.api.deps import get_current_user, get_current_tenant
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.models.user import User as CurrentUser
from infra.exceptions.exceptions import ValidationError, NotFoundError

from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListResponse, PurchaseOrderApprove, PurchaseOrderConfirm,
    PurchaseOrderListParams, MaterialPriceHistoryResponse,
    PurchaseTrackingResponse,
    PriceComparisonResponse, LandingCostAllocationRequest, PurchaseOrderChangeResponse,
    PurchaseReceiptPullCandidateListResponse,
)
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.kuaizhizao.services.purchase_inquiry_service import PurchaseInquiryService
from apps.kuaizhizao.services.purchase_cost_service import PurchaseCostService
from apps.kuaizhizao.services.print_service import DocumentPrintService
from apps.kuaizhizao.services.demand_source_chain_service import DemandSourceChainService
from fastapi.responses import HTMLResponse
from fastapi import HTTPException, status as http_status
from loguru import logger


# 注意：路由前缀为空，因为应用路由注册时会自动添加 /apps/kuaizhizao 前缀
router = APIRouter(
    tags=["App - Kuaige Zhizao - Purchase Order Management"],
    dependencies=[Depends(require_kuaizhizao_module_access("purchase-order"))],
)


# === 采购订单CRUD接口 ===
@router.post("/purchase-orders", response_model=PurchaseOrderResponse, summary="Create purchase order")
async def create_purchase_order(
    order: PurchaseOrderCreate,
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    创建采购订单

    - **order**: 采购订单创建数据
    - **current_user**: 当前登录用户
    - **tenant_id**: 当前租户ID

    返回创建的采购订单信息
    """
    return await PurchaseService().create_purchase_order(
        tenant_id=tenant_id,
        order_data=order,
        created_by=current_user.id
    )


@router.get("/purchase-orders", summary="List purchase orders")
async def list_purchase_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=1000, description="返回数量"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    status: Optional[str] = Query(None, description="订单状态"),
    review_status: Optional[str] = Query(None, description="审核状态"),
    order_date_from: Optional[date] = Query(None, description="订单日期从"),
    order_date_to: Optional[date] = Query(None, description="订单日期到"),
    delivery_date_from: Optional[date] = Query(None, description="到货日期从"),
    delivery_date_to: Optional[date] = Query(None, description="到货日期到"),
    created_start_date: Optional[date] = Query(None, description="创建日期起"),
    created_end_date: Optional[date] = Query(None, description="创建日期止"),
    order_code: Optional[str] = Query(None, description="订单编号（模糊）"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    order_by: Optional[str] = Query(None, description="排序字段，如 order_date、-updated_at"),
    pullable_only: Optional[bool] = Query(
        None,
        description="仅可加载建单；需配合 pull_target",
    ),
    pull_target: Optional[str] = Query(
        None,
        description="加载目标：purchase_order_change；与 pullable_only 组合使用",
    ),
    include_items: bool = Query(False, description="是否附带订单明细（明细表格视图）"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    获取采购订单列表

    支持多种筛选条件和分页查询
    """
    from apps.kuaizhizao.services.purchase_service import PURCHASE_ORDER_SORTABLE_FIELDS

    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in PURCHASE_ORDER_SORTABLE_FIELDS:
            safe_order_by = order_by

    params = PurchaseOrderListParams(
        skip=skip,
        limit=limit,
        supplier_id=supplier_id,
        status=status,
        review_status=review_status,
        order_date_from=order_date_from,
        order_date_to=order_date_to,
        delivery_date_from=delivery_date_from,
        delivery_date_to=delivery_date_to,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        order_code=order_code,
        keyword=keyword,
        order_by=safe_order_by,
        pullable_only=pullable_only,
        pull_target=pull_target,
        include_items=include_items,
    )

    return await PurchaseService().list_purchase_orders(tenant_id, params, current_user=current_user)


@router.get("/purchase-orders/statistics", summary="Purchase Orders statistics (KPI cards)")
async def get_purchase_order_statistics(
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder
    from datetime import timedelta

    def _sum(vals):
        return float(sum(v for v in vals if v is not None))

    today = date.today()
    base = PurchaseOrder.filter(tenant_id=tenant_id)
    audited = ("AUDITED", "已审核", "CONFIRMED", "已确认", "audited", "已通过")
    pending_review = ("PENDING", "PENDING_REVIEW", "待审核", "pending_review")
    cancelled = ["DRAFT", "草稿", "draft", "CANCELLED", "已取消", "cancelled"]
    rejected = ["REJECTED", "已驳回", "审核驳回", "驳回", "rejected"]

    try:
        active_count = await base.exclude(status__in=cancelled).exclude(review_status__in=rejected).count()
    except Exception as e:
        logger.warning(f"purchase-statistics active_count: {e}"); active_count = 0

    try:
        pending_review_count = await base.filter(review_status__in=list(pending_review)).count()
    except Exception as e:
        logger.warning(f"purchase-statistics pending_review: {e}"); pending_review_count = 0

    try:
        in_progress_count = await base.filter(status__in=list(audited)).exclude(review_status__in=rejected).count()
    except Exception as e:
        logger.warning(f"purchase-statistics in_progress: {e}"); in_progress_count = 0

    try:
        overdue_count = await base.filter(delivery_date__lt=today, status__in=list(audited)).exclude(review_status__in=rejected).count()
    except Exception as e:
        logger.warning(f"purchase-statistics overdue: {e}"); overdue_count = 0

    try:
        # 年度总额（values_list 替代 aggregate，避免 ORM 兼容问题）
        year_start = date(today.year, 1, 1)
        year_vals = await base.filter(order_date__gte=year_start).exclude(status__in=["CANCELLED","已取消","cancelled"]).values_list("total_amount", flat=True)
        annual_total_amount = _sum(year_vals)

        # 本月到货率：订购行已到货数量 / 订购数量
        month_start = date(today.year, today.month, 1)
        month_order_ids = await base.filter(order_date__gte=month_start).exclude(
            status__in=["CANCELLED", "已取消", "cancelled"]
        ).values_list("id", flat=True)
        month_order_id_list = list(month_order_ids)
        if month_order_id_list:
            from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
            item_rows = await PurchaseOrderItem.filter(
                order_id__in=month_order_id_list,
            ).values_list("ordered_quantity", "received_quantity")
            month_total_qty = sum(float(q or 0) for q, _ in item_rows)
            month_received_qty = sum(float(r or 0) for _, r in item_rows)
            if month_total_qty > 0:
                monthly_arrival_rate = round(min(100.0, month_received_qty / month_total_qty * 100), 1)
            else:
                month_total = len(month_order_id_list)
                month_arrived = await base.filter(
                    id__in=month_order_id_list,
                    status__in=list(audited) + ["received", "partial_received", "completed", "已收货", "部分收货", "已完成"],
                ).count()
                monthly_arrival_rate = round(month_arrived / month_total * 100, 1) if month_total else 0.0
        else:
            monthly_arrival_rate = 0.0

        # 供应商准时率：已审核且要求到货日未逾期 / 已审核总数（当年）
        audited_total = await base.filter(status__in=list(audited), order_date__gte=year_start).count() or 1
        on_time = await base.filter(status__in=list(audited), order_date__gte=year_start, delivery_date__gte=today).count()
        supplier_on_time_rate = round(on_time / audited_total * 100, 1)

        # 近7月趋势
        trend_annual = []
        for i in range(6, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0: m += 12; y -= 1
            ms = date(y, m, 1)
            me = date(y, m+1, 1) - timedelta(days=1) if m < 12 else date(y+1, 1, 1) - timedelta(days=1)
            vals = await base.filter(order_date__gte=ms, order_date__lte=me).exclude(status__in=["CANCELLED","已取消","cancelled"]).values_list("total_amount", flat=True)
            trend_annual.append(_sum(vals))

    except Exception as e:
        logger.warning(f"purchase-statistics amounts: {e}")
        annual_total_amount = 0; monthly_arrival_rate = 0; supplier_on_time_rate = 0
        trend_annual = [0] * 7

    return {
        "active_count": active_count,
        "pending_review_count": pending_review_count,
        "in_progress_count": in_progress_count,
        "overdue_count": overdue_count,
        "total_amount": round(annual_total_amount, 2),
        "annual_total_amount": round(annual_total_amount, 2),
        "monthly_arrival_rate": monthly_arrival_rate,
        "supplier_on_time_rate": supplier_on_time_rate,
        "trends": {
            "arrival_rate": [monthly_arrival_rate] * 7,
            "annual_total": trend_annual,
        },
    }



@router.get(
    "/purchase-orders/receipt-pull-candidates",
    response_model=PurchaseReceiptPullCandidateListResponse,
    summary="List purchase orders for inbound pull modal",
)
async def list_purchase_receipt_pull_candidates(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=200, description="返回数量"),
    keyword: Optional[str] = Query(None, description="按采购订单号/供应商搜索"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """采购入库选单弹窗：返回可筛选的采购订单及入库数量汇总（单次请求，无 N+1）。"""
    return await PurchaseService().list_purchase_receipt_pull_candidates(
        tenant_id,
        keyword=keyword,
        skip=skip,
        limit=limit,
        current_user=current_user,
    )


@router.post("/purchase-orders/pull-from-inquiry", summary="Build purchase order from inquiry")
async def pull_purchase_order_from_inquiry(
    request: Dict[str, Any] = Body(...),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    采购订单域取单建单：从采购询价创建采购订单（统一 pull 语义入口）。
    """
    inquiry_id_raw = request.get("inquiry_id")
    if inquiry_id_raw is None:
        raise ValidationError("必须提供询价单ID")
    try:
        inquiry_id = int(inquiry_id_raw)
    except (TypeError, ValueError):
        raise ValidationError("询价单ID格式无效")

    payload: Dict[str, Any] = {}
    if isinstance(request.get("item_ids"), list):
        payload["item_ids"] = request.get("item_ids")
    if request.get("persist_default_supplier_to_material") is not None:
        payload["persist_default_supplier_to_material"] = bool(request.get("persist_default_supplier_to_material"))

    from apps.kuaizhizao.schemas.purchase_inquiry import ConvertInquiryToPORequest

    return await PurchaseInquiryService().convert_to_purchase_order(
        tenant_id=tenant_id,
        inquiry_id=inquiry_id,
        data=ConvertInquiryToPORequest(**payload),
        created_by=current_user.id,
    )


@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse, summary="Get purchase order")
async def get_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    根据ID获取采购订单详情

    - **order_id**: 采购订单ID
    """
    return await PurchaseService().get_purchase_order_by_id(tenant_id, order_id)


@router.get("/purchase-orders/{order_id}/demand-source-chain", summary="Purchase order demand source chain")
async def get_purchase_order_demand_chain(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    获取采购单的需求来源追溯链路
    
    追溯路径：PurchaseOrder → DemandComputation → Demand → SalesOrder/SalesForecast
    """
    try:
        service = DemandSourceChainService()
        return await service.get_purchase_order_demand_chain(tenant_id, order_id)
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("获取采购单需求来源链路失败")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取需求来源链路失败: {str(e)}",
        )


@router.put("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse, summary="Update purchase order")
async def update_purchase_order(
    order: PurchaseOrderUpdate,
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    更新采购订单信息

    只能更新草稿状态的订单

    - **order_id**: 采购订单ID
    - **order**: 采购订单更新数据
    """
    return await PurchaseService().update_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
        order_data=order,
        updated_by=current_user.id
    )


@router.delete("/purchase-orders/{order_id}", summary="Delete purchase order")
async def delete_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    删除采购订单

    只能删除草稿状态的订单。删除后会在关联的采购申请上留下操作记录。

    - **order_id**: 采购订单ID
    """
    result = await PurchaseService().delete_purchase_order(
        tenant_id=tenant_id, order_id=order_id, operator_id=current_user.id
    )
    return JSONResponse(content={"success": result, "message": "删除成功"})


# === 采购订单业务操作接口 ===
@router.post("/purchase-orders/{order_id}/submit", response_model=PurchaseOrderResponse, summary="Submit purchase order")
async def submit_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    提交采购订单（非审核，仅改变状态为待审核）

    - **order_id**: 采购订单ID
    """
    return await PurchaseService().submit_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
        submitted_by=current_user.id
    )


@router.post("/purchase-orders/{order_id}/approve", response_model=PurchaseOrderResponse, summary="Approve purchase order")
async def approve_purchase_order(
    approve_data: PurchaseOrderApprove,
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    审核采购订单

    - **order_id**: 采购订单ID
    - **approve_data**: 审核数据
    """
    return await PurchaseService().approve_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
        approve_data=approve_data,
        approved_by=current_user.id
    )


@router.post("/purchase-orders/{order_id}/confirm", response_model=PurchaseOrderResponse, summary="Confirm purchase order")
async def confirm_purchase_order(
    confirm_data: PurchaseOrderConfirm,
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    确认采购订单（供应商确认）

    - **order_id**: 采购订单ID
    - **confirm_data**: 确认数据
    """
    return await PurchaseService().confirm_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
        confirm_data=confirm_data,
        confirmed_by=current_user.id
    )


@router.get("/purchase-orders/{order_id}/push-to-receipt-notice/preview", summary="Preview push to receipt notice")
async def preview_push_purchase_order_to_receipt_notice(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseService().preview_push_to_receipt_notice(
        tenant_id=tenant_id,
        order_id=order_id,
    )


@router.get("/purchase-orders/{order_id}/push-to-receipt/preview", summary="Preview push to purchase receipt")
async def preview_push_purchase_order_to_receipt(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseService().preview_push_to_receipt(
        tenant_id=tenant_id,
        order_id=order_id,
    )


@router.get("/purchase-orders/{order_id}/push-to-invoice/preview", summary="Preview push to purchase invoice")
async def preview_push_purchase_order_to_invoice(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseService().preview_push_to_invoice(
        tenant_id=tenant_id,
        order_id=order_id,
    )


@router.get("/purchase-orders/{order_id}/push-to-purchase-return/preview", summary="Preview push to purchase return")
async def preview_push_purchase_order_to_purchase_return(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PurchaseService().preview_push_to_purchase_return(
        tenant_id=tenant_id,
        order_id=order_id,
    )


@router.post("/purchase-orders/{order_id}/push-to-receipt-preview", summary="Preview push to purchase receipt")
async def push_purchase_order_to_receipt_preview(
    order_id: int = Path(..., description="采购订单ID"),
    receipt_quantities: Optional[dict] = Body(None, description="入库数量字典 {item_id: quantity}"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    下推采购入库预览：返回将生成的明细及预生成批号（供下推弹窗展示）
    """
    from fastapi import status
    from fastapi.responses import JSONResponse

    normalized = None
    if receipt_quantities:
        try:
            normalized = {int(k): float(v) for k, v in receipt_quantities.items()}
        except (ValueError, TypeError):
            normalized = receipt_quantities

    service = PurchaseService()
    result = await service.push_to_receipt_preview(
        tenant_id=tenant_id,
        order_id=order_id,
        receipt_quantities=normalized
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.post("/purchase-orders/{order_id}/push-to-receipt", summary="Push to purchase receipt")
async def push_purchase_order_to_receipt(
    order_id: int = Path(..., description="采购订单ID"),
    body: Optional[dict] = Body(None, description="receipt_quantities、可选 batch_numbers 与 warehouse_id"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从采购单下推到采购入库
    
    自动生成采购入库单，支持指定入库数量及预生成批号
    
    body 格式：{ "receipt_quantities": {item_id: quantity}, "batch_numbers": {item_id: batch_number}, "warehouse_id": 1, "line_warehouses": {item_id: warehouse_id}, "line_location_ids": {item_id: location_id}, "line_location_codes": {item_id: code} }
    或直接传 receipt_quantities 字典（向后兼容）
    """
    from fastapi import status
    from fastapi.responses import JSONResponse

    if not body:
        body = {}
    # 兼容：body 直接为 receipt_quantities，或 body.receipt_quantities
    receipt_quantities = body.get("receipt_quantities")
    if receipt_quantities is None and "receipt_quantities" not in body and "batch_numbers" not in body and "warehouse_id" not in body and "line_warehouses" not in body and "line_location_ids" not in body:
        receipt_quantities = body  # 向后兼容：直接传 {item_id: quantity}
    batch_numbers = body.get("batch_numbers")
    warehouse_id_raw = body.get("warehouse_id")
    warehouse_id = None
    if warehouse_id_raw is not None:
        try:
            warehouse_id = int(warehouse_id_raw)
        except (ValueError, TypeError):
            warehouse_id = None

    def _normalize_int_int_map(raw: Any) -> Optional[dict]:
        if not raw or not isinstance(raw, dict):
            return None
        try:
            return {int(k): int(v) for k, v in raw.items()}
        except (ValueError, TypeError):
            return None

    def _normalize_int_str_map(raw: Any) -> Optional[dict]:
        if not raw or not isinstance(raw, dict):
            return None
        try:
            return {int(k): str(v) for k, v in raw.items() if v is not None and str(v).strip()}
        except (ValueError, TypeError):
            return None

    line_warehouses = _normalize_int_int_map(body.get("line_warehouses"))
    line_location_ids = _normalize_int_int_map(body.get("line_location_ids"))
    line_location_codes = _normalize_int_str_map(body.get("line_location_codes"))

    normalized = None
    if receipt_quantities:
        try:
            normalized = {int(k): float(v) for k, v in receipt_quantities.items()}
        except (ValueError, TypeError):
            normalized = receipt_quantities

    batch_normalized = None
    if batch_numbers:
        try:
            batch_normalized = {int(k): str(v) for k, v in batch_numbers.items() if v}
        except (ValueError, TypeError):
            batch_normalized = None

    service = PurchaseService()
    result = await service.push_to_receipt(
        tenant_id=tenant_id,
        order_id=order_id,
        created_by=current_user.id,
        receipt_quantities=normalized,
        batch_numbers=batch_normalized,
        warehouse_id=warehouse_id,
        line_warehouses=line_warehouses,
        line_location_ids=line_location_ids,
        line_location_codes=line_location_codes,
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.post("/purchase-orders/{order_id}/push-to-receipt-notice", summary="Push to receipt notice")
async def push_purchase_order_to_receipt_notice(
    order_id: int = Path(..., description="采购订单ID"),
    body: Optional[dict] = Body(None, description="notice_quantities、selected_item_ids、line_warehouses"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从采购单下推到收货通知
    
    自动生成收货通知单，通知仓库收货（不直接动库存）
    
    body 格式：{ "notice_quantities": {item_id: quantity}, "selected_item_ids": [1,2], "line_warehouses": {item_id: warehouse_id} }
    或直接传 notice_quantities 字典（向后兼容）
    """
    from fastapi import status
    from fastapi.responses import JSONResponse
    from typing import Any

    if not body:
        body = {}
    notice_quantities = body.get("notice_quantities")
    if notice_quantities is None and "selected_item_ids" not in body and "line_warehouses" not in body:
        notice_quantities = body

    def _normalize_int_int_map(raw: Any) -> Optional[dict]:
        if not raw or not isinstance(raw, dict):
            return None
        try:
            return {int(k): int(v) for k, v in raw.items()}
        except (ValueError, TypeError):
            return None

    normalized = None
    if notice_quantities and isinstance(notice_quantities, dict):
        tmp: dict = {}
        for k, v in notice_quantities.items():
            try:
                ik = int(k)
                tmp[ik] = float(v)
            except (ValueError, TypeError):
                continue
        normalized = tmp if tmp else None

    selected_item_ids = None
    raw_ids = body.get("selected_item_ids")
    if isinstance(raw_ids, list):
        try:
            selected_item_ids = [int(v) for v in raw_ids if v is not None]
        except (ValueError, TypeError):
            selected_item_ids = None
        if not selected_item_ids:
            selected_item_ids = None

    line_warehouses = _normalize_int_int_map(body.get("line_warehouses"))

    service = PurchaseService()
    result = await service.push_to_receipt_notice(
        tenant_id=tenant_id,
        order_id=order_id,
        created_by=current_user.id,
        notice_quantities=normalized,
        selected_item_ids=selected_item_ids,
        line_warehouses=line_warehouses,
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.post("/purchase-orders/{order_id}/push-to-invoice", summary="Push to purchase invoice")
async def push_purchase_order_to_invoice(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从采购单下推到采购发票
    
    自动生成采购发票（草稿，发票号码等待补全）
    """
    from fastapi import status
    from fastapi.responses import JSONResponse

    service = PurchaseService()
    result = await service.push_to_invoice(
        tenant_id=tenant_id,
        order_id=order_id,
        created_by=current_user.id,
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.get("/purchase-orders/{order_id}/print", summary="Print purchase order")
async def print_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印采购订单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from fastapi.responses import HTMLResponse, JSONResponse
    from infra.exceptions.exceptions import NotFoundError, ValidationError

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="purchase_order",
            document_id=order_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if (
        (output_format or "html").lower() == "pdf"
        and (response_format or "json").lower() in {"pdf", "binary", "raw"}
        and result.get("mime_type") == "application/pdf"
    ):
        raw = base64.b64decode(result.get("content") or "")
        return Response(
            content=raw,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="purchase-order-{order_id}.pdf"'},
        )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)

@router.get("/material-price-history/{material_id}", response_model=MaterialPriceHistoryResponse, summary="Material historical purchase price")
async def get_material_price_history(
    material_id: int = Path(..., description="物料ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取物料在当前租户下的历史成交价统计"""
    return await PurchaseService().get_material_price_history(tenant_id, material_id)


@router.get("/purchase-orders/{order_id}/tracking", response_model=PurchaseTrackingResponse, summary="Purchase order fulfillment tracking")
async def get_purchase_order_tracking(
    order_id: int = Path(..., description="采购订单ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取采购订单从下达到入库的全链路追踪数据"""
    return await PurchaseService().get_purchase_order_tracking(tenant_id, order_id)


@router.get("/price-comparison", response_model=PriceComparisonResponse, summary="Multi-material price comparison")
async def get_price_comparison(
    material_ids: str = Query(..., description="物料ID列表，逗号分隔"),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取物料的多供应商价格对比（比价助手）"""
    try:
        mids = [int(mid.strip()) for mid in material_ids.split(",") if mid.strip()]
        return await PurchaseService().get_price_comparison(tenant_id, mids)
    except Exception as e:
        raise ValidationError(f"无法获取价格对比: {str(e)}")


@router.post("/purchase-orders/{order_id}/allocate-costs", summary="Allocate landed cost")
async def allocate_purchase_costs(
    order_id: int = Path(..., description="采购订单ID"),
    request: LandingCostAllocationRequest = Body(...),
    tenant_id: int = Depends(get_current_tenant)
):
    """人工输入杂费并分摊到订单明细（V2 增强：支持按金额、数量、重量、体积等维度分摊）"""
    try:
        fee_dicts = [{"name": item.name, "amount": item.amount} for item in request.fee_items]
        items = await PurchaseCostService().allocate_landing_costs(
            tenant_id, order_id, fee_dicts, request.method
        )
        return {"success": True, "items_count": len(items)}
    except Exception as e:
        raise ValidationError(f"分摊失败: {str(e)}")


@router.get("/purchase-orders/{order_id}/changes", response_model=List[PurchaseOrderChangeResponse], summary="Purchase order change history")
async def get_purchase_order_changes(
    order_id: int = Path(..., description="采购订单ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取采购订单的全程变更记录（对应 PurchaseOrderChange 模型）"""
    return await PurchaseService().get_purchase_order_changes(tenant_id, order_id)
