"""
能耗分析 API 模块

提供能耗分析的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiems.services.energy_consumption_analysis_service import EnergyConsumptionAnalysisService
from apps.kuaiems.schemas.energy_consumption_analysis_schemas import (
    EnergyConsumptionAnalysisCreate, EnergyConsumptionAnalysisUpdate, EnergyConsumptionAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/energy-consumption-analyses", tags=["EnergyConsumptionAnalyses"])


@router.post("", response_model=EnergyConsumptionAnalysisResponse, status_code=status.HTTP_201_CREATED, summary="创建能耗分析")
async def create_energy_consumption_analysis(
    data: EnergyConsumptionAnalysisCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建能耗分析"""
    try:
        return await EnergyConsumptionAnalysisService.create_energy_consumption_analysis(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EnergyConsumptionAnalysisResponse], summary="获取能耗分析列表")
async def list_energy_consumption_analyses(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    analysis_type: Optional[str] = Query(None, description="分析类型（过滤）"),
    energy_type: Optional[str] = Query(None, description="能源类型（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取能耗分析列表"""
    return await EnergyConsumptionAnalysisService.list_energy_consumption_analyses(tenant_id, skip, limit, analysis_type, energy_type, status)


@router.get("/{analysis_uuid}", response_model=EnergyConsumptionAnalysisResponse, summary="获取能耗分析详情")
async def get_energy_consumption_analysis(
    analysis_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取能耗分析详情"""
    try:
        return await EnergyConsumptionAnalysisService.get_energy_consumption_analysis_by_uuid(tenant_id, analysis_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{analysis_uuid}", response_model=EnergyConsumptionAnalysisResponse, summary="更新能耗分析")
async def update_energy_consumption_analysis(
    analysis_uuid: str,
    data: EnergyConsumptionAnalysisUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新能耗分析"""
    try:
        return await EnergyConsumptionAnalysisService.update_energy_consumption_analysis(tenant_id, analysis_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{analysis_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除能耗分析")
async def delete_energy_consumption_analysis(
    analysis_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除能耗分析"""
    try:
        await EnergyConsumptionAnalysisService.delete_energy_consumption_analysis(tenant_id, analysis_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

