"""
报告管理服务模块

提供报告管理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuailims.models.report_management import ReportManagement
from apps.kuailims.schemas.report_management_schemas import (
    ReportManagementCreate, ReportManagementUpdate, ReportManagementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ReportManagementService:
    """报告管理服务"""
    
    @staticmethod
    async def create_report_management(
        tenant_id: int,
        data: ReportManagementCreate
    ) -> ReportManagementResponse:
        """创建报告管理"""
        existing = await ReportManagement.filter(
            tenant_id=tenant_id,
            report_no=data.report_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"报告管理编号 {data.report_no} 已存在")
        
        management = await ReportManagement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ReportManagementResponse.model_validate(management)
    
    @staticmethod
    async def get_report_management_by_uuid(
        tenant_id: int,
        management_uuid: str
    ) -> ReportManagementResponse:
        """根据UUID获取报告管理"""
        management = await ReportManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"报告管理 {management_uuid} 不存在")
        
        return ReportManagementResponse.model_validate(management)
    
    @staticmethod
    async def list_report_managements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        audit_status: Optional[str] = None,
        publish_status: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ReportManagementResponse]:
        """获取报告管理列表"""
        query = ReportManagement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if audit_status:
            query = query.filter(audit_status=audit_status)
        if publish_status:
            query = query.filter(publish_status=publish_status)
        if status:
            query = query.filter(status=status)
        
        managements = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ReportManagementResponse.model_validate(m) for m in managements]
    
    @staticmethod
    async def update_report_management(
        tenant_id: int,
        management_uuid: str,
        data: ReportManagementUpdate
    ) -> ReportManagementResponse:
        """更新报告管理"""
        management = await ReportManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"报告管理 {management_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(management, key, value)
        
        await management.save()
        
        return ReportManagementResponse.model_validate(management)
    
    @staticmethod
    async def delete_report_management(
        tenant_id: int,
        management_uuid: str
    ) -> None:
        """删除报告管理（软删除）"""
        management = await ReportManagement.filter(
            tenant_id=tenant_id,
            uuid=management_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not management:
            raise NotFoundError(f"报告管理 {management_uuid} 不存在")
        
        management.deleted_at = datetime.utcnow()
        await management.save()

