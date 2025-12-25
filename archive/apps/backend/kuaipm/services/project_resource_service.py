"""
项目资源服务模块

提供项目资源的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import ProjectResource
from apps.kuaipm.schemas.project_resource_schemas import (
    ProjectResourceCreate, ProjectResourceUpdate, ProjectResourceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProjectResourceService:
    """项目资源服务"""
    
    @staticmethod
    async def create_projectresource(
        tenant_id: int,
        data: ProjectResourceCreate
    ) -> ProjectResourceResponse:
        """
        创建项目资源
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ProjectResourceResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ProjectResource.filter(
            tenant_id=tenant_id,
            resource_no=data.resource_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"资源编号 {data.resource_no} 已存在")
        
        # 创建对象
        obj = await ProjectResource.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProjectResourceResponse.model_validate(obj)
    
    @staticmethod
    async def get_projectresource_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ProjectResourceResponse:
        """
        根据UUID获取项目资源
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ProjectResourceResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectResource.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目资源 {obj_uuid} 不存在")
        
        return ProjectResourceResponse.model_validate(obj)
    
    @staticmethod
    async def list_projectresources(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ProjectResourceResponse]:
        """
        获取项目资源列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ProjectResourceResponse]: 对象列表
        """
        query = ProjectResource.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ProjectResourceResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_projectresource(
        tenant_id: int,
        obj_uuid: str,
        data: ProjectResourceUpdate
    ) -> ProjectResourceResponse:
        """
        更新项目资源
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ProjectResourceResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectResource.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目资源 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ProjectResourceResponse.model_validate(obj)
    
    @staticmethod
    async def delete_projectresource(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除项目资源（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectResource.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目资源 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
