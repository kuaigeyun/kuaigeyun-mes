"""
环保合规服务模块

提供环保合规的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.environment import EnvironmentalCompliance
from apps.kuaiehs.schemas.environmental_compliance_schemas import (
    EnvironmentalComplianceCreate, EnvironmentalComplianceUpdate, EnvironmentalComplianceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EnvironmentalComplianceService:
    """环保合规服务"""
    
    @staticmethod
    async def create_environmentalcompliance(
        tenant_id: int,
        data: EnvironmentalComplianceCreate
    ) -> EnvironmentalComplianceResponse:
        """
        创建环保合规
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            EnvironmentalComplianceResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await EnvironmentalCompliance.filter(
            tenant_id=tenant_id,
            compliance_no=data.compliance_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"合规编号 {data.compliance_no} 已存在")
        
        # 创建对象
        obj = await EnvironmentalCompliance.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EnvironmentalComplianceResponse.model_validate(obj)
    
    @staticmethod
    async def get_environmentalcompliance_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> EnvironmentalComplianceResponse:
        """
        根据UUID获取环保合规
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            EnvironmentalComplianceResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EnvironmentalCompliance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"环保合规 {obj_uuid} 不存在")
        
        return EnvironmentalComplianceResponse.model_validate(obj)
    
    @staticmethod
    async def list_environmentalcompliances(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[EnvironmentalComplianceResponse]:
        """
        获取环保合规列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[EnvironmentalComplianceResponse]: 对象列表
        """
        query = EnvironmentalCompliance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [EnvironmentalComplianceResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_environmentalcompliance(
        tenant_id: int,
        obj_uuid: str,
        data: EnvironmentalComplianceUpdate
    ) -> EnvironmentalComplianceResponse:
        """
        更新环保合规
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            EnvironmentalComplianceResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EnvironmentalCompliance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"环保合规 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return EnvironmentalComplianceResponse.model_validate(obj)
    
    @staticmethod
    async def delete_environmentalcompliance(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除环保合规（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await EnvironmentalCompliance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"环保合规 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
