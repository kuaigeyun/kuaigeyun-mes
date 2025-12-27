"""
薪资发放服务模块

提供薪资发放的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.salary import SalaryPayment
from apps.kuaihrm.schemas.salary_payment_schemas import (
    SalaryPaymentCreate, SalaryPaymentUpdate, SalaryPaymentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SalaryPaymentService:
    """薪资发放服务"""
    
    @staticmethod
    async def create_salary_payment(
        tenant_id: int,
        data: SalaryPaymentCreate
    ) -> SalaryPaymentResponse:
        """创建薪资发放"""
        existing = await SalaryPayment.filter(
            tenant_id=tenant_id,
            payment_no=data.payment_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"发放编号 {data.payment_no} 已存在")
        
        payment = await SalaryPayment.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SalaryPaymentResponse.model_validate(payment)
    
    @staticmethod
    async def get_salary_payment_by_uuid(
        tenant_id: int,
        payment_uuid: str
    ) -> SalaryPaymentResponse:
        """根据UUID获取薪资发放"""
        payment = await SalaryPayment.filter(
            tenant_id=tenant_id,
            uuid=payment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not payment:
            raise NotFoundError(f"薪资发放 {payment_uuid} 不存在")
        
        return SalaryPaymentResponse.model_validate(payment)
    
    @staticmethod
    async def list_salary_payments(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        employee_id: Optional[int] = None,
        payment_period: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SalaryPaymentResponse]:
        """获取薪资发放列表"""
        query = SalaryPayment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if payment_period:
            query = query.filter(payment_period=payment_period)
        if status:
            query = query.filter(status=status)
        
        payments = await query.offset(skip).limit(limit).all()
        
        return [SalaryPaymentResponse.model_validate(p) for p in payments]
    
    @staticmethod
    async def update_salary_payment(
        tenant_id: int,
        payment_uuid: str,
        data: SalaryPaymentUpdate
    ) -> SalaryPaymentResponse:
        """更新薪资发放"""
        payment = await SalaryPayment.filter(
            tenant_id=tenant_id,
            uuid=payment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not payment:
            raise NotFoundError(f"薪资发放 {payment_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(payment, key, value)
        
        await payment.save()
        
        return SalaryPaymentResponse.model_validate(payment)
    
    @staticmethod
    async def delete_salary_payment(
        tenant_id: int,
        payment_uuid: str
    ) -> None:
        """删除薪资发放（软删除）"""
        payment = await SalaryPayment.filter(
            tenant_id=tenant_id,
            uuid=payment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not payment:
            raise NotFoundError(f"薪资发放 {payment_uuid} 不存在")
        
        from datetime import datetime
        payment.deleted_at = datetime.now()
        await payment.save()

