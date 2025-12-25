"""
实时监控服务模块

提供实时监控的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiiot.models.real_time_monitoring import RealTimeMonitoring
from apps.kuaiiot.schemas.real_time_monitoring_schemas import (
    RealTimeMonitoringCreate, RealTimeMonitoringUpdate, RealTimeMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class RealTimeMonitoringService:
    """实时监控服务"""
    
    @staticmethod
    async def create_real_time_monitoring(
        tenant_id: int,
        data: RealTimeMonitoringCreate
    ) -> RealTimeMonitoringResponse:
        """
        创建实时监控
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            RealTimeMonitoringResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            monitoring_no=data.monitoring_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"监控编号 {{data.monitoring_no}} 已存在")
        
        # 创建对象
        obj = await RealTimeMonitoring.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return RealTimeMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def get_real_time_monitoring_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> RealTimeMonitoringResponse:
        """
        根据UUID获取实时监控
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            RealTimeMonitoringResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"实时监控 {{obj_uuid}} 不存在")
        
        return RealTimeMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def list_real_time_monitorings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[RealTimeMonitoringResponse]:
        """
        获取实时监控列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态过滤
            
        Returns:
            List[RealTimeMonitoringResponse]: 对象列表
        """
        query = RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        
        return [RealTimeMonitoringResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_real_time_monitoring(
        tenant_id: int,
        obj_uuid: str,
        data: RealTimeMonitoringUpdate
    ) -> RealTimeMonitoringResponse:
        """
        更新实时监控
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            RealTimeMonitoringResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"实时监控 {{obj_uuid}} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        
        return RealTimeMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def delete_real_time_monitoring(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除实时监控（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"实时监控 {{obj_uuid}} 不存在")
        
        await obj.soft_delete()
