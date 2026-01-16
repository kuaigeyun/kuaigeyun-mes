"""
生产成本核算 API 路由

提供基于物料来源类型的生产成本核算API接口。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from decimal import Decimal

from apps.kuaizhizao.schemas.cost import (
    ProductionCostCalculationRequest,
    ProductionCostCalculationResponse,
)
from apps.kuaizhizao.services.production_cost_service import ProductionCostService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/production-cost", tags=["Kuaige Zhizao Production Cost"])


@router.post("/calculate", response_model=ProductionCostCalculationResponse, status_code=status.HTTP_200_OK)
async def calculate_production_cost(
    data: ProductionCostCalculationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    核算生产成本
    
    根据物料来源类型计算生产成本：
    - 自制件（Make）：材料成本（BOM展开）+ 加工成本（工序成本）+ 制造费用
    - 虚拟件（Phantom）：不单独核算，成本直接计入上层物料
    - 配置件（Configure）：根据选择的变体BOM，按变体计算成本
    
    Args:
        data: 生产成本核算请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ProductionCostCalculationResponse: 生产成本核算结果
        
    Raises:
        HTTPException: 当物料不存在或数据验证失败时抛出
    """
    try:
        cost_service = ProductionCostService()
        result = await cost_service.calculate_production_cost(
            tenant_id=tenant_id,
            material_id=data.material_id,
            quantity=data.quantity,
            variant_attributes=data.variant_attributes,
            calculation_date=data.calculation_date,
            created_by=current_user.id if current_user else None
        )
        return ProductionCostCalculationResponse(**result)
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
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"核算生产成本失败: {str(e)}"
        )
