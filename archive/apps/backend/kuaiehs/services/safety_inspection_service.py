"""
安全检查服务模块

提供安全检查的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.safety import SafetyInspection
from apps.kuaiehs.schemas.safety_inspection_schemas import (
    SafetyInspectionCreate, SafetyInspectionUpdate, SafetyInspectionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SafetyInspectionService:
    """安全检查服务"""
    
    @staticmethod
    async def create_safetyinspection(
        tenant_id: int,
        data: SafetyInspectionCreate
    ) -> SafetyInspectionResponse:
        """
        创建安全检查
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            SafetyInspectionResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SafetyInspection.filter(
            tenant_id=tenant_id,
            inspection_no=data.inspection_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"检查编号 {data.inspection_no} 已存在")
        
        # 创建对象
        obj = await SafetyInspection.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SafetyInspectionResponse.model_validate(obj)
    
    @staticmethod
    async def get_safetyinspection_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> SafetyInspectionResponse:
        """
        根据UUID获取安全检查
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            SafetyInspectionResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyInspection.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全检查 {obj_uuid} 不存在")
        
        return SafetyInspectionResponse.model_validate(obj)
    
    @staticmethod
    async def list_safetyinspections(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[SafetyInspectionResponse]:
        """
        获取安全检查列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[SafetyInspectionResponse]: 对象列表
        """
        query = SafetyInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [SafetyInspectionResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_safetyinspection(
        tenant_id: int,
        obj_uuid: str,
        data: SafetyInspectionUpdate
    ) -> SafetyInspectionResponse:
        """
        更新安全检查
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            SafetyInspectionResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyInspection.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全检查 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return SafetyInspectionResponse.model_validate(obj)
    
    @staticmethod
    async def delete_safetyinspection(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除安全检查（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyInspection.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全检查 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
