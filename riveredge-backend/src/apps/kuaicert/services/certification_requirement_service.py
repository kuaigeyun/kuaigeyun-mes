"""
认证要求服务模块

提供认证要求的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.certification_assessment import CertificationRequirement
from apps.kuaicert.schemas.certification_requirement_schemas import (
    CertificationRequirementCreate, CertificationRequirementUpdate, CertificationRequirementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CertificationRequirementService:
    """认证要求服务"""
    
    @staticmethod
    async def create_certificationrequirement(
        tenant_id: int,
        data: CertificationRequirementCreate
    ) -> CertificationRequirementResponse:
        """
        创建认证要求
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            CertificationRequirementResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await CertificationRequirement.filter(
            tenant_id=tenant_id,
            requirement_no=data.requirement_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"要求编号 {data.requirement_no} 已存在")
        
        # 创建对象
        obj = await CertificationRequirement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CertificationRequirementResponse.model_validate(obj)
    
    @staticmethod
    async def get_certificationrequirement_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> CertificationRequirementResponse:
        """
        根据UUID获取认证要求
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            CertificationRequirementResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationRequirement.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证要求 {obj_uuid} 不存在")
        
        return CertificationRequirementResponse.model_validate(obj)
    
    @staticmethod
    async def list_certificationrequirements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[CertificationRequirementResponse]:
        """
        获取认证要求列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[CertificationRequirementResponse]: 对象列表
        """
        query = CertificationRequirement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [CertificationRequirementResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_certificationrequirement(
        tenant_id: int,
        obj_uuid: str,
        data: CertificationRequirementUpdate
    ) -> CertificationRequirementResponse:
        """
        更新认证要求
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            CertificationRequirementResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationRequirement.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证要求 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return CertificationRequirementResponse.model_validate(obj)
    
    @staticmethod
    async def delete_certificationrequirement(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除认证要求（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationRequirement.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证要求 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
