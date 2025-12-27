"""
质量预测分析服务模块

提供质量预测分析的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimi.models.quality_prediction_analysis import QualityPredictionAnalysis
from apps.kuaimi.schemas.quality_prediction_analysis_schemas import (
    QualityPredictionAnalysisCreate, QualityPredictionAnalysisUpdate, QualityPredictionAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class QualityPredictionAnalysisService:
    """质量预测分析服务"""
    
    @staticmethod
    async def create_quality_prediction_analysis(
        tenant_id: int,
        data: QualityPredictionAnalysisCreate
    ) -> QualityPredictionAnalysisResponse:
        """创建质量预测分析"""
        existing = await QualityPredictionAnalysis.filter(
            tenant_id=tenant_id,
            analysis_no=data.analysis_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"质量预测分析编号 {data.analysis_no} 已存在")
        
        analysis = await QualityPredictionAnalysis.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return QualityPredictionAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def get_quality_prediction_analysis_by_uuid(
        tenant_id: int,
        analysis_uuid: str
    ) -> QualityPredictionAnalysisResponse:
        """根据UUID获取质量预测分析"""
        analysis = await QualityPredictionAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"质量预测分析 {analysis_uuid} 不存在")
        
        return QualityPredictionAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def list_quality_prediction_analyses(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        prediction_model: Optional[str] = None,
        alert_status: Optional[str] = None,
        risk_level: Optional[str] = None
    ) -> List[QualityPredictionAnalysisResponse]:
        """获取质量预测分析列表"""
        query = QualityPredictionAnalysis.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if prediction_model:
            query = query.filter(prediction_model=prediction_model)
        if alert_status:
            query = query.filter(alert_status=alert_status)
        if risk_level:
            query = query.filter(risk_level=risk_level)
        
        analyses = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [QualityPredictionAnalysisResponse.model_validate(a) for a in analyses]
    
    @staticmethod
    async def update_quality_prediction_analysis(
        tenant_id: int,
        analysis_uuid: str,
        data: QualityPredictionAnalysisUpdate
    ) -> QualityPredictionAnalysisResponse:
        """更新质量预测分析"""
        analysis = await QualityPredictionAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"质量预测分析 {analysis_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(analysis, key, value)
        
        await analysis.save()
        
        return QualityPredictionAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def delete_quality_prediction_analysis(
        tenant_id: int,
        analysis_uuid: str
    ) -> None:
        """删除质量预测分析（软删除）"""
        analysis = await QualityPredictionAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"质量预测分析 {analysis_uuid} 不存在")
        
        analysis.deleted_at = datetime.utcnow()
        await analysis.save()

