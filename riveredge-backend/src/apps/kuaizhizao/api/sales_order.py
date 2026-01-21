"""
销售订单管理 API 路由模块

提供销售订单相关的API接口。

Author: Luigi Lu
Date: 2026-01-19
"""

from typing import Optional, Dict, Any, List
from datetime import date
from fastapi import APIRouter, Depends, Query, status, Path, HTTPException
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
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"创建销售订单失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建销售订单失败")


@router.get("", response_model=SalesOrderListResponse, summary="获取销售订单列表")
async def list_sales_orders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="订单状态"),
    review_status: Optional[str] = Query(None, description="审核状态"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取销售订单列表
    
    支持按状态、审核状态、日期范围筛选。
    """
    try:
        result = await sales_order_service.list_sales_orders(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            status=status,
            review_status=review_status,
            start_date=start_date,
            end_date=end_date,
        )
        return result
    except Exception as e:
        logger.error(f"获取销售订单列表失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取销售订单列表失败")


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取销售订单详情失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取销售订单详情失败")


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"更新销售订单失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新销售订单失败")


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"提交销售订单失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="提交销售订单失败")


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"审核通过销售订单失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="审核通过销售订单失败")


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"驳回销售订单失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="驳回销售订单失败")


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"下推销售订单到需求计算失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="下推销售订单到需求计算失败")
