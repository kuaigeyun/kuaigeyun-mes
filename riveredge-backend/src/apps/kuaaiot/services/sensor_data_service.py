"""
传感器数据服务模块

提供传感器数据的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaaiot.models.sensor_data import SensorData
from apps.kuaaiot.schemas.sensor_data_schemas import (
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
        """创建传感器数据"""
        existing = await SensorData.filter(
            tenant_id=tenant_id,
            sensor_no=data.sensor_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"传感器数据编号 {data.sensor_no} 已存在")
        
        sensor = await SensorData.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SensorDataResponse.model_validate(sensor)
    
    @staticmethod
    async def get_sensor_data_by_uuid(
        tenant_id: int,
        sensor_uuid: str
    ) -> SensorDataResponse:
        """根据UUID获取传感器数据"""
        sensor = await SensorData.filter(
            tenant_id=tenant_id,
            uuid=sensor_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sensor:
            raise NotFoundError(f"传感器数据 {sensor_uuid} 不存在")
        
        return SensorDataResponse.model_validate(sensor)
    
    @staticmethod
    async def list_sensor_datas(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        sensor_type: Optional[str] = None,
        device_id: Optional[int] = None,
        collection_status: Optional[str] = None
    ) -> List[SensorDataResponse]:
        """获取传感器数据列表"""
        query = SensorData.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if sensor_type:
            query = query.filter(sensor_type=sensor_type)
        if device_id:
            query = query.filter(device_id=device_id)
        if collection_status:
            query = query.filter(collection_status=collection_status)
        
        sensors = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SensorDataResponse.model_validate(s) for s in sensors]
    
    @staticmethod
    async def update_sensor_data(
        tenant_id: int,
        sensor_uuid: str,
        data: SensorDataUpdate
    ) -> SensorDataResponse:
        """更新传感器数据"""
        sensor = await SensorData.filter(
            tenant_id=tenant_id,
            uuid=sensor_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sensor:
            raise NotFoundError(f"传感器数据 {sensor_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(sensor, key, value)
        
        await sensor.save()
        
        return SensorDataResponse.model_validate(sensor)
    
    @staticmethod
    async def delete_sensor_data(
        tenant_id: int,
        sensor_uuid: str
    ) -> None:
        """删除传感器数据（软删除）"""
        sensor = await SensorData.filter(
            tenant_id=tenant_id,
            uuid=sensor_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sensor:
            raise NotFoundError(f"传感器数据 {sensor_uuid} 不存在")
        
        sensor.deleted_at = datetime.utcnow()
        await sensor.save()

