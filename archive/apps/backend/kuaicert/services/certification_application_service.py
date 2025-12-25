"""
认证申请服务模块

提供认证申请的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.certification_management import CertificationApplication
from apps.kuaicert.schemas.certification_application_schemas import (
    CertificationApplicationCreate, CertificationApplicationUpdate, CertificationApplicationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CertificationApplicationService:
    """认证申请服务"""
    
    @staticmethod
    async def create_certificationapplication(
        tenant_id: int,
        data: CertificationApplicationCreate
    ) -> CertificationApplicationResponse:
        """
        创建认证申请
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            CertificationApplicationResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await CertificationApplication.filter(
            tenant_id=tenant_id,
            application_no=data.application_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"申请编号 {data.application_no} 已存在")
        
        # 创建对象
        obj = await CertificationApplication.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CertificationApplicationResponse.model_validate(obj)
    
    @staticmethod
    async def get_certificationapplication_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> CertificationApplicationResponse:
        """
        根据UUID获取认证申请
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            CertificationApplicationResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationApplication.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证申请 {obj_uuid} 不存在")
        
        return CertificationApplicationResponse.model_validate(obj)
    
    @staticmethod
    async def list_certificationapplications(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[CertificationApplicationResponse]:
        """
        获取认证申请列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[CertificationApplicationResponse]: 对象列表
        """
        query = CertificationApplication.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [CertificationApplicationResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_certificationapplication(
        tenant_id: int,
        obj_uuid: str,
        data: CertificationApplicationUpdate
    ) -> CertificationApplicationResponse:
        """
        更新认证申请
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            CertificationApplicationResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationApplication.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证申请 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return CertificationApplicationResponse.model_validate(obj)
    
    @staticmethod
    async def delete_certificationapplication(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除认证申请（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationApplication.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证申请 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
