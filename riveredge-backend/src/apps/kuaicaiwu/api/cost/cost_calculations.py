"""
成本核算 API 路由（轻管理会计）

Author: Luigi Lu
Date: 2026-03-14
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from loguru import logger

from apps.kuaizhizao.schemas.cost import (
    CostCalculationResponse,
    CostCalculationListResponse,
    WorkOrderCostCalculationRequest,
    ProductCostCalculationRequest,
    CostComparisonResponse,
    CostAnalysisResponse,
    CostOptimizationResponse,
    MonthlySettlementRequest,
)
from apps.kuaicaiwu.services.cost_service import CostCalculationService
from apps.kuaicaiwu.models.cost_calculation import CostCalculation
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/cost/calculations", tags=["App · Kuaicaiwu · Cost Calculations"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_cost_calculations_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


@router.post("/work-order", response_model=CostCalculationResponse, status_code=status.HTTP_201_CREATED)
async def calculate_work_order_cost(
    data: WorkOrderCostCalculationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_calculation = await CostCalculationService().calculate_work_order_cost(
            tenant_id=tenant_id,
            request=data,
            created_by=current_user.id
        )
        return CostCalculationResponse.model_validate(cost_calculation)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/calculations/work-order", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/cost/calculations/work-order", tenant_id)


@router.post("/product", response_model=CostCalculationResponse, status_code=status.HTTP_201_CREATED)
async def calculate_product_cost(
    data: ProductCostCalculationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_calculation = await CostCalculationService().calculate_product_cost(
            tenant_id=tenant_id,
            request=data,
            created_by=current_user.id
        )
        return CostCalculationResponse.model_validate(cost_calculation)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/calculations/product", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/cost/calculations/product", tenant_id)


@router.get("", response_model=CostCalculationListResponse)
async def list_cost_calculations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    calculation_type: Optional[str] = Query(None),
    work_order_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    calculation_status: Optional[str] = Query(None),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    service = CostCalculationService()
    calculations = await service.list_cost_calculations(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        calculation_type=calculation_type,
        work_order_id=work_order_id,
        product_id=product_id,
        calculation_status=calculation_status,
    )
    query = CostCalculation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if calculation_type:
        query = query.filter(calculation_type=calculation_type)
    if work_order_id:
        query = query.filter(work_order_id=work_order_id)
    if product_id:
        query = query.filter(product_id=product_id)
    if calculation_status:
        query = query.filter(calculation_status=calculation_status)
    total = await query.count()
    return CostCalculationListResponse(
        items=calculations,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{uuid}", response_model=CostCalculationResponse)
async def get_cost_calculation(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_calculation = await CostCalculation.filter(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True).first()
        if not cost_calculation:
            raise NotFoundError(f"成本核算记录 {uuid} 不存在")
        cost_calculation_response = await CostCalculationService().get_cost_calculation_by_id(
            tenant_id=tenant_id,
            cost_calculation_id=cost_calculation.id
        )
        return CostCalculationResponse.model_validate(cost_calculation_response)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/calculations/{uuid}", tenant_id)


@router.get("/product/{product_id}/compare", response_model=CostComparisonResponse)
async def compare_costs(
    product_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_comparison = await CostCalculationService().compare_costs(
            tenant_id=tenant_id,
            product_id=product_id
        )
        return CostComparisonResponse.model_validate(cost_comparison)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/calculations/product/{product_id}/compare", tenant_id)


@router.get("/product/{product_id}/analyze", response_model=CostAnalysisResponse)
async def analyze_cost(
    product_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_analysis = await CostCalculationService().analyze_cost(
            tenant_id=tenant_id,
            product_id=product_id
        )
        return CostAnalysisResponse.model_validate(cost_analysis)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/calculations/product/{product_id}/analyze", tenant_id)


@router.get("/product/{product_id}/optimization", response_model=CostOptimizationResponse)
async def get_cost_optimization(
    product_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_optimization = await CostCalculationService().get_cost_optimization(
            tenant_id=tenant_id,
            product_id=product_id
        )
        return CostOptimizationResponse.model_validate(cost_optimization)
    except NotFoundError as e:
        raise _http_exception_with_trace(status.HTTP_404_NOT_FOUND, str(e), "/cost/calculations/product/{product_id}/optimization", tenant_id)


@router.get("/period-summary")
async def get_period_summary(
    year: int = Query(...),
    month: int = Query(...),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        summary = await CostCalculationService().get_period_summary(
            tenant_id=tenant_id,
            year=year,
            month=month
        )
        return summary
    except Exception as e:
        raise _http_exception_with_trace(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e), "/cost/calculations/period-summary", tenant_id)


@router.post("/monthly-settlement", status_code=status.HTTP_201_CREATED)
async def perform_monthly_settlement(
    data: MonthlySettlementRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        results = await CostCalculationService().perform_monthly_settlement(
            tenant_id=tenant_id,
            year=data.year,
            month=data.month,
            indirect_costs=data.indirect_costs,
            created_by=current_user.id
        )
        return {"status": "success", "data": results}
    except ValidationError as e:
        raise _http_exception_with_trace(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/cost/calculations/monthly-settlement", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e), "/cost/calculations/monthly-settlement", tenant_id)


@router.post("/realtime-refresh", status_code=status.HTTP_200_OK)
async def refresh_realtime_costs(
    lookback_hours: int = Query(24, ge=1, le=168, description="回溯窗口（小时）"),
    max_work_orders: int = Query(50, ge=1, le=500, description="单次最大刷新工单数"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        result = await CostCalculationService().refresh_realtime_costs(
            tenant_id=tenant_id,
            created_by=current_user.id,
            lookback_hours=lookback_hours,
            max_work_orders=max_work_orders,
        )
        return result
    except ValidationError as e:
        raise _http_exception_with_trace(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e), "/cost/calculations/realtime-refresh", tenant_id)
    except Exception as e:
        raise _http_exception_with_trace(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e), "/cost/calculations/realtime-refresh", tenant_id)
