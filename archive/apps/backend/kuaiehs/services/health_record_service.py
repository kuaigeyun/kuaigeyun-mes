"""
健康档案服务模块

提供健康档案的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.health import HealthRecord
from apps.kuaiehs.schemas.health_record_schemas import (
    HealthRecordCreate, HealthRecordUpdate, HealthRecordResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class HealthRecordService:
    """健康档案服务"""
    
    @staticmethod
    async def create_healthrecord(
        tenant_id: int,
        data: HealthRecordCreate
    ) -> HealthRecordResponse:
        """
        创建健康档案
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            HealthRecordResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await HealthRecord.filter(
            tenant_id=tenant_id,
            record_no=data.record_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"档案编号 {data.record_no} 已存在")
        
        # 创建对象
        obj = await HealthRecord.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return HealthRecordResponse.model_validate(obj)
    
    @staticmethod
    async def get_healthrecord_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> HealthRecordResponse:
        """
        根据UUID获取健康档案
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            HealthRecordResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await HealthRecord.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"健康档案 {obj_uuid} 不存在")
        
        return HealthRecordResponse.model_validate(obj)
    
    @staticmethod
    async def list_healthrecords(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[HealthRecordResponse]:
        """
        获取健康档案列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[HealthRecordResponse]: 对象列表
        """
        query = HealthRecord.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [HealthRecordResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_healthrecord(
        tenant_id: int,
        obj_uuid: str,
        data: HealthRecordUpdate
    ) -> HealthRecordResponse:
        """
        更新健康档案
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            HealthRecordResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await HealthRecord.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"健康档案 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return HealthRecordResponse.model_validate(obj)
    
    @staticmethod
    async def delete_healthrecord(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除健康档案（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await HealthRecord.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"健康档案 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
