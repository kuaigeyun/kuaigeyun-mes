"""
成本对比 API 路由

提供标准成本和实际成本对比API接口，基于物料来源类型进行成本对比分析。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import date
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from decimal import Decimal
from loguru import logger

from apps.kuaizhizao.schemas.cost import (
    CostComparisonRequest,
    CostComparisonResponse,
    CostComparisonBySourceTypeRequest,
    CostComparisonBySourceTypeResponse,
)
from apps.kuaizhizao.services.cost_comparison_service import CostComparisonService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/cost-comparison", tags=["Kuaicaiwu Cost Comparison"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_cost_comparison_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("/compare", response_model=CostComparisonResponse, status_code=status.HTTP_200_OK)
async def compare_standard_vs_actual_cost(
    data: CostComparisonRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    对比标准成本和实际成本
    
    根据物料来源类型进行成本对比：
    - 自制件（Make）：对比标准生产成本 vs 实际工单成本
    - 采购件（Buy）：对比标准采购成本 vs 实际采购订单成本
    - 委外件（Outsource）：对比标准委外成本 vs 实际委外工单成本
    - 虚拟件（Phantom）：不单独对比，成本计入上层物料
    - 配置件（Configure）：根据属性BOM对比标准成本和实际成本
    
    Args:
        data: 成本对比请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostComparisonResponse: 成本对比结果
        
    Raises:
        HTTPException: 当物料或订单不存在或数据验证失败时抛出
    """
    try:
        comparison_service = CostComparisonService()
        result = await comparison_service.compare_standard_vs_actual_cost(
            tenant_id=tenant_id,
            material_id=data.material_id,
            work_order_id=data.work_order_id,
            purchase_order_id=data.purchase_order_id,
            purchase_order_item_id=data.purchase_order_item_id,
            outsource_work_order_id=data.outsource_work_order_id,
            quantity=data.quantity,
            calculation_date=data.calculation_date,
            created_by=current_user.id if current_user else None
        )
        return CostComparisonResponse(**result)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost-comparison/compare", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/cost-comparison/compare", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(status.HTTP_400_BAD_REQUEST, str(e), "/cost-comparison/compare", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"成本对比失败: {str(e)}",
            "/cost-comparison/compare",
            tenant_id,
        )


@router.post("/compare-by-source-type", response_model=CostComparisonBySourceTypeResponse, status_code=status.HTTP_200_OK)
async def compare_costs_by_source_type(
    data: CostComparisonBySourceTypeRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    按物料来源类型对比成本
    
    批量对比多个物料的标准成本和实际成本，按物料来源类型分组统计。
    
    Args:
        data: 按物料来源类型对比成本请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostComparisonBySourceTypeResponse: 按物料来源类型分组的成本对比结果
        
    Raises:
        HTTPException: 当数据验证失败时抛出
    """
    try:
        comparison_service = CostComparisonService()
        result = await comparison_service.compare_costs_by_source_type(
            tenant_id=tenant_id,
            material_ids=data.material_ids,
            calculation_date=data.calculation_date,
            created_by=current_user.id if current_user else None
        )
        return CostComparisonBySourceTypeResponse(**result)
    except ValidationError as e:
        raise _http_exception_with_trace(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            str(e),
            "/cost-comparison/compare-by-source-type",
            tenant_id,
        )
    except Exception as e:
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"按物料来源类型对比成本失败: {str(e)}",
            "/cost-comparison/compare-by-source-type",
            tenant_id,
        )
