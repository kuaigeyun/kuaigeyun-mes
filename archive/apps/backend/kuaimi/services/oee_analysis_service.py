"""
设备综合效率分析服务模块

提供设备综合效率分析的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimi.models.oee_analysis import OEEAnalysis
from apps.kuaimi.schemas.oee_analysis_schemas import (
    OEEAnalysisCreate, OEEAnalysisUpdate, OEEAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OEEAnalysisService:
    """设备综合效率分析服务"""
    
    @staticmethod
    async def create_oee_analysis(
        tenant_id: int,
        data: OEEAnalysisCreate
    ) -> OEEAnalysisResponse:
        """创建设备综合效率分析"""
        existing = await OEEAnalysis.filter(
            tenant_id=tenant_id,
            analysis_no=data.analysis_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"设备综合效率分析编号 {data.analysis_no} 已存在")
        
        analysis = await OEEAnalysis.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OEEAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def get_oee_analysis_by_uuid(
        tenant_id: int,
        analysis_uuid: str
    ) -> OEEAnalysisResponse:
        """根据UUID获取设备综合效率分析"""
        analysis = await OEEAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"设备综合效率分析 {analysis_uuid} 不存在")
        
        return OEEAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def list_oee_analyses(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        device_id: Optional[int] = None,
        analysis_period: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[OEEAnalysisResponse]:
        """获取设备综合效率分析列表"""
        query = OEEAnalysis.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if device_id:
            query = query.filter(device_id=device_id)
        if analysis_period:
            query = query.filter(analysis_period=analysis_period)
        if status:
            query = query.filter(status=status)
        
        analyses = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [OEEAnalysisResponse.model_validate(a) for a in analyses]
    
    @staticmethod
    async def update_oee_analysis(
        tenant_id: int,
        analysis_uuid: str,
        data: OEEAnalysisUpdate
    ) -> OEEAnalysisResponse:
        """更新设备综合效率分析"""
        analysis = await OEEAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"设备综合效率分析 {analysis_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(analysis, key, value)
        
        await analysis.save()
        
        return OEEAnalysisResponse.model_validate(analysis)
    
    @staticmethod
    async def delete_oee_analysis(
        tenant_id: int,
        analysis_uuid: str
    ) -> None:
        """删除设备综合效率分析（软删除）"""
        analysis = await OEEAnalysis.filter(
            tenant_id=tenant_id,
            uuid=analysis_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not analysis:
            raise NotFoundError(f"设备综合效率分析 {analysis_uuid} 不存在")
        
        analysis.deleted_at = datetime.utcnow()
        await analysis.save()

