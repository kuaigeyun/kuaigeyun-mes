"""
样品管理服务模块

提供样品管理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuailims.models.sample_management import SampleManagement
from apps.kuailims.schemas.sample_management_schemas import (
    SampleManagementCreate, SampleManagementUpdate, SampleManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SampleManagementService:
    """样品管理服务"""
    
    @staticmethod
    async def create_sample_management(
        tenant_id: int,
        data: SampleManagementCreate
    ) -> SampleManagementResponse:
        """创建样品管理"""
        existing = await SampleManagement.filter(
            tenant_id=tenant_id,
            sample_no=data.sample_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"样品管理编号 {data.sample_no} 已存在")
        
        management = await SampleManagement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SampleManagementResponse.model_validate(management)
    
    @staticmethod
    async def get_sample_management_by_uuid(
        tenant_id: int,
        management_uuid: str
    ) -> SampleManagementResponse:
        """根据UUID获取样品管理"""
        management = await SampleManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"样品管理 {management_uuid} 不存在")
        
        return SampleManagementResponse.model_validate(management)
    
    @staticmethod
    async def list_sample_managements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        sample_type: Optional[str] = None,
        sample_status: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SampleManagementResponse]:
        """获取样品管理列表"""
        query = SampleManagement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if sample_type:
            query = query.filter(sample_type=sample_type)
        if sample_status:
            query = query.filter(sample_status=sample_status)
        if status:
            query = query.filter(status=status)
        
        managements = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SampleManagementResponse.model_validate(m) for m in managements]
    
    @staticmethod
    async def update_sample_management(
        tenant_id: int,
        management_uuid: str,
        data: SampleManagementUpdate
    ) -> SampleManagementResponse:
        """更新样品管理"""
        management = await SampleManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"样品管理 {management_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(management, key, value)
        
        await management.save()
        
        return SampleManagementResponse.model_validate(management)
    
    @staticmethod
    async def delete_sample_management(
        tenant_id: int,
        management_uuid: str
    ) -> None:
        """删除样品管理（软删除）"""
        management = await SampleManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"样品管理 {management_uuid} 不存在")
        
        management.deleted_at = datetime.utcnow()
        await management.save()

