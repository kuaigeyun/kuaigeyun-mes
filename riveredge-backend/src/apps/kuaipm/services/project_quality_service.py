"""
项目质量服务模块

提供项目质量的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import ProjectQuality
from apps.kuaipm.schemas.project_quality_schemas import (
    ProjectQualityCreate, ProjectQualityUpdate, ProjectQualityResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProjectQualityService:
    """项目质量服务"""
    
    @staticmethod
    async def create_projectquality(
        tenant_id: int,
        data: ProjectQualityCreate
    ) -> ProjectQualityResponse:
        """
        创建项目质量
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ProjectQualityResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ProjectQuality.filter(
            tenant_id=tenant_id,
            quality_no=data.quality_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"质量编号 {data.quality_no} 已存在")
        
        # 创建对象
        obj = await ProjectQuality.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProjectQualityResponse.model_validate(obj)
    
    @staticmethod
    async def get_projectquality_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ProjectQualityResponse:
        """
        根据UUID获取项目质量
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ProjectQualityResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectQuality.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目质量 {obj_uuid} 不存在")
        
        return ProjectQualityResponse.model_validate(obj)
    
    @staticmethod
    async def list_projectqualitys(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ProjectQualityResponse]:
        """
        获取项目质量列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ProjectQualityResponse]: 对象列表
        """
        query = ProjectQuality.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ProjectQualityResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_projectquality(
        tenant_id: int,
        obj_uuid: str,
        data: ProjectQualityUpdate
    ) -> ProjectQualityResponse:
        """
        更新项目质量
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ProjectQualityResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectQuality.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目质量 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ProjectQualityResponse.model_validate(obj)
    
    @staticmethod
    async def delete_projectquality(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除项目质量（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectQuality.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目质量 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
