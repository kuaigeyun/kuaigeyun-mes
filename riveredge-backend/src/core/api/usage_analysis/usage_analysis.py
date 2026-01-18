"""
使用情况分析 API 路由

提供使用情况分析的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from core.services.usage_analysis.usage_analysis_service import UsageAnalysisService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/usage-analysis", tags=["Usage Analysis"])

usage_analysis_service = UsageAnalysisService()


@router.get("/function-usage", summary="分析功能使用情况")
async def analyze_function_usage(
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    分析功能使用情况
    
    Args:
        start_date: 开始日期（可选）
        end_date: 结束日期（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 功能使用分析结果
    """
    try:
        result = await usage_analysis_service.analyze_function_usage(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date
        )
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        logger.error(f"分析功能使用情况失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分析功能使用情况失败: {str(e)}"
        )


@router.get("/data-quality", summary="分析数据质量")
async def analyze_data_quality(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    分析数据质量
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 数据质量分析结果
    """
    try:
        result = await usage_analysis_service.analyze_data_quality(tenant_id)
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        logger.error(f"分析数据质量失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分析数据质量失败: {str(e)}"
        )


@router.get("/performance", summary="分析系统性能")
async def analyze_performance(
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    分析系统性能
    
    Args:
        start_date: 开始日期（可选）
        end_date: 结束日期（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 性能分析结果
    """
    try:
        result = await usage_analysis_service.analyze_performance(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date
        )
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        logger.error(f"分析系统性能失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分析系统性能失败: {str(e)}"
        )


@router.get("/report", summary="生成使用情况分析报告")
async def generate_usage_report(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    生成使用情况分析报告
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 使用情况分析报告
    """
    try:
        report = await usage_analysis_service.generate_usage_report(tenant_id)
        return {
            "success": True,
            "data": report,
        }
    except Exception as e:
        logger.error(f"生成使用情况分析报告失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成使用情况分析报告失败: {str(e)}"
        )
