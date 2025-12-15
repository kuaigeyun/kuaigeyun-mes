"""
数据接口服务模块

提供数据接口的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaaiot.models.data_interface import DataInterface
from apps.kuaaiot.schemas.data_interface_schemas import (
    DataInterfaceCreate, DataInterfaceUpdate, DataInterfaceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DataInterfaceService:
    """数据接口服务"""
    
    @staticmethod
    async def create_data_interface(
        tenant_id: int,
        data: DataInterfaceCreate
    ) -> DataInterfaceResponse:
        """创建数据接口"""
        existing = await DataInterface.filter(
            tenant_id=tenant_id,
            interface_no=data.interface_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"数据接口编号 {data.interface_no} 已存在")
        
        interface = await DataInterface.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DataInterfaceResponse.model_validate(interface)
    
    @staticmethod
    async def get_data_interface_by_uuid(
        tenant_id: int,
        interface_uuid: str
    ) -> DataInterfaceResponse:
        """根据UUID获取数据接口"""
        interface = await DataInterface.filter(
            tenant_id=tenant_id,
            uuid=interface_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not interface:
            raise NotFoundError(f"数据接口 {interface_uuid} 不存在")
        
        return DataInterfaceResponse.model_validate(interface)
    
    @staticmethod
    async def list_data_interfaces(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        interface_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[DataInterfaceResponse]:
        """获取数据接口列表"""
        query = DataInterface.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if interface_type:
            query = query.filter(interface_type=interface_type)
        if status:
            query = query.filter(status=status)
        
        interfaces = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [DataInterfaceResponse.model_validate(i) for i in interfaces]
    
    @staticmethod
    async def update_data_interface(
        tenant_id: int,
        interface_uuid: str,
        data: DataInterfaceUpdate
    ) -> DataInterfaceResponse:
        """更新数据接口"""
        interface = await DataInterface.filter(
            tenant_id=tenant_id,
            uuid=interface_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not interface:
            raise NotFoundError(f"数据接口 {interface_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(interface, key, value)
        
        await interface.save()
        
        return DataInterfaceResponse.model_validate(interface)
    
    @staticmethod
    async def delete_data_interface(
        tenant_id: int,
        interface_uuid: str
    ) -> None:
        """删除数据接口（软删除）"""
        interface = await DataInterface.filter(
            tenant_id=tenant_id,
            uuid=interface_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not interface:
            raise NotFoundError(f"数据接口 {interface_uuid} 不存在")
        
        interface.deleted_at = datetime.utcnow()
        await interface.save()

