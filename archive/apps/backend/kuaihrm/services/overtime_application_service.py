"""
加班申请服务模块

提供加班申请的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.attendance import OvertimeApplication
from apps.kuaihrm.schemas.overtime_application_schemas import (
    OvertimeApplicationCreate, OvertimeApplicationUpdate, OvertimeApplicationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OvertimeApplicationService:
    """加班申请服务"""
    
    @staticmethod
    async def create_overtime_application(
        tenant_id: int,
        data: OvertimeApplicationCreate
    ) -> OvertimeApplicationResponse:
        """创建加班申请"""
        existing = await OvertimeApplication.filter(
            tenant_id=tenant_id,
            application_no=data.application_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"申请编号 {data.application_no} 已存在")
        
        application = await OvertimeApplication.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OvertimeApplicationResponse.model_validate(application)
    
    @staticmethod
    async def get_overtime_application_by_uuid(
        tenant_id: int,
        application_uuid: str
    ) -> OvertimeApplicationResponse:
        """根据UUID获取加班申请"""
        application = await OvertimeApplication.filter(
            tenant_id=tenant_id,
            uuid=application_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not application:
            raise NotFoundError(f"加班申请 {application_uuid} 不存在")
        
        return OvertimeApplicationResponse.model_validate(application)
    
    @staticmethod
    async def list_overtime_applications(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        employee_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[OvertimeApplicationResponse]:
        """获取加班申请列表"""
        query = OvertimeApplication.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if status:
            query = query.filter(status=status)
        
        applications = await query.offset(skip).limit(limit).all()
        
        return [OvertimeApplicationResponse.model_validate(a) for a in applications]
    
    @staticmethod
    async def update_overtime_application(
        tenant_id: int,
        application_uuid: str,
        data: OvertimeApplicationUpdate
    ) -> OvertimeApplicationResponse:
        """更新加班申请"""
        application = await OvertimeApplication.filter(
            tenant_id=tenant_id,
            uuid=application_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not application:
            raise NotFoundError(f"加班申请 {application_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(application, key, value)
        
        await application.save()
        
        return OvertimeApplicationResponse.model_validate(application)
    
    @staticmethod
    async def delete_overtime_application(
        tenant_id: int,
        application_uuid: str
    ) -> None:
        """删除加班申请（软删除）"""
        application = await OvertimeApplication.filter(
            tenant_id=tenant_id,
            uuid=application_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not application:
            raise NotFoundError(f"加班申请 {application_uuid} 不存在")
        
        from datetime import datetime
        application.deleted_at = datetime.now()
        await application.save()

