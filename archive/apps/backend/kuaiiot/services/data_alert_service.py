"""
数据预警服务模块

提供数据预警的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiiot.models.data_alert import DataAlert
from apps.kuaiiot.schemas.data_alert_schemas import (
    DataAlertCreate, DataAlertUpdate, DataAlertResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DataAlertService:
    """数据预警服务"""
    
    @staticmethod
    async def create_data_alert(
        tenant_id: int,
        data: DataAlertCreate
    ) -> DataAlertResponse:
        """
        创建数据预警
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            DataAlertResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await DataAlert.filter(
            tenant_id=tenant_id,
            alert_no=data.alert_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"预警编号 {{data.alert_no}} 已存在")
        
        # 创建对象
        obj = await DataAlert.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DataAlertResponse.model_validate(obj)
    
    @staticmethod
    async def get_data_alert_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> DataAlertResponse:
        """
        根据UUID获取数据预警
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            DataAlertResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DataAlert.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"数据预警 {{obj_uuid}} 不存在")
        
        return DataAlertResponse.model_validate(obj)
    
    @staticmethod
    async def list_data_alerts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[DataAlertResponse]:
        """
        获取数据预警列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态过滤
            
        Returns:
            List[DataAlertResponse]: 对象列表
        """
        query = DataAlert.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        
        return [DataAlertResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_data_alert(
        tenant_id: int,
        obj_uuid: str,
        data: DataAlertUpdate
    ) -> DataAlertResponse:
        """
        更新数据预警
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            DataAlertResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DataAlert.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"数据预警 {{obj_uuid}} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        
        return DataAlertResponse.model_validate(obj)
    
    @staticmethod
    async def delete_data_alert(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除数据预警（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DataAlert.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"数据预警 {{obj_uuid}} 不存在")
        
        await obj.soft_delete()
