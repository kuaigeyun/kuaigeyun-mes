"""
系统应用绩效分析 API 模块

提供系统应用绩效分析的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimi.services.system_performance_analysis_service import SystemPerformanceAnalysisService
from apps.kuaimi.schemas.system_performance_analysis_schemas import (
    SystemPerformanceAnalysisCreate, SystemPerformanceAnalysisUpdate, SystemPerformanceAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/system-performance-analyses", tags=["SystemPerformanceAnalyses"])


@router.post("", response_model=SystemPerformanceAnalysisResponse, status_code=status.HTTP_201_CREATED, summary="创建系统应用绩效分析")
async def create_system_performance_analysis(
    data: SystemPerformanceAnalysisCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建系统应用绩效分析"""
    try:
        return await SystemPerformanceAnalysisService.create_system_performance_analysis(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SystemPerformanceAnalysisResponse], summary="获取系统应用绩效分析列表")
async def list_system_performance_analyses(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    analysis_type: Optional[str] = Query(None, description="分析类型（过滤）"),
    analysis_period: Optional[str] = Query(None, description="分析周期（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取系统应用绩效分析列表"""
    return await SystemPerformanceAnalysisService.list_system_performance_analyses(tenant_id, skip, limit, analysis_type, analysis_period, status)


@router.get("/{analysis_uuid}", response_model=SystemPerformanceAnalysisResponse, summary="获取系统应用绩效分析详情")
async def get_system_performance_analysis(
    analysis_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取系统应用绩效分析详情"""
    try:
        return await SystemPerformanceAnalysisService.get_system_performance_analysis_by_uuid(tenant_id, analysis_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{analysis_uuid}", response_model=SystemPerformanceAnalysisResponse, summary="更新系统应用绩效分析")
async def update_system_performance_analysis(
    analysis_uuid: str,
    data: SystemPerformanceAnalysisUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新系统应用绩效分析"""
    try:
        return await SystemPerformanceAnalysisService.update_system_performance_analysis(tenant_id, analysis_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{analysis_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除系统应用绩效分析")
async def delete_system_performance_analysis(
    analysis_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除系统应用绩效分析"""
    try:
        await SystemPerformanceAnalysisService.delete_system_performance_analysis(tenant_id, analysis_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

