"""
排放管理服务模块

提供排放管理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.environment import EmissionManagement
from apps.kuaiehs.schemas.emission_management_schemas import (
    EmissionManagementCreate, EmissionManagementUpdate, EmissionManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EmissionManagementService:
    """排放管理服务"""
    
    @staticmethod
    async def create_emissionmanagement(
        tenant_id: int,
        data: EmissionManagementCreate
    ) -> EmissionManagementResponse:
        """
        创建排放管理
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            EmissionManagementResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await EmissionManagement.filter(
            tenant_id=tenant_id,
            emission_no=data.emission_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"排放编号 {data.emission_no} 已存在")
        
        # 创建对象
        obj = await EmissionManagement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EmissionManagementResponse.model_validate(obj)
    
    @staticmethod
    async def get_emissionmanagement_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> EmissionManagementResponse:
        """
        根据UUID获取排放管理
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            EmissionManagementResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EmissionManagement.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"排放管理 {obj_uuid} 不存在")
        
        return EmissionManagementResponse.model_validate(obj)
    
    @staticmethod
    async def list_emissionmanagements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[EmissionManagementResponse]:
        """
        获取排放管理列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[EmissionManagementResponse]: 对象列表
        """
        query = EmissionManagement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [EmissionManagementResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_emissionmanagement(
        tenant_id: int,
        obj_uuid: str,
        data: EmissionManagementUpdate
    ) -> EmissionManagementResponse:
        """
        更新排放管理
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            EmissionManagementResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EmissionManagement.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"排放管理 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return EmissionManagementResponse.model_validate(obj)
    
    @staticmethod
    async def delete_emissionmanagement(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除排放管理（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EmissionManagement.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"排放管理 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
