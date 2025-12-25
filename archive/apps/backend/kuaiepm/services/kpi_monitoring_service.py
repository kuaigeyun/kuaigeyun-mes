"""
KPI监控服务模块

提供KPI监控的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.kpi import KPIMonitoring
from apps.kuaiepm.schemas.kpi_monitoring_schemas import (
    KPIMonitoringCreate, KPIMonitoringUpdate, KPIMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class KPIMonitoringService:
    """KPI监控服务"""
    
    @staticmethod
    async def create_kpimonitoring(
        tenant_id: int,
        data: KPIMonitoringCreate
    ) -> KPIMonitoringResponse:
        """
        创建KPI监控
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            KPIMonitoringResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await KPIMonitoring.filter(
            tenant_id=tenant_id,
            monitoring_no=data.monitoring_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"监控编号 {data.monitoring_no} 已存在")
        
        # 创建对象
        obj = await KPIMonitoring.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return KPIMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def get_kpimonitoring_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> KPIMonitoringResponse:
        """
        根据UUID获取KPI监控
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            KPIMonitoringResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI监控 {obj_uuid} 不存在")
        
        return KPIMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def list_kpimonitorings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[KPIMonitoringResponse]:
        """
        获取KPI监控列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[KPIMonitoringResponse]: 对象列表
        """
        query = KPIMonitoring.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [KPIMonitoringResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_kpimonitoring(
        tenant_id: int,
        obj_uuid: str,
        data: KPIMonitoringUpdate
    ) -> KPIMonitoringResponse:
        """
        更新KPI监控
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            KPIMonitoringResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI监控 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return KPIMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def delete_kpimonitoring(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除KPI监控（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI监控 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
