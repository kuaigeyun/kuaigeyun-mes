"""
员工离职服务模块

提供员工离职的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.employee_transfer import EmployeeResignation
from apps.kuaihrm.schemas.employee_resignation_schemas import (
    EmployeeResignationCreate, EmployeeResignationUpdate, EmployeeResignationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EmployeeResignationService:
    """员工离职服务"""
    
    @staticmethod
    async def create_employee_resignation(
        tenant_id: int,
        data: EmployeeResignationCreate
    ) -> EmployeeResignationResponse:
        """创建员工离职"""
        existing = await EmployeeResignation.filter(
            tenant_id=tenant_id,
            resignation_no=data.resignation_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"离职编号 {data.resignation_no} 已存在")
        
        resignation = await EmployeeResignation.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EmployeeResignationResponse.model_validate(resignation)
    
    @staticmethod
    async def get_employee_resignation_by_uuid(
        tenant_id: int,
        resignation_uuid: str
    ) -> EmployeeResignationResponse:
        """根据UUID获取员工离职"""
        resignation = await EmployeeResignation.filter(
            tenant_id=tenant_id,
            uuid=resignation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not resignation:
            raise NotFoundError(f"员工离职 {resignation_uuid} 不存在")
        
        return EmployeeResignationResponse.model_validate(resignation)
    
    @staticmethod
    async def list_employee_resignations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        employee_id: Optional[int] = None
    ) -> List[EmployeeResignationResponse]:
        """获取员工离职列表"""
        query = EmployeeResignation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if employee_id:
            query = query.filter(employee_id=employee_id)
        
        resignations = await query.offset(skip).limit(limit).all()
        
        return [EmployeeResignationResponse.model_validate(r) for r in resignations]
    
    @staticmethod
    async def update_employee_resignation(
        tenant_id: int,
        resignation_uuid: str,
        data: EmployeeResignationUpdate
    ) -> EmployeeResignationResponse:
        """更新员工离职"""
        resignation = await EmployeeResignation.filter(
            tenant_id=tenant_id,
            uuid=resignation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not resignation:
            raise NotFoundError(f"员工离职 {resignation_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(resignation, key, value)
        
        await resignation.save()
        
        return EmployeeResignationResponse.model_validate(resignation)
    
    @staticmethod
    async def delete_employee_resignation(
        tenant_id: int,
        resignation_uuid: str
    ) -> None:
        """删除员工离职（软删除）"""
        resignation = await EmployeeResignation.filter(
            tenant_id=tenant_id,
            uuid=resignation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not resignation:
            raise NotFoundError(f"员工离职 {resignation_uuid} 不存在")
        
        from datetime import datetime
        resignation.deleted_at = datetime.now()
        await resignation.save()

