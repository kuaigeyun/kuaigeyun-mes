"""
委外成本核算 API 路由

提供基于物料来源类型的委外成本核算API接口。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from decimal import Decimal

from apps.kuaizhizao.schemas.cost import (
    OutsourceCostCalculationRequest,
    OutsourceCostCalculationResponse,
)
from apps.kuaizhizao.services.outsource_cost_service import OutsourceCostService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/outsource-cost", tags=["Kuaige Zhizao Outsource Cost"])


@router.post("/calculate", response_model=OutsourceCostCalculationResponse, status_code=status.HTTP_200_OK)
async def calculate_outsource_cost(
    data: OutsourceCostCalculationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    核算委外成本
    
    委外成本 = 材料成本（提供给委外供应商的原材料）+ 委外加工费用（委外数量 × 委外单价）
    
    支持两种模式：
    1. 标准成本核算：提供material_id和quantity，根据物料的BOM和配置计算标准成本
    2. 实际成本核算：提供outsource_work_order_id，根据委外工单的实际发料和费用计算实际成本
    
    Args:
        data: 委外成本核算请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        OutsourceCostCalculationResponse: 委外成本核算结果
        
    Raises:
        HTTPException: 当物料或委外工单不存在或数据验证失败时抛出
    """
    try:
        cost_service = OutsourceCostService()
        result = await cost_service.calculate_outsource_cost(
            tenant_id=tenant_id,
            material_id=data.material_id,
            outsource_work_order_id=data.outsource_work_order_id,
            quantity=data.quantity,
            calculation_date=data.calculation_date,
            created_by=current_user.id if current_user else None
        )
        return OutsourceCostCalculationResponse(**result)
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
            detail=f"核算委外成本失败: {str(e)}"
        )
