"""
节能管理服务模块

提供节能管理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiems.models.energy_saving_management import EnergySavingManagement
from apps.kuaiems.schemas.energy_saving_management_schemas import (
    EnergySavingManagementCreate, EnergySavingManagementUpdate, EnergySavingManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EnergySavingManagementService:
    """节能管理服务"""
    
    @staticmethod
    async def create_energy_saving_management(
        tenant_id: int,
        data: EnergySavingManagementCreate
    ) -> EnergySavingManagementResponse:
        """创建节能管理"""
        existing = await EnergySavingManagement.filter(
            tenant_id=tenant_id,
            management_no=data.management_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"节能管理编号 {data.management_no} 已存在")
        
        management = await EnergySavingManagement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EnergySavingManagementResponse.model_validate(management)
    
    @staticmethod
    async def get_energy_saving_management_by_uuid(
        tenant_id: int,
        management_uuid: str
    ) -> EnergySavingManagementResponse:
        """根据UUID获取节能管理"""
        management = await EnergySavingManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"节能管理 {management_uuid} 不存在")
        
        return EnergySavingManagementResponse.model_validate(management)
    
    @staticmethod
    async def list_energy_saving_managements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        management_type: Optional[str] = None,
        energy_type: Optional[str] = None,
        measure_status: Optional[str] = None
    ) -> List[EnergySavingManagementResponse]:
        """获取节能管理列表"""
        query = EnergySavingManagement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if management_type:
            query = query.filter(management_type=management_type)
        if energy_type:
            query = query.filter(energy_type=energy_type)
        if measure_status:
            query = query.filter(measure_status=measure_status)
        
        managements = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [EnergySavingManagementResponse.model_validate(m) for m in managements]
    
    @staticmethod
    async def update_energy_saving_management(
        tenant_id: int,
        management_uuid: str,
        data: EnergySavingManagementUpdate
    ) -> EnergySavingManagementResponse:
        """更新节能管理"""
        management = await EnergySavingManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"节能管理 {management_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(management, key, value)
        
        await management.save()
        
        return EnergySavingManagementResponse.model_validate(management)
    
    @staticmethod
    async def delete_energy_saving_management(
        tenant_id: int,
        management_uuid: str
    ) -> None:
        """删除节能管理（软删除）"""
        management = await EnergySavingManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"节能管理 {management_uuid} 不存在")
        
        management.deleted_at = datetime.utcnow()
        await management.save()

