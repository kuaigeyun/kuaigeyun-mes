"""
质量成本核算 API 路由

提供质量成本核算API接口。

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
    QualityCostCalculationRequest,
    QualityCostCalculationResponse,
)
from apps.kuaizhizao.services.quality_cost_service import QualityCostService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/quality-cost", tags=["App · Kuaicaiwu · Quality Cost"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_quality_cost_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("/calculate", response_model=QualityCostCalculationResponse, status_code=status.HTTP_200_OK)
async def calculate_quality_cost(
    data: QualityCostCalculationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    核算质量成本
    
    质量成本 = 预防成本 + 鉴定成本 + 内部损失成本 + 外部损失成本
    
    支持按时间范围、物料、工单等维度进行质量成本核算。
    
    Args:
        data: 质量成本核算请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        QualityCostCalculationResponse: 质量成本核算结果
        
    Raises:
        HTTPException: 当数据验证失败时抛出
    """
    try:
        cost_service = QualityCostService()
        result = await cost_service.calculate_quality_cost(
            tenant_id=tenant_id,
            start_date=data.start_date,
            end_date=data.end_date,
            material_id=data.material_id,
            work_order_id=data.work_order_id,
            calculation_date=data.calculation_date,
            created_by=current_user.id if current_user else None
        )
        return QualityCostCalculationResponse(**result)
    except ValidationError as e:
        raise _http_exception_with_trace(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/quality-cost/calculate", tenant_id)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(status.HTTP_400_BAD_REQUEST, str(e), "/quality-cost/calculate", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"核算质量成本失败: {str(e)}",
            "/quality-cost/calculate",
            tenant_id,
        )
