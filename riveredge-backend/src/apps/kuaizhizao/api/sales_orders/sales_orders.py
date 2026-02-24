"""
销售订单管理 API 路由模块

提供销售订单相关的API接口。

Author: Luigi Lu
Date: 2026-01-19
"""

from typing import Optional, Dict, Any, List
from datetime import date
from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException, Body
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, NotFoundError, BusinessLogicError

from apps.kuaizhizao.services.sales_order_service import SalesOrderService
from apps.kuaizhizao.schemas.sales_order import (
    SalesOrderCreate,
    SalesOrderUpdate,
    SalesOrderResponse,
    SalesOrderListResponse,
    SalesOrderItemCreate,
    SalesOrderItemUpdate,
    SalesOrderItemResponse,
    SalesOrderRemindCreate,
)

# 初始化服务实例
sales_order_service = SalesOrderService()

# 创建路由
router = APIRouter(prefix="/sales-orders", tags=["Kuaige Zhizao - Sales Order Management"])


@router.post("", response_model=SalesOrderResponse, summary="创建销售订单")
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
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"创建销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建销售订单失败")


# 销售订单可排序字段白名单（防止注入）
SALES_ORDER_SORTABLE_FIELDS = frozenset({
    "order_code", "customer_name", "order_date", "delivery_date",
    "total_quantity", "total_amount", "status", "review_status",
    "created_at", "updated_at",
})


@router.get("", response_model=SalesOrderListResponse, summary="获取销售订单列表")
async def list_sales_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="订单状态"),
    review_status: Optional[str] = Query(None, description="审核状态"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    order_by: Optional[str] = Query(None, description="排序字段，如 order_code、-created_at（前缀-表示降序）"),
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
            start_date=start_date,
            end_date=end_date,
            order_by=safe_order_by,
        )
        return result
    except Exception as e:
        logger.error(f"获取销售订单列表失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取销售订单列表失败")


@router.get("/{sales_order_id}", response_model=SalesOrderResponse, summary="获取销售订单详情")
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
            include_duration=include_duration
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取销售订单详情失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取销售订单详情失败")


@router.put("/{sales_order_id}", response_model=SalesOrderResponse, summary="更新销售订单")
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
            updated_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"更新销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新销售订单失败")


@router.post("/{sales_order_id}/submit", response_model=SalesOrderResponse, summary="提交销售订单")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"提交销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="提交销售订单失败")


@router.post("/{sales_order_id}/approve", response_model=SalesOrderResponse, summary="审核通过销售订单")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"审核通过销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="审核通过销售订单失败")


@router.post("/{sales_order_id}/unapprove", response_model=SalesOrderResponse, summary="反审核销售订单")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"反审核销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="反审核销售订单失败")


@router.post("/{sales_order_id}/reject", response_model=SalesOrderResponse, summary="驳回销售订单")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"驳回销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="驳回销售订单失败")


@router.get("/{sales_order_id}/push-to-computation/preview", response_model=Dict[str, Any], summary="下推需求计算预览")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{sales_order_id}/push-to-computation", response_model=Dict[str, Any], summary="下推销售订单到需求计算")
async def push_sales_order_to_computation(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    下推销售订单到需求计算
    
    将已审核的销售订单下推到物料需求运算，生成需求计算任务。
    """
    try:
        result = await sales_order_service.push_sales_order_to_computation(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"下推销售订单到需求计算失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="下推销售订单到需求计算失败")


@router.get("/{sales_order_id}/push-to-production-plan/preview", response_model=Dict[str, Any], summary="直推生产计划预览")
async def preview_push_sales_order_to_production_plan(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """直推生产计划预览：返回将生成的生产计划明细，不实际创建"""
    try:
        result = await sales_order_service.preview_push_sales_order_to_production_plan(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{sales_order_id}/push-to-production-plan", response_model=Dict[str, Any], summary="直推销售订单到生产计划")
async def push_sales_order_to_production_plan(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    直推销售订单到生产计划（跳过需求计算）
    
    订单明细直接转为生产计划明细，不要求BOM，原材料由用户自行计算采购。
    """
    try:
        result = await sales_order_service.push_sales_order_to_production_plan(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"直推生产计划失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="直推生产计划失败")


@router.get("/{sales_order_id}/push-to-work-order/preview", response_model=Dict[str, Any], summary="直推工单预览")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{sales_order_id}/push-to-work-order", response_model=Dict[str, Any], summary="直推销售订单到工单")
async def push_sales_order_to_work_order(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    直推销售订单到工单（跳过需求计算）
    
    订单明细直接转为工单，不要求BOM，原材料由用户自行计算采购。
    """
    try:
        result = await sales_order_service.push_sales_order_to_work_order(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"直推工单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="直推工单失败")


@router.post("/{sales_order_id}/remind", response_model=Dict[str, Any], summary="发送销售订单提醒")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"发送提醒失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="发送提醒失败")


@router.post("/{sales_order_id}/withdraw-from-computation", response_model=SalesOrderResponse, summary="撤回销售订单的需求计算")
async def withdraw_sales_order_from_computation(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    撤回销售订单的需求计算

    将已下推到需求计算的销售订单撤回，清除计算记录及关联。
    仅当需求计算尚未下推工单/采购单等下游单据时允许撤回。
    """
    try:
        result = await sales_order_service.withdraw_sales_order_from_computation(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"撤回销售订单需求计算失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="撤回销售订单需求计算失败")


@router.post("/{sales_order_id}/confirm", response_model=SalesOrderResponse, summary="确认销售订单")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"确认销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="确认销售订单失败")


@router.post("/{sales_order_id}/push-to-shipment-notice", response_model=Dict[str, Any], summary="下推到发货通知单")
async def push_sales_order_to_shipment_notice(
    sales_order_id: int = Path(..., description="销售订单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到发货通知单
    """
    try:
        result = await sales_order_service.push_sales_order_to_shipment_notice(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"下推发货通知单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="下推发货通知单失败")


@router.post("/{sales_order_id}/push-to-invoice", response_model=Dict[str, Any], summary="下推到销售发票")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except (BusinessLogicError, ValidationError) as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"下推销售发票失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="下推销售发票失败")


@router.post("/{sales_order_id}/push-to-delivery", summary="下推到销售出库")
async def push_sales_order_to_delivery(
    sales_order_id: int = Path(..., description="销售订单ID"),
    delivery_quantities: Optional[Dict[int, float]] = Body(None, description="出库数量字典 {item_id: quantity}"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从销售订单下推到销售出库
    """
    try:
        result = await sales_order_service.push_sales_order_to_delivery(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            created_by=current_user.id,
            delivery_quantities=delivery_quantities
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"下推销售出库失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="下推销售出库失败")



@router.post("/{sales_order_id}/withdraw", response_model=SalesOrderResponse, summary="撤回已提交的销售订单")
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
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"撤回销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="撤回销售订单失败")


@router.delete("/{sales_order_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="删除销售订单")
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
            sales_order_id=sales_order_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"删除销售订单失败: {e}")
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除销售订单失败")


@router.post("/batch-delete", response_model=Dict[str, Any], summary="批量删除销售订单")
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
        raise HTTPException(status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR, detail="批量删除销售订单失败")
