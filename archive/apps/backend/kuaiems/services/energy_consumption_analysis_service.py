"""
能耗分析服务模块

提供能耗分析的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiems.models.energy_consumption_analysis import EnergyConsumptionAnalysis
from apps.kuaiems.schemas.energy_consumption_analysis_schemas import (
    EnergyConsumptionAnalysisCreate, EnergyConsumptionAnalysisUpdate, EnergyConsumptionAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EnergyConsumptionAnalysisService:
    """能耗分析服务"""
    
    @staticmethod
    async def create_energy_consumption_analysis(
        tenant_id: int,
        data: EnergyConsumptionAnalysisCreate
    ) -> EnergyConsumptionAnalysisResponse:
        """创建能耗分析"""
        existing = await EnergyConsumptionAnalysis.filter(
            tenant_id=tenant_id,
            analysis_no=data.analysis_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"能耗分析编号 {data.analysis_no} 已存在")
        
        analysis = await EnergyConsumptionAnalysis.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EnergyConsumptionAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def get_energy_consumption_analysis_by_uuid(
        tenant_id: int,
        analysis_uuid: str
    ) -> EnergyConsumptionAnalysisResponse:
        """根据UUID获取能耗分析"""
        analysis = await EnergyConsumptionAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"能耗分析 {analysis_uuid} 不存在")
        
        return EnergyConsumptionAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def list_energy_consumption_analyses(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        analysis_type: Optional[str] = None,
        energy_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[EnergyConsumptionAnalysisResponse]:
        """获取能耗分析列表"""
        query = EnergyConsumptionAnalysis.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if analysis_type:
            query = query.filter(analysis_type=analysis_type)
        if energy_type:
            query = query.filter(energy_type=energy_type)
        if status:
            query = query.filter(status=status)
        
        analyses = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [EnergyConsumptionAnalysisResponse.model_validate(a) for a in analyses]
    
    @staticmethod
    async def update_energy_consumption_analysis(
        tenant_id: int,
        analysis_uuid: str,
        data: EnergyConsumptionAnalysisUpdate
    ) -> EnergyConsumptionAnalysisResponse:
        """更新能耗分析"""
        analysis = await EnergyConsumptionAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"能耗分析 {analysis_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(analysis, key, value)
        
        await analysis.save()
        
        return EnergyConsumptionAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def delete_energy_consumption_analysis(
        tenant_id: int,
        analysis_uuid: str
    ) -> None:
        """删除能耗分析（软删除）"""
        analysis = await EnergyConsumptionAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"能耗分析 {analysis_uuid} 不存在")
        
        analysis.deleted_at = datetime.utcnow()
        await analysis.save()

