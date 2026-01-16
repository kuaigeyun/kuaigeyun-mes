"""
成本优化建议 API 路由

提供基于物料来源类型的成本优化建议API接口。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from decimal import Decimal

from apps.kuaizhizao.schemas.cost import (
    CostOptimizationRequest,
    CostOptimizationResponse,
    CostOptimizationBatchResponse,
)
from apps.kuaizhizao.services.cost_optimization_service import CostOptimizationService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/cost-optimization", tags=["Kuaige Zhizao Cost Optimization"])


@router.post("/suggestions", response_model=CostOptimizationResponse, status_code=status.HTTP_200_OK)
async def generate_optimization_suggestions_single(
    data: CostOptimizationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    生成单个物料的成本优化建议
    
    基于物料来源类型分析成本，提供优化建议：
    - 如果自制件成本高于采购件成本，建议转为采购件
    - 如果采购件成本高于自制件成本，建议转为自制件
    - 如果委外件成本高于自制件成本，建议转为自制件
    - 如果委外件成本高于采购件成本，建议转为采购件
    - 等等
    
    Args:
        data: 成本优化建议请求数据（必须提供material_id）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostOptimizationResponse: 成本优化建议结果
        
    Raises:
        HTTPException: 当物料不存在或数据验证失败时抛出
    """
    if not data.material_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="单个物料分析时必须提供material_id"
        )
    
    try:
        optimization_service = CostOptimizationService()
        result = await optimization_service.generate_optimization_suggestions(
            tenant_id=tenant_id,
            material_id=data.material_id,
            quantity=data.quantity,
            calculation_date=data.calculation_date,
            created_by=current_user.id if current_user else None
        )
        return CostOptimizationResponse(**result)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成成本优化建议失败: {str(e)}"
        )


@router.post("/suggestions/batch", response_model=CostOptimizationBatchResponse, status_code=status.HTTP_200_OK)
async def generate_optimization_suggestions_batch(
    data: CostOptimizationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量生成多个物料的成本优化建议
    
    批量分析多个物料的成本，提供优化建议，并按潜在节约成本排序。
    
    Args:
        data: 成本优化建议请求数据（必须提供material_ids）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostOptimizationBatchResponse: 批量成本优化建议结果
        
    Raises:
        HTTPException: 当数据验证失败时抛出
    """
    if not data.material_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="批量分析时必须提供material_ids"
        )
    
    try:
        optimization_service = CostOptimizationService()
        result = await optimization_service.generate_optimization_suggestions(
            tenant_id=tenant_id,
            material_ids=data.material_ids,
            quantity=data.quantity,
            calculation_date=data.calculation_date,
            created_by=current_user.id if current_user else None
        )
        return CostOptimizationBatchResponse(**result)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量生成成本优化建议失败: {str(e)}"
        )
