"""
环境监测服务模块

提供环境监测的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.environment import EnvironmentMonitoring
from apps.kuaiehs.schemas.environment_monitoring_schemas import (
    EnvironmentMonitoringCreate, EnvironmentMonitoringUpdate, EnvironmentMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EnvironmentMonitoringService:
    """环境监测服务"""
    
    @staticmethod
    async def create_environmentmonitoring(
        tenant_id: int,
        data: EnvironmentMonitoringCreate
    ) -> EnvironmentMonitoringResponse:
        """
        创建环境监测
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            EnvironmentMonitoringResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await EnvironmentMonitoring.filter(
            tenant_id=tenant_id,
            monitoring_no=data.monitoring_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"监测编号 {data.monitoring_no} 已存在")
        
        # 创建对象
        obj = await EnvironmentMonitoring.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EnvironmentMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def get_environmentmonitoring_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> EnvironmentMonitoringResponse:
        """
        根据UUID获取环境监测
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            EnvironmentMonitoringResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EnvironmentMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"环境监测 {obj_uuid} 不存在")
        
        return EnvironmentMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def list_environmentmonitorings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[EnvironmentMonitoringResponse]:
        """
        获取环境监测列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[EnvironmentMonitoringResponse]: 对象列表
        """
        query = EnvironmentMonitoring.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [EnvironmentMonitoringResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_environmentmonitoring(
        tenant_id: int,
        obj_uuid: str,
        data: EnvironmentMonitoringUpdate
    ) -> EnvironmentMonitoringResponse:
        """
        更新环境监测
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            EnvironmentMonitoringResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EnvironmentMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"环境监测 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return EnvironmentMonitoringResponse.model_validate(obj)
    
    @staticmethod
    async def delete_environmentmonitoring(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除环境监测（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EnvironmentMonitoring.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"环境监测 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
