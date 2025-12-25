"""
目标服务模块

提供目标的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.balanced_scorecard import Objective
from apps.kuaiepm.schemas.objective_schemas import (
    ObjectiveCreate, ObjectiveUpdate, ObjectiveResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ObjectiveService:
    """目标服务"""
    
    @staticmethod
    async def create_objective(
        tenant_id: int,
        data: ObjectiveCreate
    ) -> ObjectiveResponse:
        """
        创建目标
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ObjectiveResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Objective.filter(
            tenant_id=tenant_id,
            objective_no=data.objective_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"目标编号 {data.objective_no} 已存在")
        
        # 创建对象
        obj = await Objective.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ObjectiveResponse.model_validate(obj)
    
    @staticmethod
    async def get_objective_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ObjectiveResponse:
        """
        根据UUID获取目标
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ObjectiveResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Objective.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"目标 {obj_uuid} 不存在")
        
        return ObjectiveResponse.model_validate(obj)
    
    @staticmethod
    async def list_objectives(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ObjectiveResponse]:
        """
        获取目标列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ObjectiveResponse]: 对象列表
        """
        query = Objective.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ObjectiveResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_objective(
        tenant_id: int,
        obj_uuid: str,
        data: ObjectiveUpdate
    ) -> ObjectiveResponse:
        """
        更新目标
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ObjectiveResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Objective.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"目标 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ObjectiveResponse.model_validate(obj)
    
    @staticmethod
    async def delete_objective(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除目标（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Objective.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"目标 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
