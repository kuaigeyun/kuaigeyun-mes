"""
采购订单API接口

提供采购订单相关的REST API接口。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import date
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, Query, Path, Body
from fastapi.responses import JSONResponse

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User as CurrentUser
from infra.exceptions.exceptions import ValidationError, NotFoundError

from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListResponse, PurchaseOrderApprove, PurchaseOrderConfirm,
    PurchaseOrderListParams, MaterialPriceHistoryResponse,
    PurchaseTrackingResponse, SupplierPerformanceResponse,
    ExpediteRequest, ExpediteResponse, PriceComparisonResponse,
    LandingCostAllocationRequest, PurchaseOrderChangeResponse
)
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.kuaizhizao.services.purchase_cost_service import PurchaseCostService
from apps.kuaizhizao.services.print_service import DocumentPrintService
from apps.kuaizhizao.services.demand_source_chain_service import DemandSourceChainService
from fastapi.responses import HTMLResponse
from fastapi import HTTPException, status as http_status
from loguru import logger


# 注意：路由前缀为空，因为应用路由注册时会自动添加 /apps/kuaizhizao 前缀
router = APIRouter(tags=["采购订单管理"])


# === 采购订单CRUD接口 ===
@router.post("/purchase-orders", response_model=PurchaseOrderResponse, summary="创建采购订单")
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


@router.get("/purchase-orders", summary="获取采购订单列表")
async def list_purchase_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
    supplier_id: Optional[int] = Query(None, description="供应商ID"),
    status: Optional[str] = Query(None, description="订单状态"),
    review_status: Optional[str] = Query(None, description="审核状态"),
    order_date_from: Optional[date] = Query(None, description="订单日期从"),
    order_date_to: Optional[date] = Query(None, description="订单日期到"),
    delivery_date_from: Optional[date] = Query(None, description="到货日期从"),
    delivery_date_to: Optional[date] = Query(None, description="到货日期到"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    获取采购订单列表

    支持多种筛选条件和分页查询
    """
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
        keyword=keyword
    )

    return await PurchaseService().list_purchase_orders(tenant_id, params, current_user=current_user)


@router.get("/purchase-orders/statistics", summary="获取采购订单统计（用于指标卡片）")
async def get_purchase_order_statistics(
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder
    from datetime import timedelta

    def _sum(vals):
        return float(sum(v for v in vals if v is not None))

    today = date.today()
    base = PurchaseOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
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

        # 本月到货率（简化：本月已审核/活跃订单 / 全部活跃订单，mock 合理值）
        month_start = date(today.year, today.month, 1)
        month_total = await base.filter(order_date__gte=month_start).count() or 1
        month_arrived = await base.filter(order_date__gte=month_start, status__in=list(audited)).count()
        monthly_arrival_rate = round(month_arrived / month_total * 100, 1)

        # 供应商准时率（已审核且未逾期 / 已审核总数）
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



@router.get("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse, summary="获取采购订单详情")
async def get_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    根据ID获取采购订单详情

    - **order_id**: 采购订单ID
    """
    return await PurchaseService().get_purchase_order_by_id(tenant_id, order_id)


@router.get("/purchase-orders/{order_id}/demand-source-chain", summary="获取采购单需求来源链路")
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


@router.put("/purchase-orders/{order_id}", response_model=PurchaseOrderResponse, summary="更新采购订单")
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


@router.delete("/purchase-orders/{order_id}", summary="删除采购订单")
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
@router.post("/purchase-orders/{order_id}/submit", response_model=PurchaseOrderResponse, summary="提交采购订单")
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


@router.post("/purchase-orders/{order_id}/approve", response_model=PurchaseOrderResponse, summary="审核采购订单")
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


@router.post("/purchase-orders/{order_id}/confirm", response_model=PurchaseOrderResponse, summary="确认采购订单")
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


@router.post("/purchase-orders/{order_id}/push-to-receipt-preview", summary="下推采购入库预览")
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


@router.post("/purchase-orders/{order_id}/push-to-receipt", summary="下推到采购入库")
async def push_purchase_order_to_receipt(
    order_id: int = Path(..., description="采购订单ID"),
    body: Optional[dict] = Body(None, description="receipt_quantities 和可选的 batch_numbers"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从采购单下推到采购入库
    
    自动生成采购入库单，支持指定入库数量及预生成批号
    
    body 格式：{ "receipt_quantities": {item_id: quantity}, "batch_numbers": {item_id: batch_number} }
    或直接传 receipt_quantities 字典（向后兼容）
    """
    from fastapi import status
    from fastapi.responses import JSONResponse

    if not body:
        body = {}
    # 兼容：body 直接为 receipt_quantities，或 body.receipt_quantities
    receipt_quantities = body.get("receipt_quantities")
    if receipt_quantities is None and "receipt_quantities" not in body and "batch_numbers" not in body:
        receipt_quantities = body  # 向后兼容：直接传 {item_id: quantity}
    batch_numbers = body.get("batch_numbers")

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
        batch_numbers=batch_normalized
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.post("/purchase-orders/{order_id}/push-to-receipt-notice", summary="下推到收货通知")
async def push_purchase_order_to_receipt_notice(
    order_id: int = Path(..., description="采购订单ID"),
    notice_quantities: Optional[dict] = Body(None, description="通知数量字典 {item_id: quantity}"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从采购单下推到收货通知
    
    自动生成收货通知单，通知仓库收货（不直接动库存）
    """
    from fastapi import status
    from fastapi.responses import JSONResponse

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

    service = PurchaseService()
    result = await service.push_to_receipt_notice(
        tenant_id=tenant_id,
        order_id=order_id,
        created_by=current_user.id,
        notice_quantities=normalized
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.post("/purchase-orders/{order_id}/push-to-invoice", summary="下推到采购发票")
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


@router.get("/purchase-orders/{order_id}/print", summary="打印采购订单")
async def print_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    output_format: str = Query("html", description="输出格式"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印采购订单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from fastapi.responses import HTMLResponse
    
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="purchase_order",
        document_id=order_id,
        template_code=template_code,
        output_format=output_format
    )
    
    if output_format == "pdf":
        # TODO: 实现PDF生成
        return HTMLResponse(content=result["content"], status_code=200)
    else:
        return HTMLResponse(content=result["content"], status_code=200)

@router.get("/material-price-history/{material_id}", response_model=MaterialPriceHistoryResponse, summary="获取物料历史成交价")
async def get_material_price_history(
    material_id: int = Path(..., description="物料ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取物料在当前租户下的历史成交价统计"""
    return await PurchaseService().get_material_price_history(tenant_id, material_id)


@router.get("/purchase-orders/{order_id}/tracking", response_model=PurchaseTrackingResponse, summary="获取采购订单履约追踪")
async def get_purchase_order_tracking(
    order_id: int = Path(..., description="采购订单ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取采购订单从下达到入库的全链路追踪数据"""
    return await PurchaseService().get_purchase_order_tracking(tenant_id, order_id)


@router.get("/suppliers/{supplier_id}/performance", response_model=SupplierPerformanceResponse, summary="获取供应商表现指标")
async def get_supplier_performance(
    supplier_id: int = Path(..., description="供应商ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取供应商近半年的 OTIF、合格率等表现数据"""
    return await PurchaseService().get_supplier_performance_metrics(tenant_id, supplier_id)


@router.post("/purchase-orders/{order_id}/expedite", response_model=ExpediteResponse, summary="一键催单")
async def expedite_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    request: ExpediteRequest = Body(None),
    tenant_id: int = Depends(get_current_tenant)
):
    """记录催单日志并模拟发出催单通知"""
    return await PurchaseService().expedite_purchase_order(tenant_id, order_id, request.remarks if request else None)
@router.get("/price-comparison", response_model=PriceComparisonResponse, summary="多物料价格对比")
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


@router.post("/purchase-orders/{order_id}/allocate-costs", summary="分摊采购落地成本")
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


@router.get("/purchase-orders/{order_id}/changes", response_model=List[PurchaseOrderChangeResponse], summary="获取采购订单变更历史")
async def get_purchase_order_changes(
    order_id: int = Path(..., description="采购订单ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """获取采购订单的全程变更记录（对应 PurchaseOrderChange 模型）"""
    return await PurchaseService().get_purchase_order_changes(tenant_id, order_id)
