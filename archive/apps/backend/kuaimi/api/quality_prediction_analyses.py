"""
质量预测分析 API 模块

提供质量预测分析的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimi.services.quality_prediction_analysis_service import QualityPredictionAnalysisService
from apps.kuaimi.schemas.quality_prediction_analysis_schemas import (
    QualityPredictionAnalysisCreate, QualityPredictionAnalysisUpdate, QualityPredictionAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/quality-prediction-analyses", tags=["QualityPredictionAnalyses"])


@router.post("", response_model=QualityPredictionAnalysisResponse, status_code=status.HTTP_201_CREATED, summary="创建质量预测分析")
async def create_quality_prediction_analysis(
    data: QualityPredictionAnalysisCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建质量预测分析"""
    try:
        return await QualityPredictionAnalysisService.create_quality_prediction_analysis(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[QualityPredictionAnalysisResponse], summary="获取质量预测分析列表")
async def list_quality_prediction_analyses(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    prediction_model: Optional[str] = Query(None, description="预测模型（过滤）"),
    alert_status: Optional[str] = Query(None, description="预警状态（过滤）"),
    risk_level: Optional[str] = Query(None, description="风险等级（过滤）")
):
    """获取质量预测分析列表"""
    return await QualityPredictionAnalysisService.list_quality_prediction_analyses(tenant_id, skip, limit, prediction_model, alert_status, risk_level)


@router.get("/{analysis_uuid}", response_model=QualityPredictionAnalysisResponse, summary="获取质量预测分析详情")
async def get_quality_prediction_analysis(
    analysis_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取质量预测分析详情"""
    try:
        return await QualityPredictionAnalysisService.get_quality_prediction_analysis_by_uuid(tenant_id, analysis_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{analysis_uuid}", response_model=QualityPredictionAnalysisResponse, summary="更新质量预测分析")
async def update_quality_prediction_analysis(
    analysis_uuid: str,
    data: QualityPredictionAnalysisUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新质量预测分析"""
    try:
        return await QualityPredictionAnalysisService.update_quality_prediction_analysis(tenant_id, analysis_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{analysis_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除质量预测分析")
async def delete_quality_prediction_analysis(
    analysis_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除质量预测分析"""
    try:
        await QualityPredictionAnalysisService.delete_quality_prediction_analysis(tenant_id, analysis_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

