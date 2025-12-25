"""
传感器配置服务模块

提供传感器配置的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiiot.models.sensor_configuration import SensorConfiguration
from apps.kuaiiot.schemas.sensor_configuration_schemas import (
    SensorConfigurationCreate, SensorConfigurationUpdate, SensorConfigurationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SensorConfigurationService:
    """传感器配置服务"""
    
    @staticmethod
    async def create_sensor_configuration(
        tenant_id: int,
        data: SensorConfigurationCreate
    ) -> SensorConfigurationResponse:
        """
        创建传感器配置
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            SensorConfigurationResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SensorConfiguration.filter(
            tenant_id=tenant_id,
            config_no=data.config_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"配置编号 {{data.config_no}} 已存在")
        
        # 创建对象
        obj = await SensorConfiguration.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SensorConfigurationResponse.model_validate(obj)
    
    @staticmethod
    async def get_sensor_configuration_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> SensorConfigurationResponse:
        """
        根据UUID获取传感器配置
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            SensorConfigurationResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SensorConfiguration.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"传感器配置 {{obj_uuid}} 不存在")
        
        return SensorConfigurationResponse.model_validate(obj)
    
    @staticmethod
    async def list_sensor_configurations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[SensorConfigurationResponse]:
        """
        获取传感器配置列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态过滤
            
        Returns:
            List[SensorConfigurationResponse]: 对象列表
        """
        query = SensorConfiguration.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        
        return [SensorConfigurationResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_sensor_configuration(
        tenant_id: int,
        obj_uuid: str,
        data: SensorConfigurationUpdate
    ) -> SensorConfigurationResponse:
        """
        更新传感器配置
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            SensorConfigurationResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SensorConfiguration.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"传感器配置 {{obj_uuid}} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        
        return SensorConfigurationResponse.model_validate(obj)
    
    @staticmethod
    async def delete_sensor_configuration(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除传感器配置（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SensorConfiguration.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"传感器配置 {{obj_uuid}} 不存在")
        
        await obj.soft_delete()
