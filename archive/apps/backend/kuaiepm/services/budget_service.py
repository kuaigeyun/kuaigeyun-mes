"""
预算服务模块

提供预算的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.budget_analysis import Budget
from apps.kuaiepm.schemas.budget_schemas import (
    BudgetCreate, BudgetUpdate, BudgetResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class BudgetService:
    """预算服务"""
    
    @staticmethod
    async def create_budget(
        tenant_id: int,
        data: BudgetCreate
    ) -> BudgetResponse:
        """
        创建预算
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            BudgetResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Budget.filter(
            tenant_id=tenant_id,
            budget_no=data.budget_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"预算编号 {data.budget_no} 已存在")
        
        # 创建对象
        obj = await Budget.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return BudgetResponse.model_validate(obj)
    
    @staticmethod
    async def get_budget_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> BudgetResponse:
        """
        根据UUID获取预算
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            BudgetResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Budget.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算 {obj_uuid} 不存在")
        
        return BudgetResponse.model_validate(obj)
    
    @staticmethod
    async def list_budgets(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[BudgetResponse]:
        """
        获取预算列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[BudgetResponse]: 对象列表
        """
        query = Budget.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [BudgetResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_budget(
        tenant_id: int,
        obj_uuid: str,
        data: BudgetUpdate
    ) -> BudgetResponse:
        """
        更新预算
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            BudgetResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Budget.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return BudgetResponse.model_validate(obj)
    
    @staticmethod
    async def delete_budget(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除预算（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Budget.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
