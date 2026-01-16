"""
成本报表分析 API 路由

提供成本报表分析API接口，包括成本趋势分析、成本结构分析等。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from decimal import Decimal

from apps.kuaizhizao.schemas.cost import (
    CostTrendAnalysisRequest,
    CostTrendAnalysisResponse,
    CostStructureAnalysisRequest,
    CostStructureAnalysisResponse,
    CostReportRequest,
    CostReportResponse,
)
from apps.kuaizhizao.services.cost_report_service import CostReportService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/cost-report", tags=["Kuaige Zhizao Cost Report"])


@router.post("/trend", response_model=CostTrendAnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_cost_trend(
    data: CostTrendAnalysisRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    分析成本趋势
    
    根据时间范围和物料来源类型分析成本趋势。
    
    Args:
        data: 成本趋势分析请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostTrendAnalysisResponse: 成本趋势分析结果
        
    Raises:
        HTTPException: 当数据验证失败时抛出
    """
    try:
        report_service = CostReportService()
        result = await report_service.analyze_cost_trend(
            tenant_id=tenant_id,
            start_date=data.start_date,
            end_date=data.end_date,
            material_id=data.material_id,
            source_type=data.source_type,
            group_by=data.group_by
        )
        return CostTrendAnalysisResponse(**result)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分析成本趋势失败: {str(e)}"
        )


@router.post("/structure", response_model=CostStructureAnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_cost_structure(
    data: CostStructureAnalysisRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    分析成本结构
    
    分析成本构成（材料成本、人工成本、制造费用等），可按物料来源类型分组。
    
    Args:
        data: 成本结构分析请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostStructureAnalysisResponse: 成本结构分析结果
        
    Raises:
        HTTPException: 当数据验证失败时抛出
    """
    try:
        report_service = CostReportService()
        result = await report_service.analyze_cost_structure(
            tenant_id=tenant_id,
            start_date=data.start_date,
            end_date=data.end_date,
            material_id=data.material_id,
            source_type=data.source_type
        )
        return CostStructureAnalysisResponse(**result)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分析成本结构失败: {str(e)}"
        )


@router.post("/generate", response_model=CostReportResponse, status_code=status.HTTP_200_OK)
async def generate_cost_report(
    data: CostReportRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    生成成本报表
    
    生成综合成本报表，包括成本趋势和成本结构分析。
    
    Args:
        data: 成本报表请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostReportResponse: 成本报表数据
        
    Raises:
        HTTPException: 当数据验证失败时抛出
    """
    if data.report_type not in ["trend", "structure", "comprehensive"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="report_type必须是trend、structure或comprehensive之一"
        )
    
    try:
        report_service = CostReportService()
        result = await report_service.generate_cost_report(
            tenant_id=tenant_id,
            report_type=data.report_type,
            start_date=data.start_date,
            end_date=data.end_date,
            material_id=data.material_id,
            source_type=data.source_type,
            group_by=data.group_by
        )
        return CostReportResponse(**result)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成成本报表失败: {str(e)}"
        )
