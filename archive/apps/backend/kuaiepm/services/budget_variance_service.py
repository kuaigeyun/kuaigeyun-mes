"""
预算差异服务模块

提供预算差异的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.budget_analysis import BudgetVariance
from apps.kuaiepm.schemas.budget_variance_schemas import (
    BudgetVarianceCreate, BudgetVarianceUpdate, BudgetVarianceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class BudgetVarianceService:
    """预算差异服务"""
    
    @staticmethod
    async def create_budgetvariance(
        tenant_id: int,
        data: BudgetVarianceCreate
    ) -> BudgetVarianceResponse:
        """
        创建预算差异
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            BudgetVarianceResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await BudgetVariance.filter(
            tenant_id=tenant_id,
            variance_no=data.variance_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"差异编号 {data.variance_no} 已存在")
        
        # 创建对象
        obj = await BudgetVariance.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return BudgetVarianceResponse.model_validate(obj)
    
    @staticmethod
    async def get_budgetvariance_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> BudgetVarianceResponse:
        """
        根据UUID获取预算差异
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            BudgetVarianceResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BudgetVariance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算差异 {obj_uuid} 不存在")
        
        return BudgetVarianceResponse.model_validate(obj)
    
    @staticmethod
    async def list_budgetvariances(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[BudgetVarianceResponse]:
        """
        获取预算差异列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[BudgetVarianceResponse]: 对象列表
        """
        query = BudgetVariance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [BudgetVarianceResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_budgetvariance(
        tenant_id: int,
        obj_uuid: str,
        data: BudgetVarianceUpdate
    ) -> BudgetVarianceResponse:
        """
        更新预算差异
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            BudgetVarianceResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BudgetVariance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算差异 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return BudgetVarianceResponse.model_validate(obj)
    
    @staticmethod
    async def delete_budgetvariance(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除预算差异（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BudgetVariance.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算差异 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
