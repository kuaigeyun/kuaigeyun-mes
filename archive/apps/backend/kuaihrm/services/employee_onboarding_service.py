"""
员工入职服务模块

提供员工入职的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.employee_transfer import EmployeeOnboarding
from apps.kuaihrm.schemas.employee_onboarding_schemas import (
    EmployeeOnboardingCreate, EmployeeOnboardingUpdate, EmployeeOnboardingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EmployeeOnboardingService:
    """员工入职服务"""
    
    @staticmethod
    async def create_employee_onboarding(
        tenant_id: int,
        data: EmployeeOnboardingCreate
    ) -> EmployeeOnboardingResponse:
        """
        创建员工入职
        
        Args:
            tenant_id: 租户ID
            data: 入职创建数据
            
        Returns:
            EmployeeOnboardingResponse: 创建的入职对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await EmployeeOnboarding.filter(
            tenant_id=tenant_id,
            onboarding_no=data.onboarding_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"入职编号 {data.onboarding_no} 已存在")
        
        # 创建入职
        onboarding = await EmployeeOnboarding.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EmployeeOnboardingResponse.model_validate(onboarding)
    
    @staticmethod
    async def get_employee_onboarding_by_uuid(
        tenant_id: int,
        onboarding_uuid: str
    ) -> EmployeeOnboardingResponse:
        """
        根据UUID获取员工入职
        
        Args:
            tenant_id: 租户ID
            onboarding_uuid: 入职UUID
            
        Returns:
            EmployeeOnboardingResponse: 入职对象
            
        Raises:
            NotFoundError: 当入职不存在时抛出
        """
        onboarding = await EmployeeOnboarding.filter(
            tenant_id=tenant_id,
            uuid=onboarding_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not onboarding:
            raise NotFoundError(f"员工入职 {onboarding_uuid} 不存在")
        
        return EmployeeOnboardingResponse.model_validate(onboarding)
    
    @staticmethod
    async def list_employee_onboardings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        employee_id: Optional[int] = None
    ) -> List[EmployeeOnboardingResponse]:
        """
        获取员工入职列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            employee_id: 员工ID（过滤）
            
        Returns:
            List[EmployeeOnboardingResponse]: 入职列表
        """
        query = EmployeeOnboarding.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if employee_id:
            query = query.filter(employee_id=employee_id)
        
        onboardings = await query.offset(skip).limit(limit).all()
        
        return [EmployeeOnboardingResponse.model_validate(onboarding) for onboarding in onboardings]
    
    @staticmethod
    async def update_employee_onboarding(
        tenant_id: int,
        onboarding_uuid: str,
        data: EmployeeOnboardingUpdate
    ) -> EmployeeOnboardingResponse:
        """
        更新员工入职
        
        Args:
            tenant_id: 租户ID
            onboarding_uuid: 入职UUID
            data: 入职更新数据
            
        Returns:
            EmployeeOnboardingResponse: 更新后的入职对象
            
        Raises:
            NotFoundError: 当入职不存在时抛出
        """
        onboarding = await EmployeeOnboarding.filter(
            tenant_id=tenant_id,
            uuid=onboarding_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not onboarding:
            raise NotFoundError(f"员工入职 {onboarding_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(onboarding, key, value)
        
        await onboarding.save()
        
        return EmployeeOnboardingResponse.model_validate(onboarding)
    
    @staticmethod
    async def delete_employee_onboarding(
        tenant_id: int,
        onboarding_uuid: str
    ) -> None:
        """
        删除员工入职（软删除）
        
        Args:
            tenant_id: 租户ID
            onboarding_uuid: 入职UUID
            
        Raises:
            NotFoundError: 当入职不存在时抛出
        """
        onboarding = await EmployeeOnboarding.filter(
            tenant_id=tenant_id,
            uuid=onboarding_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not onboarding:
            raise NotFoundError(f"员工入职 {onboarding_uuid} 不存在")
        
        from datetime import datetime
        onboarding.deleted_at = datetime.now()
        await onboarding.save()

