"""
社保个税服务模块

提供社保个税的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.salary import SocialSecurityTax
from apps.kuaihrm.schemas.social_security_tax_schemas import (
    SocialSecurityTaxCreate, SocialSecurityTaxUpdate, SocialSecurityTaxResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SocialSecurityTaxService:
    """社保个税服务"""
    
    @staticmethod
    async def create_social_security_tax(
        tenant_id: int,
        data: SocialSecurityTaxCreate
    ) -> SocialSecurityTaxResponse:
        """创建社保个税"""
        tax = await SocialSecurityTax.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SocialSecurityTaxResponse.model_validate(tax)
    
    @staticmethod
    async def get_social_security_tax_by_uuid(
        tenant_id: int,
        tax_uuid: str
    ) -> SocialSecurityTaxResponse:
        """根据UUID获取社保个税"""
        tax = await SocialSecurityTax.filter(
            tenant_id=tenant_id,
            uuid=tax_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not tax:
            raise NotFoundError(f"社保个税 {tax_uuid} 不存在")
        
        return SocialSecurityTaxResponse.model_validate(tax)
    
    @staticmethod
    async def list_social_security_taxes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        employee_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[SocialSecurityTaxResponse]:
        """获取社保个税列表"""
        query = SocialSecurityTax.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if status:
            query = query.filter(status=status)
        
        taxes = await query.offset(skip).limit(limit).all()
        
        return [SocialSecurityTaxResponse.model_validate(t) for t in taxes]
    
    @staticmethod
    async def update_social_security_tax(
        tenant_id: int,
        tax_uuid: str,
        data: SocialSecurityTaxUpdate
    ) -> SocialSecurityTaxResponse:
        """更新社保个税"""
        tax = await SocialSecurityTax.filter(
            tenant_id=tenant_id,
            uuid=tax_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not tax:
            raise NotFoundError(f"社保个税 {tax_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(tax, key, value)
        
        await tax.save()
        
        return SocialSecurityTaxResponse.model_validate(tax)
    
    @staticmethod
    async def delete_social_security_tax(
        tenant_id: int,
        tax_uuid: str
    ) -> None:
        """删除社保个税（软删除）"""
        tax = await SocialSecurityTax.filter(
            tenant_id=tenant_id,
            uuid=tax_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not tax:
            raise NotFoundError(f"社保个税 {tax_uuid} 不存在")
        
        from datetime import datetime
        tax.deleted_at = datetime.now()
        await tax.save()

