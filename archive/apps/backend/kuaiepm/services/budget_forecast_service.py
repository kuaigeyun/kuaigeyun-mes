"""
预算预测服务模块

提供预算预测的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.budget_analysis import BudgetForecast
from apps.kuaiepm.schemas.budget_forecast_schemas import (
    BudgetForecastCreate, BudgetForecastUpdate, BudgetForecastResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class BudgetForecastService:
    """预算预测服务"""
    
    @staticmethod
    async def create_budgetforecast(
        tenant_id: int,
        data: BudgetForecastCreate
    ) -> BudgetForecastResponse:
        """
        创建预算预测
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            BudgetForecastResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await BudgetForecast.filter(
            tenant_id=tenant_id,
            forecast_no=data.forecast_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"预测编号 {data.forecast_no} 已存在")
        
        # 创建对象
        obj = await BudgetForecast.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return BudgetForecastResponse.model_validate(obj)
    
    @staticmethod
    async def get_budgetforecast_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> BudgetForecastResponse:
        """
        根据UUID获取预算预测
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            BudgetForecastResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BudgetForecast.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算预测 {obj_uuid} 不存在")
        
        return BudgetForecastResponse.model_validate(obj)
    
    @staticmethod
    async def list_budgetforecasts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[BudgetForecastResponse]:
        """
        获取预算预测列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[BudgetForecastResponse]: 对象列表
        """
        query = BudgetForecast.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [BudgetForecastResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_budgetforecast(
        tenant_id: int,
        obj_uuid: str,
        data: BudgetForecastUpdate
    ) -> BudgetForecastResponse:
        """
        更新预算预测
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            BudgetForecastResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BudgetForecast.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算预测 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return BudgetForecastResponse.model_validate(obj)
    
    @staticmethod
    async def delete_budgetforecast(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除预算预测（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BudgetForecast.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"预算预测 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
