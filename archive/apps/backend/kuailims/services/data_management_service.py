"""
数据管理服务模块

提供数据管理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuailims.models.data_management import DataManagement
from apps.kuailims.schemas.data_management_schemas import (
    DataManagementCreate, DataManagementUpdate, DataManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DataManagementService:
    """数据管理服务"""
    
    @staticmethod
    async def create_data_management(
        tenant_id: int,
        data: DataManagementCreate
    ) -> DataManagementResponse:
        """创建数据管理"""
        existing = await DataManagement.filter(
            tenant_id=tenant_id,
            data_no=data.data_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"数据管理编号 {data.data_no} 已存在")
        
        management = await DataManagement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DataManagementResponse.model_validate(management)
    
    @staticmethod
    async def get_data_management_by_uuid(
        tenant_id: int,
        management_uuid: str
    ) -> DataManagementResponse:
        """根据UUID获取数据管理"""
        management = await DataManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"数据管理 {management_uuid} 不存在")
        
        return DataManagementResponse.model_validate(management)
    
    @staticmethod
    async def list_data_managements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        data_type: Optional[str] = None,
        validation_status: Optional[str] = None,
        audit_status: Optional[str] = None
    ) -> List[DataManagementResponse]:
        """获取数据管理列表"""
        query = DataManagement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if data_type:
            query = query.filter(data_type=data_type)
        if validation_status:
            query = query.filter(validation_status=validation_status)
        if audit_status:
            query = query.filter(audit_status=audit_status)
        
        managements = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [DataManagementResponse.model_validate(m) for m in managements]
    
    @staticmethod
    async def update_data_management(
        tenant_id: int,
        management_uuid: str,
        data: DataManagementUpdate
    ) -> DataManagementResponse:
        """更新数据管理"""
        management = await DataManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"数据管理 {management_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(management, key, value)
        
        await management.save()
        
        return DataManagementResponse.model_validate(management)
    
    @staticmethod
    async def delete_data_management(
        tenant_id: int,
        management_uuid: str
    ) -> None:
        """删除数据管理（软删除）"""
        management = await DataManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"数据管理 {management_uuid} 不存在")
        
        management.deleted_at = datetime.utcnow()
        await management.save()

