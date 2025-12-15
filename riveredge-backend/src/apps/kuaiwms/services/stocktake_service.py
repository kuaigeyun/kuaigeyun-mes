"""
盘点单服务模块

提供盘点单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiwms.models.stocktake import Stocktake
from apps.kuaiwms.schemas.stocktake_schemas import (
    StocktakeCreate, StocktakeUpdate, StocktakeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class StocktakeService:
    """盘点单服务"""
    
    @staticmethod
    async def create_stocktake(
        tenant_id: int,
        data: StocktakeCreate
    ) -> StocktakeResponse:
        """
        创建盘点单
        
        Args:
            tenant_id: 租户ID
            data: 盘点单创建数据
            
        Returns:
            StocktakeResponse: 创建的盘点单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Stocktake.filter(
            tenant_id=tenant_id,
            stocktake_no=data.stocktake_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"盘点单编号 {data.stocktake_no} 已存在")
        
        # 创建盘点单
        stocktake = await Stocktake.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return StocktakeResponse.model_validate(stocktake)
    
    @staticmethod
    async def get_stocktake_by_uuid(
        tenant_id: int,
        stocktake_uuid: str
    ) -> StocktakeResponse:
        """
        根据UUID获取盘点单
        
        Args:
            tenant_id: 租户ID
            stocktake_uuid: 盘点单UUID
            
        Returns:
            StocktakeResponse: 盘点单对象
            
        Raises:
            NotFoundError: 当盘点单不存在时抛出
        """
        stocktake = await Stocktake.filter(
            tenant_id=tenant_id,
            uuid=stocktake_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not stocktake:
            raise NotFoundError(f"盘点单 {stocktake_uuid} 不存在")
        
        return StocktakeResponse.model_validate(stocktake)
    
    @staticmethod
    async def list_stocktakes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        warehouse_id: Optional[int] = None
    ) -> List[StocktakeResponse]:
        """
        获取盘点单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 盘点状态（过滤）
            warehouse_id: 仓库ID（过滤）
            
        Returns:
            List[StocktakeResponse]: 盘点单列表
        """
        query = Stocktake.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        
        stocktakes = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [StocktakeResponse.model_validate(st) for st in stocktakes]
    
    @staticmethod
    async def update_stocktake(
        tenant_id: int,
        stocktake_uuid: str,
        data: StocktakeUpdate
    ) -> StocktakeResponse:
        """
        更新盘点单
        
        Args:
            tenant_id: 租户ID
            stocktake_uuid: 盘点单UUID
            data: 盘点单更新数据
            
        Returns:
            StocktakeResponse: 更新后的盘点单对象
            
        Raises:
            NotFoundError: 当盘点单不存在时抛出
        """
        stocktake = await Stocktake.filter(
            tenant_id=tenant_id,
            uuid=stocktake_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not stocktake:
            raise NotFoundError(f"盘点单 {stocktake_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(stocktake, key, value)
        
        await stocktake.save()
        
        return StocktakeResponse.model_validate(stocktake)
    
    @staticmethod
    async def delete_stocktake(
        tenant_id: int,
        stocktake_uuid: str
    ) -> None:
        """
        删除盘点单（软删除）
        
        Args:
            tenant_id: 租户ID
            stocktake_uuid: 盘点单UUID
            
        Raises:
            NotFoundError: 当盘点单不存在时抛出
        """
        stocktake = await Stocktake.filter(
            tenant_id=tenant_id,
            uuid=stocktake_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not stocktake:
            raise NotFoundError(f"盘点单 {stocktake_uuid} 不存在")
        
        stocktake.deleted_at = datetime.utcnow()
        await stocktake.save()
    
    @staticmethod
    async def complete_stocktake(
        tenant_id: int,
        stocktake_uuid: str
    ) -> StocktakeResponse:
        """
        完成盘点（计算差异）
        
        Args:
            tenant_id: 租户ID
            stocktake_uuid: 盘点单UUID
            
        Returns:
            StocktakeResponse: 更新后的盘点单对象
            
        Raises:
            NotFoundError: 当盘点单不存在时抛出
            ValidationError: 当盘点单状态不允许完成时抛出
        """
        stocktake = await Stocktake.filter(
            tenant_id=tenant_id,
            uuid=stocktake_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not stocktake:
            raise NotFoundError(f"盘点单 {stocktake_uuid} 不存在")
        
        # 检查状态
        if stocktake.status in ["已完成", "已关闭"]:
            raise ValidationError(f"盘点单状态为 {stocktake.status}，无法完成盘点")
        
        # TODO: 实现差异计算逻辑
        # 这里应该根据盘点明细计算差异
        
        # 更新状态
        stocktake.status = "已完成"
        await stocktake.save()
        
        return StocktakeResponse.model_validate(stocktake)
