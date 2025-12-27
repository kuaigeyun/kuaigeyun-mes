"""
ISO质量审核服务模块

提供ISO质量审核的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.iso_audit import ISOAudit
from apps.kuaiqms.schemas.iso_audit_schemas import (
    ISOAuditCreate, ISOAuditUpdate, ISOAuditResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ISOAuditService:
    """ISO质量审核服务"""
    
    @staticmethod
    async def create_iso_audit(
        tenant_id: int,
        data: ISOAuditCreate
    ) -> ISOAuditResponse:
        """创建ISO质量审核"""
        existing = await ISOAudit.filter(
            tenant_id=tenant_id,
            audit_no=data.audit_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"审核编号 {data.audit_no} 已存在")
        
        audit = await ISOAudit.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ISOAuditResponse.model_validate(audit)
    
    @staticmethod
    async def get_iso_audit_by_uuid(
        tenant_id: int,
        audit_uuid: str
    ) -> ISOAuditResponse:
        """根据UUID获取ISO质量审核"""
        audit = await ISOAudit.filter(
            tenant_id=tenant_id,
            uuid=audit_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not audit:
            raise NotFoundError(f"ISO质量审核 {audit_uuid} 不存在")
        
        return ISOAuditResponse.model_validate(audit)
    
    @staticmethod
    async def list_iso_audits(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        audit_type: Optional[str] = None,
        iso_standard: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ISOAuditResponse]:
        """获取ISO质量审核列表"""
        query = ISOAudit.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if audit_type:
            query = query.filter(audit_type=audit_type)
        if iso_standard:
            query = query.filter(iso_standard=iso_standard)
        if status:
            query = query.filter(status=status)
        
        audits = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ISOAuditResponse.model_validate(a) for a in audits]
    
    @staticmethod
    async def update_iso_audit(
        tenant_id: int,
        audit_uuid: str,
        data: ISOAuditUpdate
    ) -> ISOAuditResponse:
        """更新ISO质量审核"""
        audit = await ISOAudit.filter(
            tenant_id=tenant_id,
            uuid=audit_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not audit:
            raise NotFoundError(f"ISO质量审核 {audit_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(audit, key, value)
        
        await audit.save()
        
        return ISOAuditResponse.model_validate(audit)
    
    @staticmethod
    async def delete_iso_audit(
        tenant_id: int,
        audit_uuid: str
    ) -> None:
        """删除ISO质量审核（软删除）"""
        audit = await ISOAudit.filter(
            tenant_id=tenant_id,
            uuid=audit_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not audit:
            raise NotFoundError(f"ISO质量审核 {audit_uuid} 不存在")
        
        audit.deleted_at = datetime.utcnow()
        await audit.save()
