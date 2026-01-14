"""
统一需求管理 API 路由模块

提供统一需求管理相关的API接口，支持销售预测和销售订单两种需求类型。

根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, status, Path, HTTPException
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError, NotFoundError, BusinessLogicError

from apps.kuaizhizao.services.demand_service import DemandService
from apps.kuaizhizao.schemas.demand import (
    DemandCreate,
    DemandUpdate,
    DemandResponse,
    DemandListResponse,
    DemandItemCreate,
    DemandItemUpdate,
    DemandItemResponse,
)
from typing import List

# 初始化服务实例
demand_service = DemandService()

# 创建路由
router = APIRouter(prefix="/demands", tags=["Kuaige Zhizao - Demand Management"])


@router.post("", response_model=DemandResponse, summary="创建需求")
async def create_demand(
    demand_data: DemandCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建统一需求
    
    支持创建销售预测（sales_forecast）和销售订单（sales_order）两种类型。
    需求编码会自动生成：
    - 销售预测：SF-YYYYMMDD-序号
    - 销售订单：SO-YYYYMMDD-序号
    """
    try:
        result = await demand_service.create_demand(
            tenant_id=tenant_id,
            demand_data=demand_data,
            created_by=current_user.id
        )
        return result
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"创建需求失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建需求失败")


@router.get("", summary="获取需求列表")
async def list_demands(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    demand_type: Optional[str] = Query(None, description="需求类型（sales_forecast 或 sales_order）"),
    status: Optional[str] = Query(None, description="需求状态"),
    business_mode: Optional[str] = Query(None, description="业务模式（MTS 或 MTO）"),
    review_status: Optional[str] = Query(None, description="审核状态"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求列表
    
    支持按需求类型、状态、业务模式、审核状态等条件筛选。
    """
    try:
        filters = {}
        if demand_type:
            filters['demand_type'] = demand_type
        if status:
            filters['status'] = status
        if business_mode:
            filters['business_mode'] = business_mode
        if review_status:
            filters['review_status'] = review_status
        
        result = await demand_service.list_demands(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            **filters
        )
        return result
    except Exception as e:
        logger.error(f"获取需求列表失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取需求列表失败")


@router.get("/{demand_id}", response_model=DemandResponse, summary="获取需求详情")
async def get_demand(
    demand_id: int = Path(..., description="需求ID"),
    include_items: bool = Query(False, description="是否包含明细"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求详情
    
    可以指定是否包含需求明细。
    """
    try:
        result = await demand_service.get_demand_by_id(
            tenant_id=tenant_id,
            demand_id=demand_id,
            include_items=include_items
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取需求详情失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取需求详情失败")


@router.put("/{demand_id}", response_model=DemandResponse, summary="更新需求")
async def update_demand(
    demand_id: int = Path(..., description="需求ID"),
    demand_data: DemandUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新需求
    
    只能更新草稿状态的需求。
    """
    try:
        result = await demand_service.update_demand(
            tenant_id=tenant_id,
            demand_id=demand_id,
            demand_data=demand_data,
            updated_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"更新需求失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新需求失败")


@router.post("/{demand_id}/submit", response_model=DemandResponse, summary="提交需求")
async def submit_demand(
    demand_id: int = Path(..., description="需求ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    提交需求（提交审核）
    
    只能提交草稿状态的需求，提交后状态变为待审核。
    """
    try:
        result = await demand_service.submit_demand(
            tenant_id=tenant_id,
            demand_id=demand_id,
            submitted_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"提交需求失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="提交需求失败")


@router.post("/{demand_id}/approve", response_model=DemandResponse, summary="审核通过需求")
async def approve_demand(
    demand_id: int = Path(..., description="需求ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    审核通过需求
    
    只能审核待审核状态的需求。
    """
    try:
        result = await demand_service.approve_demand(
            tenant_id=tenant_id,
            demand_id=demand_id,
            approved_by=current_user.id,
            rejection_reason=None
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"审核需求失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="审核需求失败")


@router.post("/{demand_id}/reject", response_model=DemandResponse, summary="驳回需求")
async def reject_demand(
    demand_id: int = Path(..., description="需求ID"),
    rejection_reason: str = Query(..., description="驳回原因"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    驳回需求
    
    只能审核待审核状态的需求。
    """
    try:
        result = await demand_service.approve_demand(
            tenant_id=tenant_id,
            demand_id=demand_id,
            approved_by=current_user.id,
            rejection_reason=rejection_reason
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"驳回需求失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="驳回需求失败")


# ==================== 需求明细管理 ====================

@router.post("/{demand_id}/items", response_model=DemandItemResponse, summary="添加需求明细")
async def add_demand_item(
    demand_id: int = Path(..., description="需求ID"),
    item_data: DemandItemCreate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    添加需求明细
    
    根据需求类型自动处理明细字段：
    - 销售预测：需要填写预测日期或预测月份
    - 销售订单：需要填写交货日期，自动计算金额和剩余数量
    """
    try:
        result = await demand_service.add_demand_item(
            tenant_id=tenant_id,
            demand_id=demand_id,
            item_data=item_data
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"添加需求明细失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="添加需求明细失败")


@router.put("/{demand_id}/items/{item_id}", response_model=DemandItemResponse, summary="更新需求明细")
async def update_demand_item(
    demand_id: int = Path(..., description="需求ID"),
    item_id: int = Path(..., description="明细ID"),
    item_data: DemandItemUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新需求明细
    
    根据需求类型自动处理明细字段。
    """
    try:
        result = await demand_service.update_demand_item(
            tenant_id=tenant_id,
            demand_id=demand_id,
            item_id=item_id,
            item_data=item_data
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"更新需求明细失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新需求明细失败")


@router.delete("/{demand_id}/items/{item_id}", summary="删除需求明细")
async def delete_demand_item(
    demand_id: int = Path(..., description="需求ID"),
    item_id: int = Path(..., description="明细ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除需求明细
    
    删除后会自动更新需求的总数量和总金额。
    """
    try:
        await demand_service.delete_demand_item(
            tenant_id=tenant_id,
            demand_id=demand_id,
            item_id=item_id
        )
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"删除需求明细失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除需求明细失败")
