"""
审批实例服务模块

提供审批实例的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.approval import ApprovalInstance
from apps.kuaioa.schemas.approval_instance_schemas import (
    ApprovalInstanceCreate, ApprovalInstanceUpdate, ApprovalInstanceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ApprovalInstanceService:
    """审批实例服务"""
    
    @staticmethod
    async def create_approvalinstance(
        tenant_id: int,
        data: ApprovalInstanceCreate
    ) -> ApprovalInstanceResponse:
        """
        创建审批实例
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ApprovalInstanceResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            instance_no=data.instance_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"实例编号 {data.instance_no} 已存在")
        
        # 创建对象
        obj = await ApprovalInstance.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ApprovalInstanceResponse.model_validate(obj)
    
    @staticmethod
    async def get_approvalinstance_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ApprovalInstanceResponse:
        """
        根据UUID获取审批实例
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ApprovalInstanceResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批实例 {obj_uuid} 不存在")
        
        return ApprovalInstanceResponse.model_validate(obj)
    
    @staticmethod
    async def list_approvalinstances(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ApprovalInstanceResponse]:
        """
        获取审批实例列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ApprovalInstanceResponse]: 对象列表
        """
        query = ApprovalInstance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ApprovalInstanceResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_approvalinstance(
        tenant_id: int,
        obj_uuid: str,
        data: ApprovalInstanceUpdate
    ) -> ApprovalInstanceResponse:
        """
        更新审批实例
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ApprovalInstanceResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批实例 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ApprovalInstanceResponse.model_validate(obj)
    
    @staticmethod
    async def delete_approvalinstance(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除审批实例（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批实例 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
