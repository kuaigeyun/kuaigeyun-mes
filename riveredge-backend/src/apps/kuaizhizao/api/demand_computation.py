"""
统一需求计算管理 API 路由模块

提供统一需求计算相关的API接口。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from apps.kuaizhizao.schemas.demand_computation import (
    DemandComputationCreate,
    DemandComputationUpdate,
    DemandComputationResponse,
)

router = APIRouter(prefix="/demand-computations", tags=["统一需求计算管理"])

computation_service = DemandComputationService()


@router.post("", response_model=DemandComputationResponse, summary="创建需求计算")
async def create_computation(
    computation_data: DemandComputationCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建需求计算
    
    支持创建MRP或LRP类型的需求计算。
    """
    try:
        return await computation_service.create_computation(
            tenant_id=tenant_id,
            computation_data=computation_data,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"创建需求计算失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建需求计算失败")


@router.get("", summary="获取需求计算列表")
async def list_computations(
    demand_id: Optional[int] = Query(None, description="需求ID"),
    computation_type: Optional[str] = Query(None, description="计算类型（MRP/LRP）"),
    computation_status: Optional[str] = Query(None, description="计算状态"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求计算列表
    
    支持按需求ID、计算类型、计算状态筛选。
    """
    try:
        return await computation_service.list_computations(
            tenant_id=tenant_id,
            demand_id=demand_id,
            computation_type=computation_type,
            computation_status=computation_status,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        logger.error(f"获取需求计算列表失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取需求计算列表失败")


@router.get("/{computation_id}", response_model=DemandComputationResponse, summary="获取需求计算详情")
async def get_computation(
    computation_id: int = Path(..., description="计算ID"),
    include_items: bool = Query(True, description="是否包含明细"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求计算详情
    
    可以指定是否包含计算结果明细。
    """
    try:
        return await computation_service.get_computation_by_id(
            tenant_id=tenant_id,
            computation_id=computation_id,
            include_items=include_items
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取需求计算详情失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取需求计算详情失败")


@router.post("/{computation_id}/execute", response_model=DemandComputationResponse, summary="执行需求计算")
async def execute_computation(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    执行需求计算
    
    执行MRP或LRP计算逻辑，生成计算结果。
    """
    try:
        return await computation_service.execute_computation(
            tenant_id=tenant_id,
            computation_id=computation_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"执行需求计算失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="执行需求计算失败")


@router.put("/{computation_id}", response_model=DemandComputationResponse, summary="更新需求计算")
async def update_computation(
    computation_id: int = Path(..., description="计算ID"),
    computation_data: DemandComputationUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新需求计算
    
    可以更新计算状态、汇总结果、错误信息等。
    """
    try:
        return await computation_service.update_computation(
            tenant_id=tenant_id,
            computation_id=computation_id,
            computation_data=computation_data,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"更新需求计算失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新需求计算失败")


@router.post("/{computation_id}/generate-orders", summary="一键生成工单和采购单")
async def generate_orders(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从需求计算结果一键生成工单和采购单
    
    根据计算结果明细中的建议工单数量和采购订单数量，自动生成工单和采购单。
    """
    try:
        result = await computation_service.generate_work_orders_and_purchase_orders(
            tenant_id=tenant_id,
            computation_id=computation_id,
            created_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成工单和采购单失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="生成工单和采购单失败")
