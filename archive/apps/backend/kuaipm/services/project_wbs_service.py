"""
项目WBS服务模块

提供项目WBS的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import ProjectWBS
from apps.kuaipm.schemas.project_wbs_schemas import (
    ProjectWBSCreate, ProjectWBSUpdate, ProjectWBSResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProjectWBSService:
    """项目WBS服务"""
    
    @staticmethod
    async def create_projectwbs(
        tenant_id: int,
        data: ProjectWBSCreate
    ) -> ProjectWBSResponse:
        """
        创建项目WBS
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ProjectWBSResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ProjectWBS.filter(
            tenant_id=tenant_id,
            wbs_code=data.wbs_code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"WBS编码 {data.wbs_code} 已存在")
        
        # 创建对象
        obj = await ProjectWBS.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProjectWBSResponse.model_validate(obj)
    
    @staticmethod
    async def get_projectwbs_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ProjectWBSResponse:
        """
        根据UUID获取项目WBS
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ProjectWBSResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectWBS.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目WBS {obj_uuid} 不存在")
        
        return ProjectWBSResponse.model_validate(obj)
    
    @staticmethod
    async def list_projectwbss(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ProjectWBSResponse]:
        """
        获取项目WBS列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ProjectWBSResponse]: 对象列表
        """
        query = ProjectWBS.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ProjectWBSResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_projectwbs(
        tenant_id: int,
        obj_uuid: str,
        data: ProjectWBSUpdate
    ) -> ProjectWBSResponse:
        """
        更新项目WBS
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ProjectWBSResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectWBS.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目WBS {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ProjectWBSResponse.model_validate(obj)
    
    @staticmethod
    async def delete_projectwbs(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除项目WBS（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectWBS.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目WBS {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
