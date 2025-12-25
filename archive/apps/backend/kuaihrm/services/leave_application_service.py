"""
请假申请服务模块

提供请假申请的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.attendance import LeaveApplication
from apps.kuaihrm.schemas.leave_application_schemas import (
    LeaveApplicationCreate, LeaveApplicationUpdate, LeaveApplicationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class LeaveApplicationService:
    """请假申请服务"""
    
    @staticmethod
    async def create_leave_application(
        tenant_id: int,
        data: LeaveApplicationCreate
    ) -> LeaveApplicationResponse:
        """创建请假申请"""
        existing = await LeaveApplication.filter(
            tenant_id=tenant_id,
            application_no=data.application_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"申请编号 {data.application_no} 已存在")
        
        application = await LeaveApplication.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return LeaveApplicationResponse.model_validate(application)
    
    @staticmethod
    async def get_leave_application_by_uuid(
        tenant_id: int,
        application_uuid: str
    ) -> LeaveApplicationResponse:
        """根据UUID获取请假申请"""
        application = await LeaveApplication.filter(
            tenant_id=tenant_id,
            uuid=application_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not application:
            raise NotFoundError(f"请假申请 {application_uuid} 不存在")
        
        return LeaveApplicationResponse.model_validate(application)
    
    @staticmethod
    async def list_leave_applications(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        employee_id: Optional[int] = None,
        leave_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[LeaveApplicationResponse]:
        """获取请假申请列表"""
        query = LeaveApplication.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if leave_type:
            query = query.filter(leave_type=leave_type)
        if status:
            query = query.filter(status=status)
        
        applications = await query.offset(skip).limit(limit).all()
        
        return [LeaveApplicationResponse.model_validate(a) for a in applications]
    
    @staticmethod
    async def update_leave_application(
        tenant_id: int,
        application_uuid: str,
        data: LeaveApplicationUpdate
    ) -> LeaveApplicationResponse:
        """更新请假申请"""
        application = await LeaveApplication.filter(
            tenant_id=tenant_id,
            uuid=application_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not application:
            raise NotFoundError(f"请假申请 {application_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(application, key, value)
        
        await application.save()
        
        return LeaveApplicationResponse.model_validate(application)
    
    @staticmethod
    async def delete_leave_application(
        tenant_id: int,
        application_uuid: str
    ) -> None:
        """删除请假申请（软删除）"""
        application = await LeaveApplication.filter(
            tenant_id=tenant_id,
            uuid=application_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not application:
            raise NotFoundError(f"请假申请 {application_uuid} 不存在")
        
        from datetime import datetime
        application.deleted_at = datetime.now()
        await application.save()

