"""
采购成本核算 API 路由

提供基于物料来源类型的采购成本核算API接口。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import date
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from decimal import Decimal
from loguru import logger

from apps.kuaizhizao.schemas.cost import (
    PurchaseCostCalculationRequest,
    PurchaseCostCalculationResponse,
)
from apps.kuaizhizao.services.purchase_cost_service import PurchaseCostService
from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(
    prefix="/purchase-cost",
    tags=["App - Kuaicaiwu - Purchase Cost"],
    dependencies=[Depends(require_kuaicaiwu_module_access("cost"))],
)


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_purchase_cost_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.post("/calculate", response_model=PurchaseCostCalculationResponse, status_code=status.HTTP_200_OK)
async def calculate_purchase_cost(
    data: PurchaseCostCalculationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    核算采购成本
    
    采购成本 = 采购价格 + 采购费用（税费、运输费等）
    
    支持三种模式：
    1. 标准成本核算：提供material_id和quantity，根据物料的默认价格和配置计算标准成本
    2. 实际成本核算（单个明细）：提供purchase_order_item_id，根据采购订单明细的实际价格和费用计算实际成本
    3. 实际成本核算（整单）：提供purchase_order_id，根据采购订单的所有明细计算实际成本
    
    Args:
        data: 采购成本核算请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PurchaseCostCalculationResponse: 采购成本核算结果
        
    Raises:
        HTTPException: 当物料或采购订单不存在或数据验证失败时抛出
    """
    try:
        cost_service = PurchaseCostService()
        result = await cost_service.calculate_purchase_cost(
            tenant_id=tenant_id,
            material_id=data.material_id,
            purchase_order_id=data.purchase_order_id,
            purchase_order_item_id=data.purchase_order_item_id,
            quantity=data.quantity,
            calculation_date=data.calculation_date,
            created_by=current_user.id if current_user else None
        )
        return PurchaseCostCalculationResponse(**result)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/purchase-cost/calculate", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/purchase-cost/calculate", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(status.HTTP_400_BAD_REQUEST, str(e), "/purchase-cost/calculate", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"核算采购成本失败: {str(e)}",
            "/purchase-cost/calculate",
            tenant_id,
        )
