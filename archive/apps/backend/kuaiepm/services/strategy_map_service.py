"""
战略地图服务模块

提供战略地图的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.balanced_scorecard import StrategyMap
from apps.kuaiepm.schemas.strategy_map_schemas import (
    StrategyMapCreate, StrategyMapUpdate, StrategyMapResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class StrategyMapService:
    """战略地图服务"""
    
    @staticmethod
    async def create_strategymap(
        tenant_id: int,
        data: StrategyMapCreate
    ) -> StrategyMapResponse:
        """
        创建战略地图
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            StrategyMapResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await StrategyMap.filter(
            tenant_id=tenant_id,
            map_no=data.map_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"地图编号 {data.map_no} 已存在")
        
        # 创建对象
        obj = await StrategyMap.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return StrategyMapResponse.model_validate(obj)
    
    @staticmethod
    async def get_strategymap_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> StrategyMapResponse:
        """
        根据UUID获取战略地图
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            StrategyMapResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await StrategyMap.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"战略地图 {obj_uuid} 不存在")
        
        return StrategyMapResponse.model_validate(obj)
    
    @staticmethod
    async def list_strategymaps(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[StrategyMapResponse]:
        """
        获取战略地图列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[StrategyMapResponse]: 对象列表
        """
        query = StrategyMap.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [StrategyMapResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_strategymap(
        tenant_id: int,
        obj_uuid: str,
        data: StrategyMapUpdate
    ) -> StrategyMapResponse:
        """
        更新战略地图
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            StrategyMapResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await StrategyMap.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"战略地图 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return StrategyMapResponse.model_validate(obj)
    
    @staticmethod
    async def delete_strategymap(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除战略地图（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await StrategyMap.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"战略地图 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
