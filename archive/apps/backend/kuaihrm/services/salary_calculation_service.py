"""
薪资计算服务模块

提供薪资计算的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.salary import SalaryCalculation
from apps.kuaihrm.schemas.salary_calculation_schemas import (
    SalaryCalculationCreate, SalaryCalculationUpdate, SalaryCalculationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SalaryCalculationService:
    """薪资计算服务"""
    
    @staticmethod
    async def create_salary_calculation(
        tenant_id: int,
        data: SalaryCalculationCreate
    ) -> SalaryCalculationResponse:
        """创建薪资计算"""
        existing = await SalaryCalculation.filter(
            tenant_id=tenant_id,
            calculation_no=data.calculation_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"计算编号 {data.calculation_no} 已存在")
        
        calculation = await SalaryCalculation.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SalaryCalculationResponse.model_validate(calculation)
    
    @staticmethod
    async def get_salary_calculation_by_uuid(
        tenant_id: int,
        calculation_uuid: str
    ) -> SalaryCalculationResponse:
        """根据UUID获取薪资计算"""
        calculation = await SalaryCalculation.filter(
            tenant_id=tenant_id,
            uuid=calculation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not calculation:
            raise NotFoundError(f"薪资计算 {calculation_uuid} 不存在")
        
        return SalaryCalculationResponse.model_validate(calculation)
    
    @staticmethod
    async def list_salary_calculations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        employee_id: Optional[int] = None,
        salary_period: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[SalaryCalculationResponse]:
        """获取薪资计算列表"""
        query = SalaryCalculation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if salary_period:
            query = query.filter(salary_period=salary_period)
        if status:
            query = query.filter(status=status)
        
        calculations = await query.offset(skip).limit(limit).all()
        
        return [SalaryCalculationResponse.model_validate(c) for c in calculations]
    
    @staticmethod
    async def update_salary_calculation(
        tenant_id: int,
        calculation_uuid: str,
        data: SalaryCalculationUpdate
    ) -> SalaryCalculationResponse:
        """更新薪资计算"""
        calculation = await SalaryCalculation.filter(
            tenant_id=tenant_id,
            uuid=calculation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not calculation:
            raise NotFoundError(f"薪资计算 {calculation_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(calculation, key, value)
        
        await calculation.save()
        
        return SalaryCalculationResponse.model_validate(calculation)
    
    @staticmethod
    async def delete_salary_calculation(
        tenant_id: int,
        calculation_uuid: str
    ) -> None:
        """删除薪资计算（软删除）"""
        calculation = await SalaryCalculation.filter(
            tenant_id=tenant_id,
            uuid=calculation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not calculation:
            raise NotFoundError(f"薪资计算 {calculation_uuid} 不存在")
        
        from datetime import datetime
        calculation.deleted_at = datetime.now()
        await calculation.save()

