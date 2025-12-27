"""
标准成本服务模块

提供标准成本的业务逻辑处理，支持多组织隔离。
按照中国财务规范：标准成本法。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiacc.models.standard_cost import StandardCost
from apps.kuaiacc.schemas.standard_cost_schemas import (
    StandardCostCreate, StandardCostUpdate, StandardCostResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class StandardCostService:
    """标准成本服务"""
    
    @staticmethod
    async def create_standard_cost(
        tenant_id: int,
        data: StandardCostCreate
    ) -> StandardCostResponse:
        """
        创建标准成本
        
        Args:
            tenant_id: 租户ID
            data: 成本创建数据
            
        Returns:
            StandardCostResponse: 创建的成本对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await StandardCost.filter(
            tenant_id=tenant_id,
            cost_no=data.cost_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"成本编号 {data.cost_no} 已存在")
        
        # 创建成本
        cost = await StandardCost.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return StandardCostResponse.model_validate(cost)
    
    @staticmethod
    async def get_standard_cost_by_uuid(
        tenant_id: int,
        cost_uuid: str
    ) -> StandardCostResponse:
        """
        根据UUID获取标准成本
        
        Args:
            tenant_id: 租户ID
            cost_uuid: 成本UUID
            
        Returns:
            StandardCostResponse: 成本对象
            
        Raises:
            NotFoundError: 当成本不存在时抛出
        """
        cost = await StandardCost.filter(
            tenant_id=tenant_id,
            uuid=cost_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not cost:
            raise NotFoundError(f"标准成本 {cost_uuid} 不存在")
        
        return StandardCostResponse.model_validate(cost)
    
    @staticmethod
    async def list_standard_costs(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        material_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[StandardCostResponse]:
        """
        获取标准成本列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            material_id: 物料ID（过滤）
            status: 状态（过滤）
            
        Returns:
            List[StandardCostResponse]: 成本列表
        """
        query = StandardCost.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if material_id:
            query = query.filter(material_id=material_id)
        if status:
            query = query.filter(status=status)
        
        costs = await query.offset(skip).limit(limit).order_by("-effective_date", "-id").all()
        
        return [StandardCostResponse.model_validate(cost) for cost in costs]
    
    @staticmethod
    async def update_standard_cost(
        tenant_id: int,
        cost_uuid: str,
        data: StandardCostUpdate
    ) -> StandardCostResponse:
        """
        更新标准成本
        
        Args:
            tenant_id: 租户ID
            cost_uuid: 成本UUID
            data: 成本更新数据
            
        Returns:
            StandardCostResponse: 更新后的成本对象
            
        Raises:
            NotFoundError: 当成本不存在时抛出
        """
        cost = await StandardCost.filter(
            tenant_id=tenant_id,
            uuid=cost_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not cost:
            raise NotFoundError(f"标准成本 {cost_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(cost, key, value)
        
        await cost.save()
        
        return StandardCostResponse.model_validate(cost)
    
    @staticmethod
    async def delete_standard_cost(
        tenant_id: int,
        cost_uuid: str
    ) -> None:
        """
        删除标准成本（软删除）
        
        Args:
            tenant_id: 租户ID
            cost_uuid: 成本UUID
            
        Raises:
            NotFoundError: 当成本不存在时抛出
        """
        cost = await StandardCost.filter(
            tenant_id=tenant_id,
            uuid=cost_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not cost:
            raise NotFoundError(f"标准成本 {cost_uuid} 不存在")
        
        # 软删除
        cost.deleted_at = datetime.now()
        await cost.save()

