"""
安全隐患服务模块

提供安全隐患的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.safety import SafetyHazard
from apps.kuaiehs.schemas.safety_hazard_schemas import (
    SafetyHazardCreate, SafetyHazardUpdate, SafetyHazardResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SafetyHazardService:
    """安全隐患服务"""
    
    @staticmethod
    async def create_safetyhazard(
        tenant_id: int,
        data: SafetyHazardCreate
    ) -> SafetyHazardResponse:
        """
        创建安全隐患
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            SafetyHazardResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SafetyHazard.filter(
            tenant_id=tenant_id,
            hazard_no=data.hazard_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"隐患编号 {data.hazard_no} 已存在")
        
        # 创建对象
        obj = await SafetyHazard.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SafetyHazardResponse.model_validate(obj)
    
    @staticmethod
    async def get_safetyhazard_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> SafetyHazardResponse:
        """
        根据UUID获取安全隐患
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            SafetyHazardResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyHazard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全隐患 {obj_uuid} 不存在")
        
        return SafetyHazardResponse.model_validate(obj)
    
    @staticmethod
    async def list_safetyhazards(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[SafetyHazardResponse]:
        """
        获取安全隐患列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[SafetyHazardResponse]: 对象列表
        """
        query = SafetyHazard.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [SafetyHazardResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_safetyhazard(
        tenant_id: int,
        obj_uuid: str,
        data: SafetyHazardUpdate
    ) -> SafetyHazardResponse:
        """
        更新安全隐患
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            SafetyHazardResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyHazard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全隐患 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return SafetyHazardResponse.model_validate(obj)
    
    @staticmethod
    async def delete_safetyhazard(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除安全隐患（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyHazard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全隐患 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
