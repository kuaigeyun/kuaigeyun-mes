"""
KPI分析服务模块

提供KPI分析的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.kpi import KPIAnalysis
from apps.kuaiepm.schemas.kpi_analysis_schemas import (
    KPIAnalysisCreate, KPIAnalysisUpdate, KPIAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class KPIAnalysisService:
    """KPI分析服务"""
    
    @staticmethod
    async def create_kpianalysis(
        tenant_id: int,
        data: KPIAnalysisCreate
    ) -> KPIAnalysisResponse:
        """
        创建KPI分析
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            KPIAnalysisResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await KPIAnalysis.filter(
            tenant_id=tenant_id,
            analysis_no=data.analysis_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"分析编号 {data.analysis_no} 已存在")
        
        # 创建对象
        obj = await KPIAnalysis.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return KPIAnalysisResponse.model_validate(obj)
    
    @staticmethod
    async def get_kpianalysis_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> KPIAnalysisResponse:
        """
        根据UUID获取KPI分析
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            KPIAnalysisResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIAnalysis.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI分析 {obj_uuid} 不存在")
        
        return KPIAnalysisResponse.model_validate(obj)
    
    @staticmethod
    async def list_kpianalysiss(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[KPIAnalysisResponse]:
        """
        获取KPI分析列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[KPIAnalysisResponse]: 对象列表
        """
        query = KPIAnalysis.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [KPIAnalysisResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_kpianalysis(
        tenant_id: int,
        obj_uuid: str,
        data: KPIAnalysisUpdate
    ) -> KPIAnalysisResponse:
        """
        更新KPI分析
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            KPIAnalysisResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIAnalysis.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI分析 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return KPIAnalysisResponse.model_validate(obj)
    
    @staticmethod
    async def delete_kpianalysis(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除KPI分析（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIAnalysis.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI分析 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
