"""
成本核算 API 路由

提供成本核算的 CRUD 操作和成本分析功能。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.schemas.cost import (
    CostCalculationResponse,
    CostCalculationListResponse,
    WorkOrderCostCalculationRequest,
    ProductCostCalculationRequest,
    CostComparisonResponse,
    CostAnalysisResponse,
    CostOptimizationResponse,
)
from apps.kuaizhizao.services.cost_service import CostCalculationService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/cost/calculations", tags=["Kuaige Zhizao Cost Calculations"])


@router.post("/work-order", response_model=CostCalculationResponse, status_code=status.HTTP_201_CREATED)
async def calculate_work_order_cost(
    data: WorkOrderCostCalculationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    核算工单成本
    
    根据工单信息计算材料成本、人工成本、制造费用等。
    
    Args:
        data: 工单成本核算请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostCalculationResponse: 成本核算记录
        
    Raises:
        HTTPException: 当工单不存在或数据验证失败时抛出
    """
    try:
        cost_calculation = await CostCalculationService().calculate_work_order_cost(
            tenant_id=tenant_id,
            request=data,
            created_by=current_user.id
        )
        return CostCalculationResponse.model_validate(cost_calculation)
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


@router.post("/product", response_model=CostCalculationResponse, status_code=status.HTTP_201_CREATED)
async def calculate_product_cost(
    data: ProductCostCalculationRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    核算产品成本
    
    根据产品信息计算材料成本、人工成本、制造费用等。
    
    Args:
        data: 产品成本核算请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostCalculationResponse: 成本核算记录
        
    Raises:
        HTTPException: 当产品不存在或数据验证失败时抛出
    """
    try:
        cost_calculation = await CostCalculationService().calculate_product_cost(
            tenant_id=tenant_id,
            request=data,
            created_by=current_user.id
        )
        return CostCalculationResponse.model_validate(cost_calculation)
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


@router.get("", response_model=CostCalculationListResponse)
async def list_cost_calculations(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    calculation_type: Optional[str] = Query(None, description="核算类型（可选）"),
    work_order_id: Optional[int] = Query(None, description="工单ID（可选）"),
    product_id: Optional[int] = Query(None, description="产品ID（可选）"),
    calculation_status: Optional[str] = Query(None, description="核算状态（可选）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    查询成本核算记录列表
    
    根据条件查询成本核算记录列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量
        limit: 限制数量
        calculation_type: 核算类型（可选）
        work_order_id: 工单ID（可选）
        product_id: 产品ID（可选）
        calculation_status: 核算状态（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostCalculationListResponse: 成本核算记录列表
    """
    calculations = await CostCalculationService().list_cost_calculations(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        calculation_type=calculation_type,
        work_order_id=work_order_id,
        product_id=product_id,
        calculation_status=calculation_status,
    )
    
    # 计算总数
    total = len(calculations)
    
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
    """
    查询成本核算记录详情
    
    根据UUID查询成本核算记录详情。
    
    Args:
        uuid: 成本核算记录UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostCalculationResponse: 成本核算记录详情
        
    Raises:
        HTTPException: 当成本核算记录不存在时抛出
    """
    try:
        # 先通过UUID获取ID
        from apps.kuaizhizao.models.cost_calculation import CostCalculation
        cost_calculation = await CostCalculation.filter(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True).first()
        if not cost_calculation:
            raise NotFoundError(f"成本核算记录 {uuid} 不存在")
        
        cost_calculation_response = await CostCalculationService().get_cost_calculation_by_id(
            tenant_id=tenant_id,
            cost_calculation_id=cost_calculation.id
        )
        return CostCalculationResponse.model_validate(cost_calculation_response)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/product/{product_id}/compare", response_model=CostComparisonResponse)
async def compare_costs(
    product_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    对比标准成本和实际成本
    
    根据产品ID对比标准成本和实际成本，计算成本差异。
    
    Args:
        product_id: 产品ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostComparisonResponse: 成本对比结果
        
    Raises:
        HTTPException: 当产品不存在或成本核算记录不存在时抛出
    """
    try:
        cost_comparison = await CostCalculationService().compare_costs(
            tenant_id=tenant_id,
            product_id=product_id
        )
        return CostComparisonResponse.model_validate(cost_comparison)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/product/{product_id}/analyze", response_model=CostAnalysisResponse)
async def analyze_cost(
    product_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    分析产品成本
    
    根据产品ID分析产品成本构成、成本趋势等。
    
    Args:
        product_id: 产品ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostAnalysisResponse: 成本分析结果
        
    Raises:
        HTTPException: 当产品不存在或成本核算记录不存在时抛出
    """
    try:
        cost_analysis = await CostCalculationService().analyze_cost(
            tenant_id=tenant_id,
            product_id=product_id
        )
        return CostAnalysisResponse.model_validate(cost_analysis)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/product/{product_id}/optimization", response_model=CostOptimizationResponse)
async def get_cost_optimization(
    product_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取成本优化建议
    
    根据产品ID获取成本优化建议。
    
    Args:
        product_id: 产品ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostOptimizationResponse: 成本优化建议
        
    Raises:
        HTTPException: 当产品不存在时抛出
    """
    try:
        cost_optimization = await CostCalculationService().get_cost_optimization(
            tenant_id=tenant_id,
            product_id=product_id
        )
        return CostOptimizationResponse.model_validate(cost_optimization)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

