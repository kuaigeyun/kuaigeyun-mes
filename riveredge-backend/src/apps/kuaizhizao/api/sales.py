"""
销售订单API接口

提供销售订单相关的REST API接口。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import date
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, Query, Path, status
from fastapi.responses import JSONResponse, FileResponse

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User as CurrentUser
from infra.exceptions.exceptions import ValidationError, NotFoundError

from apps.kuaizhizao.schemas.sales import (
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderListResponse,
    SalesOrderItemCreate, SalesOrderItemResponse
)
from apps.kuaizhizao.services.sales_service import SalesOrderService


# 注意：路由前缀为空，因为应用路由注册时会自动添加 /apps/kuaizhizao 前缀
router = APIRouter(tags=["销售订单管理"])


# === 销售订单CRUD接口 ===
@router.post("/sales-orders", response_model=SalesOrderResponse, summary="创建销售订单")
async def create_sales_order(
    order: SalesOrderCreate,
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    创建销售订单

    - **order**: 销售订单创建数据
    - **current_user**: 当前登录用户
    - **tenant_id**: 当前租户ID

    返回创建的销售订单信息
    """
    return await SalesOrderService().create_sales_order(
        tenant_id=tenant_id,
        order_data=order,
        created_by=current_user.id
    )


@router.get("/sales-orders", summary="获取销售订单列表")
async def list_sales_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="返回数量"),
    customer_id: Optional[int] = Query(None, description="客户ID"),
    status: Optional[str] = Query(None, description="订单状态"),
    order_type: Optional[str] = Query(None, description="订单类型"),
    delivery_date_start: Optional[date] = Query(None, description="交货日期从"),
    delivery_date_end: Optional[date] = Query(None, description="交货日期到"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    获取销售订单列表

    支持多种筛选条件和分页查询
    注意：返回数组格式，与基础数据管理APP保持一致
    """
    filters = {}
    if status:
        filters['status'] = status
    if customer_id:
        filters['customer_id'] = customer_id
    if order_type:
        filters['order_type'] = order_type
    if delivery_date_start:
        filters['delivery_date_start'] = delivery_date_start
    if delivery_date_end:
        filters['delivery_date_end'] = delivery_date_end

    return await SalesOrderService().list_sales_orders(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        **filters
    )


@router.get("/sales-orders/{order_id}", response_model=SalesOrderResponse, summary="获取销售订单详情")
async def get_sales_order(
    order_id: int = Path(..., description="销售订单ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    根据ID获取销售订单详情

    - **order_id**: 销售订单ID
    """
    order = await SalesOrderService().get_sales_order_by_id(tenant_id, order_id)
    
    # 获取订单明细
    from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
    items = await SalesOrderItem.filter(
        tenant_id=tenant_id,
        sales_order_id=order_id
    ).all()
    
    # 将明细添加到订单响应中
    order_dict = order.model_dump() if hasattr(order, 'model_dump') else dict(order)
    order_dict['items'] = [
        {
            'id': item.id,
            'material_id': item.material_id,
            'material_code': item.material_code,
            'material_name': item.material_name,
            'material_spec': item.material_spec,
            'material_unit': item.material_unit,
            'ordered_quantity': item.order_quantity,
            'delivered_quantity': item.delivered_quantity,
            'unit_price': item.unit_price,
            'total_price': item.total_amount,
            'delivery_date': item.delivery_date,
            'notes': item.notes,
        }
        for item in items
    ]
    
    return order_dict


@router.put("/sales-orders/{order_id}", response_model=SalesOrderResponse, summary="更新销售订单")
async def update_sales_order(
    order: SalesOrderUpdate,
    order_id: int = Path(..., description="销售订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    更新销售订单信息

    只能更新草稿状态的订单

    - **order_id**: 销售订单ID
    - **order**: 销售订单更新数据
    """
    return await SalesOrderService().update_sales_order(
        tenant_id=tenant_id,
        order_id=order_id,
        order_data=order,
        updated_by=current_user.id
    )


@router.delete("/sales-orders/{order_id}", summary="删除销售订单")
async def delete_sales_order(
    order_id: int = Path(..., description="销售订单ID"),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    删除销售订单

    只能删除草稿状态的订单

    - **order_id**: 销售订单ID
    """
    # TODO: 实现删除逻辑
    return JSONResponse(content={"success": True, "message": "删除成功"})


# === 销售订单业务操作接口 ===
@router.post("/sales-orders/{order_id}/submit", response_model=SalesOrderResponse, summary="提交销售订单")
async def submit_sales_order(
    order_id: int = Path(..., description="销售订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    提交销售订单（非审核，仅改变状态为待审核）

    - **order_id**: 销售订单ID
    """
    return await SalesOrderService().submit_order(
        tenant_id=tenant_id,
        order_id=order_id,
        submitted_by=current_user.id
    )


@router.post("/sales-orders/{order_id}/confirm", response_model=SalesOrderResponse, summary="确认销售订单")
async def confirm_sales_order(
    order_id: int = Path(..., description="销售订单ID"),
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    确认销售订单（转为MTO模式执行）

    - **order_id**: 销售订单ID
    """
    return await SalesOrderService().confirm_order(
        tenant_id=tenant_id,
        order_id=order_id,
        confirmed_by=current_user.id
    )


@router.post("/sales-orders/{order_id}/push-to-delivery", summary="下推到销售出库")
async def push_sales_order_to_delivery(
    order_id: int = Path(..., description="销售订单ID"),
    delivery_quantities: Optional[Dict[int, float]] = None,
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到销售出库
    
    自动生成销售出库单，支持指定出库数量
    
    - **order_id**: 销售订单ID
    - **delivery_quantities**: 出库数量字典 {item_id: quantity}（可选，如果不提供则使用订单未出库数量）
    """
    result = await SalesOrderService().push_to_delivery(
        tenant_id=tenant_id,
        order_id=order_id,
        created_by=current_user.id,
        delivery_quantities=delivery_quantities
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.post("/sales-orders/import", summary="批量导入销售订单")
async def import_sales_orders(
    data: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    批量导入销售订单
    
    接收前端 uni_import 组件传递的二维数组数据
    
    - **data**: 包含二维数组数据的字典，格式为 {"data": [[...], [...]]}
    """
    if 'data' not in data or not isinstance(data['data'], list):
        raise ValidationError("导入数据格式错误：需要包含 'data' 字段，且为二维数组")
    
    result = await SalesOrderService().import_from_data(
        tenant_id=tenant_id,
        data=data['data'],
        created_by=current_user.id
    )
    return JSONResponse(content=result, status_code=status.HTTP_200_OK)


@router.get("/sales-orders/export", summary="批量导出销售订单")
async def export_sales_orders(
    status: Optional[str] = Query(None, description="订单状态"),
    customer_id: Optional[int] = Query(None, description="客户ID"),
    order_type: Optional[str] = Query(None, description="订单类型"),
    delivery_date_start: Optional[date] = Query(None, description="交货日期从"),
    delivery_date_end: Optional[date] = Query(None, description="交货日期到"),
    tenant_id: int = Depends(get_current_tenant)
):
    """
    批量导出销售订单到CSV文件
    
    支持多种筛选条件
    """
    filters = {}
    if status:
        filters['status'] = status
    if customer_id:
        filters['customer_id'] = customer_id
    if order_type:
        filters['order_type'] = order_type
    if delivery_date_start:
        filters['delivery_date_start'] = delivery_date_start
    if delivery_date_end:
        filters['delivery_date_end'] = delivery_date_end
    
    file_path = await SalesOrderService().export_to_excel(
        tenant_id=tenant_id,
        **filters
    )
    
    return FileResponse(
        path=file_path,
        filename=f"sales_orders_{date.today().strftime('%Y%m%d')}.csv",
        media_type="text/csv"
    )

