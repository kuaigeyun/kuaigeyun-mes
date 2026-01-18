"""
采购订单API接口

提供采购订单相关的REST API接口。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Path
from fastapi.responses import JSONResponse

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User as CurrentUser
from infra.exceptions.exceptions import ValidationError, NotFoundError

from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListResponse, PurchaseOrderApprove, PurchaseOrderConfirm,
    PurchaseOrderListParams
)
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.kuaizhizao.services.print_service import DocumentPrintService
from fastapi.responses import HTMLResponse


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

    return await PurchaseService().list_purchase_orders(tenant_id, params)


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
    tenant_id: int = Depends(get_current_tenant)
):
    """
    删除采购订单

    只能删除草稿状态的订单

    - **order_id**: 采购订单ID
    """
    result = await PurchaseService().delete_purchase_order(tenant_id, order_id)
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


@router.post("/purchase-orders/{order_id}/push-to-receipt", summary="下推到采购入库")
async def push_purchase_order_to_receipt(
    order_id: int = Path(..., description="采购订单ID"),
    receipt_quantities: Optional[dict] = None,
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从采购单下推到采购入库
    
    自动生成采购入库单，支持指定入库数量
    
    - **order_id**: 采购订单ID
    - **receipt_quantities**: 入库数量字典 {item_id: quantity}（可选，如果不提供则使用订单未入库数量）
    """
    from fastapi import status
    from fastapi.responses import JSONResponse
    
    service = PurchaseService()
    result = await service.push_to_receipt(
        tenant_id=tenant_id,
        order_id=order_id,
        created_by=current_user.id,
        receipt_quantities=receipt_quantities
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.get("/purchase-orders/{order_id}/approval-status", summary="获取采购订单审批流程状态（采购审批流程增强）")
async def get_purchase_order_approval_status(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取采购订单审批流程状态
    
    如果启动了审批流程，返回审批流程状态；否则返回空状态。
    """
    from apps.kuaizhizao.services.approval_flow_service import ApprovalFlowService
    
    approval_service = ApprovalFlowService()
    status = await approval_service.get_approval_status(
        tenant_id=tenant_id,
        entity_type="purchase_order",
        entity_id=order_id
    )
    
    return JSONResponse(content=status)


@router.get("/purchase-orders/{order_id}/approval-records", summary="获取采购订单审批记录（采购审批流程增强）")
async def get_purchase_order_approval_records(
    order_id: int = Path(..., description="采购订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取采购订单审批记录列表
    
    返回所有审批历史记录。
    """
    from apps.kuaizhizao.services.approval_flow_service import ApprovalFlowService
    
    approval_service = ApprovalFlowService()
    records = await approval_service.get_approval_records(
        tenant_id=tenant_id,
        entity_type="purchase_order",
        entity_id=order_id
    )
    
    return JSONResponse(content={"data": records, "total": len(records)})


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

