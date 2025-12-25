"""
设备数据采集服务模块

提供设备数据采集的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiiot.models.device_data_collection import DeviceDataCollection
from apps.kuaiiot.schemas.device_data_collection_schemas import (
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
        """
        创建设备数据采集
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            DeviceDataCollectionResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await DeviceDataCollection.filter(
            tenant_id=tenant_id,
            collection_no=data.collection_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"采集编号 {data.collection_no} 已存在")
        
        # 创建对象
        obj = await DeviceDataCollection.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DeviceDataCollectionResponse.model_validate(obj)
    
    @staticmethod
    async def get_device_data_collection_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> DeviceDataCollectionResponse:
        """
        根据UUID获取设备数据采集
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            DeviceDataCollectionResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DeviceDataCollection.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"设备数据采集 {obj_uuid} 不存在")
        
        return DeviceDataCollectionResponse.model_validate(obj)
    
    @staticmethod
    async def list_device_data_collections(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[DeviceDataCollectionResponse]:
        """
        获取设备数据采集列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态过滤
            
        Returns:
            List[DeviceDataCollectionResponse]: 对象列表
        """
        query = DeviceDataCollection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        
        return [DeviceDataCollectionResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_device_data_collection(
        tenant_id: int,
        obj_uuid: str,
        data: DeviceDataCollectionUpdate
    ) -> DeviceDataCollectionResponse:
        """
        更新设备数据采集
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            DeviceDataCollectionResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DeviceDataCollection.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"设备数据采集 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        
        return DeviceDataCollectionResponse.model_validate(obj)
    
    @staticmethod
    async def delete_device_data_collection(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除设备数据采集（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DeviceDataCollection.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"设备数据采集 {obj_uuid} 不存在")
        
        await obj.soft_delete()

