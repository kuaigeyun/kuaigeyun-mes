"""
认证类型服务模块

提供认证类型的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.certification_type import CertificationType
from apps.kuaicert.schemas.certification_type_schemas import (
    CertificationTypeCreate, CertificationTypeUpdate, CertificationTypeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CertificationTypeService:
    """认证类型服务"""
    
    @staticmethod
    async def create_certificationtype(
        tenant_id: int,
        data: CertificationTypeCreate
    ) -> CertificationTypeResponse:
        """
        创建认证类型
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            CertificationTypeResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await CertificationType.filter(
            tenant_id=tenant_id,
            type_code=data.type_code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"类型编码 {data.type_code} 已存在")
        
        # 创建对象
        obj = await CertificationType.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CertificationTypeResponse.model_validate(obj)
    
    @staticmethod
    async def get_certificationtype_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> CertificationTypeResponse:
        """
        根据UUID获取认证类型
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            CertificationTypeResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationType.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证类型 {obj_uuid} 不存在")
        
        return CertificationTypeResponse.model_validate(obj)
    
    @staticmethod
    async def list_certificationtypes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[CertificationTypeResponse]:
        """
        获取认证类型列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[CertificationTypeResponse]: 对象列表
        """
        query = CertificationType.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [CertificationTypeResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_certificationtype(
        tenant_id: int,
        obj_uuid: str,
        data: CertificationTypeUpdate
    ) -> CertificationTypeResponse:
        """
        更新认证类型
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            CertificationTypeResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationType.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证类型 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return CertificationTypeResponse.model_validate(obj)
    
    @staticmethod
    async def delete_certificationtype(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除认证类型（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationType.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证类型 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
