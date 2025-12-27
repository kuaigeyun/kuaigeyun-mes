"""
安全事故服务模块

提供安全事故的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.safety import SafetyIncident
from apps.kuaiehs.schemas.safety_incident_schemas import (
    SafetyIncidentCreate, SafetyIncidentUpdate, SafetyIncidentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SafetyIncidentService:
    """安全事故服务"""
    
    @staticmethod
    async def create_safetyincident(
        tenant_id: int,
        data: SafetyIncidentCreate
    ) -> SafetyIncidentResponse:
        """
        创建安全事故
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            SafetyIncidentResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SafetyIncident.filter(
            tenant_id=tenant_id,
            incident_no=data.incident_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"事故编号 {data.incident_no} 已存在")
        
        # 创建对象
        obj = await SafetyIncident.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SafetyIncidentResponse.model_validate(obj)
    
    @staticmethod
    async def get_safetyincident_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> SafetyIncidentResponse:
        """
        根据UUID获取安全事故
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            SafetyIncidentResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyIncident.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全事故 {obj_uuid} 不存在")
        
        return SafetyIncidentResponse.model_validate(obj)
    
    @staticmethod
    async def list_safetyincidents(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[SafetyIncidentResponse]:
        """
        获取安全事故列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[SafetyIncidentResponse]: 对象列表
        """
        query = SafetyIncident.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [SafetyIncidentResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_safetyincident(
        tenant_id: int,
        obj_uuid: str,
        data: SafetyIncidentUpdate
    ) -> SafetyIncidentResponse:
        """
        更新安全事故
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            SafetyIncidentResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyIncident.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全事故 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return SafetyIncidentResponse.model_validate(obj)
    
    @staticmethod
    async def delete_safetyincident(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除安全事故（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyIncident.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全事故 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
