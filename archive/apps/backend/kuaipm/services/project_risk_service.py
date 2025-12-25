"""
项目风险服务模块

提供项目风险的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaipm.models.project import ProjectRisk
from apps.kuaipm.schemas.project_risk_schemas import (
    ProjectRiskCreate, ProjectRiskUpdate, ProjectRiskResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProjectRiskService:
    """项目风险服务"""
    
    @staticmethod
    async def create_projectrisk(
        tenant_id: int,
        data: ProjectRiskCreate
    ) -> ProjectRiskResponse:
        """
        创建项目风险
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ProjectRiskResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ProjectRisk.filter(
            tenant_id=tenant_id,
            risk_no=data.risk_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"风险编号 {data.risk_no} 已存在")
        
        # 创建对象
        obj = await ProjectRisk.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProjectRiskResponse.model_validate(obj)
    
    @staticmethod
    async def get_projectrisk_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ProjectRiskResponse:
        """
        根据UUID获取项目风险
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ProjectRiskResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectRisk.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目风险 {obj_uuid} 不存在")
        
        return ProjectRiskResponse.model_validate(obj)
    
    @staticmethod
    async def list_projectrisks(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ProjectRiskResponse]:
        """
        获取项目风险列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ProjectRiskResponse]: 对象列表
        """
        query = ProjectRisk.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ProjectRiskResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_projectrisk(
        tenant_id: int,
        obj_uuid: str,
        data: ProjectRiskUpdate
    ) -> ProjectRiskResponse:
        """
        更新项目风险
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ProjectRiskResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectRisk.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目风险 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ProjectRiskResponse.model_validate(obj)
    
    @staticmethod
    async def delete_projectrisk(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除项目风险（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ProjectRisk.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"项目风险 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
