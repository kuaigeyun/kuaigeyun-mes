"""
项目进度服务模块

提供项目进度的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import ProjectProgress
from apps.kuaipm.schemas.project_progress_schemas import (
    ProjectProgressCreate, ProjectProgressUpdate, ProjectProgressResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProjectProgressService:
    """项目进度服务"""
    
    @staticmethod
    async def create_projectprogress(
        tenant_id: int,
        data: ProjectProgressCreate
    ) -> ProjectProgressResponse:
        """
        创建项目进度
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ProjectProgressResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ProjectProgress.filter(
            tenant_id=tenant_id,
            progress_no=data.progress_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"进度编号 {data.progress_no} 已存在")
        
        # 创建对象
        obj = await ProjectProgress.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProjectProgressResponse.model_validate(obj)
    
    @staticmethod
    async def get_projectprogress_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ProjectProgressResponse:
        """
        根据UUID获取项目进度
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ProjectProgressResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectProgress.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目进度 {obj_uuid} 不存在")
        
        return ProjectProgressResponse.model_validate(obj)
    
    @staticmethod
    async def list_projectprogresss(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ProjectProgressResponse]:
        """
        获取项目进度列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ProjectProgressResponse]: 对象列表
        """
        query = ProjectProgress.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ProjectProgressResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_projectprogress(
        tenant_id: int,
        obj_uuid: str,
        data: ProjectProgressUpdate
    ) -> ProjectProgressResponse:
        """
        更新项目进度
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ProjectProgressResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectProgress.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目进度 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ProjectProgressResponse.model_validate(obj)
    
    @staticmethod
    async def delete_projectprogress(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除项目进度（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectProgress.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目进度 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
