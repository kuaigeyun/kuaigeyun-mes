"""
法规服务模块

提供法规的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.compliance import Regulation
from apps.kuaiehs.schemas.regulation_schemas import (
    RegulationCreate, RegulationUpdate, RegulationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class RegulationService:
    """法规服务"""
    
    @staticmethod
    async def create_regulation(
        tenant_id: int,
        data: RegulationCreate
    ) -> RegulationResponse:
        """
        创建法规
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            RegulationResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Regulation.filter(
            tenant_id=tenant_id,
            regulation_no=data.regulation_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"法规编号 {data.regulation_no} 已存在")
        
        # 创建对象
        obj = await Regulation.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return RegulationResponse.model_validate(obj)
    
    @staticmethod
    async def get_regulation_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> RegulationResponse:
        """
        根据UUID获取法规
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            RegulationResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Regulation.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"法规 {obj_uuid} 不存在")
        
        return RegulationResponse.model_validate(obj)
    
    @staticmethod
    async def list_regulations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[RegulationResponse]:
        """
        获取法规列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[RegulationResponse]: 对象列表
        """
        query = Regulation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [RegulationResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_regulation(
        tenant_id: int,
        obj_uuid: str,
        data: RegulationUpdate
    ) -> RegulationResponse:
        """
        更新法规
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            RegulationResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Regulation.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"法规 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return RegulationResponse.model_validate(obj)
    
    @staticmethod
    async def delete_regulation(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除法规（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Regulation.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"法规 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
