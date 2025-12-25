"""
项目服务模块

提供项目的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import Project
from apps.kuaipm.schemas.project_schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProjectService:
    """项目服务"""
    
    @staticmethod
    async def create_project(
        tenant_id: int,
        data: ProjectCreate
    ) -> ProjectResponse:
        """
        创建项目
        
        Args:
            tenant_id: 租户ID
            data: 项目创建数据
            
        Returns:
            ProjectResponse: 创建的项目对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Project.filter(
            tenant_id=tenant_id,
            project_no=data.project_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"项目编号 {data.project_no} 已存在")
        
        # 创建项目
        project = await Project.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProjectResponse.model_validate(project)
    
    @staticmethod
    async def get_project_by_uuid(
        tenant_id: int,
        project_uuid: str
    ) -> ProjectResponse:
        """
        根据UUID获取项目
        
        Args:
            tenant_id: 租户ID
            project_uuid: 项目UUID
            
        Returns:
            ProjectResponse: 项目对象
            
        Raises:
            NotFoundError: 当项目不存在时抛出
        """
        project = await Project.filter(
            tenant_id=tenant_id,
            uuid=project_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not project:
            raise NotFoundError(f"项目 {project_uuid} 不存在")
        
        return ProjectResponse.model_validate(project)
    
    @staticmethod
    async def list_projects(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        project_type: Optional[str] = None,
        status: Optional[str] = None,
        manager_id: Optional[int] = None
    ) -> List[ProjectResponse]:
        """
        获取项目列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            project_type: 项目类型（过滤）
            status: 状态（过滤）
            manager_id: 项目经理ID（过滤）
            
        Returns:
            List[ProjectResponse]: 项目列表
        """
        query = Project.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if project_type:
            query = query.filter(project_type=project_type)
        if status:
            query = query.filter(status=status)
        if manager_id:
            query = query.filter(manager_id=manager_id)
        
        projects = await query.offset(skip).limit(limit).all()
        
        return [ProjectResponse.model_validate(project) for project in projects]
    
    @staticmethod
    async def update_project(
        tenant_id: int,
        project_uuid: str,
        data: ProjectUpdate
    ) -> ProjectResponse:
        """
        更新项目
        
        Args:
            tenant_id: 租户ID
            project_uuid: 项目UUID
            data: 项目更新数据
            
        Returns:
            ProjectResponse: 更新后的项目对象
            
        Raises:
            NotFoundError: 当项目不存在时抛出
        """
        project = await Project.filter(
            tenant_id=tenant_id,
            uuid=project_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not project:
            raise NotFoundError(f"项目 {project_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(project, key, value)
        
        await project.save()
        
        return ProjectResponse.model_validate(project)
    
    @staticmethod
    async def delete_project(
        tenant_id: int,
        project_uuid: str
    ) -> None:
        """
        删除项目（软删除）
        
        Args:
            tenant_id: 租户ID
            project_uuid: 项目UUID
            
        Raises:
            NotFoundError: 当项目不存在时抛出
        """
        project = await Project.filter(
            tenant_id=tenant_id,
            uuid=project_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not project:
            raise NotFoundError(f"项目 {project_uuid} 不存在")
        
        from datetime import datetime
        project.deleted_at = datetime.now()
        await project.save()

