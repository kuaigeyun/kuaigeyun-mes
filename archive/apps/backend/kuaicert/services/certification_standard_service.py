"""
认证标准服务模块

提供认证标准的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.certification_type import CertificationStandard
from apps.kuaicert.schemas.certification_standard_schemas import (
    CertificationStandardCreate, CertificationStandardUpdate, CertificationStandardResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CertificationStandardService:
    """认证标准服务"""
    
    @staticmethod
    async def create_certificationstandard(
        tenant_id: int,
        data: CertificationStandardCreate
    ) -> CertificationStandardResponse:
        """
        创建认证标准
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            CertificationStandardResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await CertificationStandard.filter(
            tenant_id=tenant_id,
            standard_no=data.standard_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"标准编号 {data.standard_no} 已存在")
        
        # 创建对象
        obj = await CertificationStandard.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CertificationStandardResponse.model_validate(obj)
    
    @staticmethod
    async def get_certificationstandard_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> CertificationStandardResponse:
        """
        根据UUID获取认证标准
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            CertificationStandardResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationStandard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证标准 {obj_uuid} 不存在")
        
        return CertificationStandardResponse.model_validate(obj)
    
    @staticmethod
    async def list_certificationstandards(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[CertificationStandardResponse]:
        """
        获取认证标准列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[CertificationStandardResponse]: 对象列表
        """
        query = CertificationStandard.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [CertificationStandardResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_certificationstandard(
        tenant_id: int,
        obj_uuid: str,
        data: CertificationStandardUpdate
    ) -> CertificationStandardResponse:
        """
        更新认证标准
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            CertificationStandardResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationStandard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证标准 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return CertificationStandardResponse.model_validate(obj)
    
    @staticmethod
    async def delete_certificationstandard(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除认证标准（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationStandard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证标准 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
