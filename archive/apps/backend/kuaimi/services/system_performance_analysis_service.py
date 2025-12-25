"""
系统应用绩效分析服务模块

提供系统应用绩效分析的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimi.models.system_performance_analysis import SystemPerformanceAnalysis
from apps.kuaimi.schemas.system_performance_analysis_schemas import (
    SystemPerformanceAnalysisCreate, SystemPerformanceAnalysisUpdate, SystemPerformanceAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SystemPerformanceAnalysisService:
    """系统应用绩效分析服务"""
    
    @staticmethod
    async def create_system_performance_analysis(
        tenant_id: int,
        data: SystemPerformanceAnalysisCreate
    ) -> SystemPerformanceAnalysisResponse:
        """创建系统应用绩效分析"""
        existing = await SystemPerformanceAnalysis.filter(
            tenant_id=tenant_id,
            analysis_no=data.analysis_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"系统应用绩效分析编号 {data.analysis_no} 已存在")
        
        analysis = await SystemPerformanceAnalysis.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SystemPerformanceAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def get_system_performance_analysis_by_uuid(
        tenant_id: int,
        analysis_uuid: str
    ) -> SystemPerformanceAnalysisResponse:
        """根据UUID获取系统应用绩效分析"""
        analysis = await SystemPerformanceAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"系统应用绩效分析 {analysis_uuid} 不存在")
        
        return SystemPerformanceAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def list_system_performance_analyses(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        analysis_type: Optional[str] = None,
        analysis_period: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SystemPerformanceAnalysisResponse]:
        """获取系统应用绩效分析列表"""
        query = SystemPerformanceAnalysis.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if analysis_type:
            query = query.filter(analysis_type=analysis_type)
        if analysis_period:
            query = query.filter(analysis_period=analysis_period)
        if status:
            query = query.filter(status=status)
        
        analyses = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SystemPerformanceAnalysisResponse.model_validate(a) for a in analyses]
    
    @staticmethod
    async def update_system_performance_analysis(
        tenant_id: int,
        analysis_uuid: str,
        data: SystemPerformanceAnalysisUpdate
    ) -> SystemPerformanceAnalysisResponse:
        """更新系统应用绩效分析"""
        analysis = await SystemPerformanceAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"系统应用绩效分析 {analysis_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(analysis, key, value)
        
        await analysis.save()
        
        return SystemPerformanceAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def delete_system_performance_analysis(
        tenant_id: int,
        analysis_uuid: str
    ) -> None:
        """删除系统应用绩效分析（软删除）"""
        analysis = await SystemPerformanceAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"系统应用绩效分析 {analysis_uuid} 不存在")
        
        analysis.deleted_at = datetime.utcnow()
        await analysis.save()

