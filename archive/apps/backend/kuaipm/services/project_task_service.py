"""
项目任务服务模块

提供项目任务的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import ProjectTask
from apps.kuaipm.schemas.project_task_schemas import (
    ProjectTaskCreate, ProjectTaskUpdate, ProjectTaskResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProjectTaskService:
    """项目任务服务"""
    
    @staticmethod
    async def create_projecttask(
        tenant_id: int,
        data: ProjectTaskCreate
    ) -> ProjectTaskResponse:
        """
        创建项目任务
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ProjectTaskResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ProjectTask.filter(
            tenant_id=tenant_id,
            task_no=data.task_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"任务编号 {data.task_no} 已存在")
        
        # 创建对象
        obj = await ProjectTask.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProjectTaskResponse.model_validate(obj)
    
    @staticmethod
    async def get_projecttask_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ProjectTaskResponse:
        """
        根据UUID获取项目任务
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ProjectTaskResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectTask.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目任务 {obj_uuid} 不存在")
        
        return ProjectTaskResponse.model_validate(obj)
    
    @staticmethod
    async def list_projecttasks(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ProjectTaskResponse]:
        """
        获取项目任务列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ProjectTaskResponse]: 对象列表
        """
        query = ProjectTask.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ProjectTaskResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_projecttask(
        tenant_id: int,
        obj_uuid: str,
        data: ProjectTaskUpdate
    ) -> ProjectTaskResponse:
        """
        更新项目任务
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ProjectTaskResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectTask.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目任务 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ProjectTaskResponse.model_validate(obj)
    
    @staticmethod
    async def delete_projecttask(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除项目任务（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectTask.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目任务 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
