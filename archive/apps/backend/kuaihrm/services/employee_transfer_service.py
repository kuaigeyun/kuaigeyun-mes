"""
员工异动服务模块

提供员工异动的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.employee_transfer import EmployeeTransfer
from apps.kuaihrm.schemas.employee_transfer_schemas import (
    EmployeeTransferCreate, EmployeeTransferUpdate, EmployeeTransferResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EmployeeTransferService:
    """员工异动服务"""
    
    @staticmethod
    async def create_employee_transfer(
        tenant_id: int,
        data: EmployeeTransferCreate
    ) -> EmployeeTransferResponse:
        """创建员工异动"""
        existing = await EmployeeTransfer.filter(
            tenant_id=tenant_id,
            transfer_no=data.transfer_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"异动编号 {data.transfer_no} 已存在")
        
        transfer = await EmployeeTransfer.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EmployeeTransferResponse.model_validate(transfer)
    
    @staticmethod
    async def get_employee_transfer_by_uuid(
        tenant_id: int,
        transfer_uuid: str
    ) -> EmployeeTransferResponse:
        """根据UUID获取员工异动"""
        transfer = await EmployeeTransfer.filter(
            tenant_id=tenant_id,
            uuid=transfer_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not transfer:
            raise NotFoundError(f"员工异动 {transfer_uuid} 不存在")
        
        return EmployeeTransferResponse.model_validate(transfer)
    
    @staticmethod
    async def list_employee_transfers(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        employee_id: Optional[int] = None,
        transfer_type: Optional[str] = None
    ) -> List[EmployeeTransferResponse]:
        """获取员工异动列表"""
        query = EmployeeTransfer.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if transfer_type:
            query = query.filter(transfer_type=transfer_type)
        
        transfers = await query.offset(skip).limit(limit).all()
        
        return [EmployeeTransferResponse.model_validate(t) for t in transfers]
    
    @staticmethod
    async def update_employee_transfer(
        tenant_id: int,
        transfer_uuid: str,
        data: EmployeeTransferUpdate
    ) -> EmployeeTransferResponse:
        """更新员工异动"""
        transfer = await EmployeeTransfer.filter(
            tenant_id=tenant_id,
            uuid=transfer_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not transfer:
            raise NotFoundError(f"员工异动 {transfer_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(transfer, key, value)
        
        await transfer.save()
        
        return EmployeeTransferResponse.model_validate(transfer)
    
    @staticmethod
    async def delete_employee_transfer(
        tenant_id: int,
        transfer_uuid: str
    ) -> None:
        """删除员工异动（软删除）"""
        transfer = await EmployeeTransfer.filter(
            tenant_id=tenant_id,
            uuid=transfer_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not transfer:
            raise NotFoundError(f"员工异动 {transfer_uuid} 不存在")
        
        from datetime import datetime
        transfer.deleted_at = datetime.now()
        await transfer.save()

