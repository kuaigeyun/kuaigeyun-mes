"""
工程变更服务模块

提供工程变更的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaipdm.models.engineering_change import EngineeringChange
from apps.kuaipdm.schemas.engineering_change_schemas import (
    EngineeringChangeCreate, EngineeringChangeUpdate, EngineeringChangeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EngineeringChangeService:
    """工程变更服务"""
    
    @staticmethod
    async def create_engineering_change(
        tenant_id: int,
        data: EngineeringChangeCreate
    ) -> EngineeringChangeResponse:
        """
        创建工程变更
        
        Args:
            tenant_id: 租户ID
            data: 变更创建数据
            
        Returns:
            EngineeringChangeResponse: 创建的变更对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await EngineeringChange.filter(
            tenant_id=tenant_id,
            change_no=data.change_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"变更编号 {data.change_no} 已存在")
        
        # 创建变更
        change = await EngineeringChange.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EngineeringChangeResponse.model_validate(change)
    
    @staticmethod
    async def get_engineering_change_by_uuid(
        tenant_id: int,
        change_uuid: str
    ) -> EngineeringChangeResponse:
        """
        根据UUID获取工程变更
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更UUID
            
        Returns:
            EngineeringChangeResponse: 变更对象
            
        Raises:
            NotFoundError: 当变更不存在时抛出
        """
        change = await EngineeringChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not change:
            raise NotFoundError(f"工程变更 {change_uuid} 不存在")
        
        return EngineeringChangeResponse.model_validate(change)
    
    @staticmethod
    async def list_engineering_changes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        change_type: Optional[str] = None
    ) -> List[EngineeringChangeResponse]:
        """
        获取工程变更列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 变更状态（过滤）
            change_type: 变更类型（过滤）
            
        Returns:
            List[EngineeringChangeResponse]: 变更列表
        """
        query = EngineeringChange.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if change_type:
            query = query.filter(change_type=change_type)
        
        changes = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [EngineeringChangeResponse.model_validate(change) for change in changes]
    
    @staticmethod
    async def update_engineering_change(
        tenant_id: int,
        change_uuid: str,
        data: EngineeringChangeUpdate
    ) -> EngineeringChangeResponse:
        """
        更新工程变更
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更UUID
            data: 变更更新数据
            
        Returns:
            EngineeringChangeResponse: 更新后的变更对象
            
        Raises:
            NotFoundError: 当变更不存在时抛出
        """
        change = await EngineeringChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not change:
            raise NotFoundError(f"工程变更 {change_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(change, key, value)
        
        await change.save()
        
        return EngineeringChangeResponse.model_validate(change)
    
    @staticmethod
    async def delete_engineering_change(
        tenant_id: int,
        change_uuid: str
    ) -> None:
        """
        删除工程变更（软删除）
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更UUID
            
        Raises:
            NotFoundError: 当变更不存在时抛出
        """
        change = await EngineeringChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not change:
            raise NotFoundError(f"工程变更 {change_uuid} 不存在")
        
        change.deleted_at = datetime.utcnow()
        await change.save()
