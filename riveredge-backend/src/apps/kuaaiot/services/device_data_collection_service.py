"""
设备数据采集服务模块

提供设备数据采集的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaaiot.models.device_data_collection import DeviceDataCollection
from apps.kuaaiot.schemas.device_data_collection_schemas import (
    DeviceDataCollectionCreate, DeviceDataCollectionUpdate, DeviceDataCollectionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DeviceDataCollectionService:
    """设备数据采集服务"""
    
    @staticmethod
    async def create_device_data_collection(
        tenant_id: int,
        data: DeviceDataCollectionCreate
    ) -> DeviceDataCollectionResponse:
        """创建设备数据采集"""
        existing = await DeviceDataCollection.filter(
            tenant_id=tenant_id,
            collection_no=data.collection_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"设备数据采集编号 {data.collection_no} 已存在")
        
        collection = await DeviceDataCollection.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DeviceDataCollectionResponse.model_validate(collection)
    
    @staticmethod
    async def get_device_data_collection_by_uuid(
        tenant_id: int,
        collection_uuid: str
    ) -> DeviceDataCollectionResponse:
        """根据UUID获取设备数据采集"""
        collection = await DeviceDataCollection.filter(
            tenant_id=tenant_id,
            uuid=collection_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not collection:
            raise NotFoundError(f"设备数据采集 {collection_uuid} 不存在")
        
        return DeviceDataCollectionResponse.model_validate(collection)
    
    @staticmethod
    async def list_device_data_collections(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        device_id: Optional[int] = None,
        collection_status: Optional[str] = None,
        data_quality: Optional[str] = None
    ) -> List[DeviceDataCollectionResponse]:
        """获取设备数据采集列表"""
        query = DeviceDataCollection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if device_id:
            query = query.filter(device_id=device_id)
        if collection_status:
            query = query.filter(collection_status=collection_status)
        if data_quality:
            query = query.filter(data_quality=data_quality)
        
        collections = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [DeviceDataCollectionResponse.model_validate(c) for c in collections]
    
    @staticmethod
    async def update_device_data_collection(
        tenant_id: int,
        collection_uuid: str,
        data: DeviceDataCollectionUpdate
    ) -> DeviceDataCollectionResponse:
        """更新设备数据采集"""
        collection = await DeviceDataCollection.filter(
            tenant_id=tenant_id,
            uuid=collection_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not collection:
            raise NotFoundError(f"设备数据采集 {collection_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(collection, key, value)
        
        await collection.save()
        
        return DeviceDataCollectionResponse.model_validate(collection)
    
    @staticmethod
    async def delete_device_data_collection(
        tenant_id: int,
        collection_uuid: str
    ) -> None:
        """删除设备数据采集（软删除）"""
        collection = await DeviceDataCollection.filter(
            tenant_id=tenant_id,
            uuid=collection_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not collection:
            raise NotFoundError(f"设备数据采集 {collection_uuid} 不存在")
        
        collection.deleted_at = datetime.utcnow()
        await collection.save()

