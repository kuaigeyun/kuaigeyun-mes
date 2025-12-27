"""
项目成本服务模块

提供项目成本的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import ProjectCost
from apps.kuaipm.schemas.project_cost_schemas import (
    ProjectCostCreate, ProjectCostUpdate, ProjectCostResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProjectCostService:
    """项目成本服务"""
    
    @staticmethod
    async def create_projectcost(
        tenant_id: int,
        data: ProjectCostCreate
    ) -> ProjectCostResponse:
        """
        创建项目成本
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ProjectCostResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ProjectCost.filter(
            tenant_id=tenant_id,
            cost_no=data.cost_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"成本编号 {data.cost_no} 已存在")
        
        # 创建对象
        obj = await ProjectCost.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProjectCostResponse.model_validate(obj)
    
    @staticmethod
    async def get_projectcost_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ProjectCostResponse:
        """
        根据UUID获取项目成本
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ProjectCostResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectCost.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目成本 {obj_uuid} 不存在")
        
        return ProjectCostResponse.model_validate(obj)
    
    @staticmethod
    async def list_projectcosts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ProjectCostResponse]:
        """
        获取项目成本列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ProjectCostResponse]: 对象列表
        """
        query = ProjectCost.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ProjectCostResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_projectcost(
        tenant_id: int,
        obj_uuid: str,
        data: ProjectCostUpdate
    ) -> ProjectCostResponse:
        """
        更新项目成本
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ProjectCostResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectCost.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目成本 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ProjectCostResponse.model_validate(obj)
    
    @staticmethod
    async def delete_projectcost(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除项目成本（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectCost.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目成本 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
