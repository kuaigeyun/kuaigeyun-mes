"""
传感器数据服务模块

提供传感器数据的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiiot.models.sensor_data import SensorData
from apps.kuaiiot.schemas.sensor_data_schemas import (
    SensorDataCreate, SensorDataUpdate, SensorDataResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SensorDataService:
    """传感器数据服务"""
    
    @staticmethod
    async def create_sensor_data(
        tenant_id: int,
        data: SensorDataCreate
    ) -> SensorDataResponse:
        """
        创建传感器数据
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            SensorDataResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SensorData.filter(
            tenant_id=tenant_id,
            data_no=data.data_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"数据编号 {{data.data_no}} 已存在")
        
        # 创建对象
        obj = await SensorData.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SensorDataResponse.model_validate(obj)
    
    @staticmethod
    async def get_sensor_data_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> SensorDataResponse:
        """
        根据UUID获取传感器数据
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            SensorDataResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SensorData.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"传感器数据 {{obj_uuid}} 不存在")
        
        return SensorDataResponse.model_validate(obj)
    
    @staticmethod
    async def list_sensor_datas(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[SensorDataResponse]:
        """
        获取传感器数据列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态过滤
            
        Returns:
            List[SensorDataResponse]: 对象列表
        """
        query = SensorData.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        
        return [SensorDataResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_sensor_data(
        tenant_id: int,
        obj_uuid: str,
        data: SensorDataUpdate
    ) -> SensorDataResponse:
        """
        更新传感器数据
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            SensorDataResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SensorData.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"传感器数据 {{obj_uuid}} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        
        return SensorDataResponse.model_validate(obj)
    
    @staticmethod
    async def delete_sensor_data(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除传感器数据（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SensorData.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"传感器数据 {{obj_uuid}} 不存在")
        
        await obj.soft_delete()
