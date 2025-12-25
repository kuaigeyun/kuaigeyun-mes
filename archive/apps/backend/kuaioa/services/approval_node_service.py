"""
审批节点服务模块

提供审批节点的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.approval import ApprovalNode
from apps.kuaioa.schemas.approval_node_schemas import (
    ApprovalNodeCreate, ApprovalNodeUpdate, ApprovalNodeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ApprovalNodeService:
    """审批节点服务"""
    
    @staticmethod
    async def create_approvalnode(
        tenant_id: int,
        data: ApprovalNodeCreate
    ) -> ApprovalNodeResponse:
        """
        创建审批节点
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ApprovalNodeResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ApprovalNode.filter(
            tenant_id=tenant_id,
            node_no=data.node_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"节点编号 {data.node_no} 已存在")
        
        # 创建对象
        obj = await ApprovalNode.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ApprovalNodeResponse.model_validate(obj)
    
    @staticmethod
    async def get_approvalnode_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ApprovalNodeResponse:
        """
        根据UUID获取审批节点
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ApprovalNodeResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalNode.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批节点 {obj_uuid} 不存在")
        
        return ApprovalNodeResponse.model_validate(obj)
    
    @staticmethod
    async def list_approvalnodes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ApprovalNodeResponse]:
        """
        获取审批节点列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ApprovalNodeResponse]: 对象列表
        """
        query = ApprovalNode.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ApprovalNodeResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_approvalnode(
        tenant_id: int,
        obj_uuid: str,
        data: ApprovalNodeUpdate
    ) -> ApprovalNodeResponse:
        """
        更新审批节点
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ApprovalNodeResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalNode.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批节点 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ApprovalNodeResponse.model_validate(obj)
    
    @staticmethod
    async def delete_approvalnode(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除审批节点（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalNode.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批节点 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
