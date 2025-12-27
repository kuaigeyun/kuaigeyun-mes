"""
成本中心服务模块

提供成本中心的业务逻辑处理，支持多组织隔离。
按照中国财务规范：成本中心管理。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiacc.models.cost_center import CostCenter
from apps.kuaiacc.schemas.cost_center_schemas import (
    CostCenterCreate, CostCenterUpdate, CostCenterResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CostCenterService:
    """成本中心服务"""
    
    @staticmethod
    async def create_cost_center(
        tenant_id: int,
        data: CostCenterCreate
    ) -> CostCenterResponse:
        """
        创建成本中心
        
        Args:
            tenant_id: 租户ID
            data: 成本中心创建数据
            
        Returns:
            CostCenterResponse: 创建的成本中心对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await CostCenter.filter(
            tenant_id=tenant_id,
            center_code=data.center_code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"成本中心编码 {data.center_code} 已存在")
        
        # 创建成本中心
        center = await CostCenter.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CostCenterResponse.model_validate(center)
    
    @staticmethod
    async def get_cost_center_by_uuid(
        tenant_id: int,
        center_uuid: str
    ) -> CostCenterResponse:
        """
        根据UUID获取成本中心
        
        Args:
            tenant_id: 租户ID
            center_uuid: 成本中心UUID
            
        Returns:
            CostCenterResponse: 成本中心对象
            
        Raises:
            NotFoundError: 当成本中心不存在时抛出
        """
        center = await CostCenter.filter(
            tenant_id=tenant_id,
            uuid=center_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not center:
            raise NotFoundError(f"成本中心 {center_uuid} 不存在")
        
        return CostCenterResponse.model_validate(center)
    
    @staticmethod
    async def list_cost_centers(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        center_type: Optional[str] = None,
        status: Optional[str] = None,
        parent_id: Optional[int] = None
    ) -> List[CostCenterResponse]:
        """
        获取成本中心列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            center_type: 成本中心类型（过滤）
            status: 状态（过滤）
            parent_id: 父成本中心ID（过滤）
            
        Returns:
            List[CostCenterResponse]: 成本中心列表
        """
        query = CostCenter.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if center_type:
            query = query.filter(center_type=center_type)
        if status:
            query = query.filter(status=status)
        if parent_id is not None:
            query = query.filter(parent_id=parent_id)
        
        centers = await query.offset(skip).limit(limit).order_by("center_code").all()
        
        return [CostCenterResponse.model_validate(center) for center in centers]
    
    @staticmethod
    async def update_cost_center(
        tenant_id: int,
        center_uuid: str,
        data: CostCenterUpdate
    ) -> CostCenterResponse:
        """
        更新成本中心
        
        Args:
            tenant_id: 租户ID
            center_uuid: 成本中心UUID
            data: 成本中心更新数据
            
        Returns:
            CostCenterResponse: 更新后的成本中心对象
            
        Raises:
            NotFoundError: 当成本中心不存在时抛出
        """
        center = await CostCenter.filter(
            tenant_id=tenant_id,
            uuid=center_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not center:
            raise NotFoundError(f"成本中心 {center_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(center, key, value)
        
        await center.save()
        
        return CostCenterResponse.model_validate(center)
    
    @staticmethod
    async def delete_cost_center(
        tenant_id: int,
        center_uuid: str
    ) -> None:
        """
        删除成本中心（软删除）
        
        Args:
            tenant_id: 租户ID
            center_uuid: 成本中心UUID
            
        Raises:
            NotFoundError: 当成本中心不存在时抛出
        """
        center = await CostCenter.filter(
            tenant_id=tenant_id,
            uuid=center_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not center:
            raise NotFoundError(f"成本中心 {center_uuid} 不存在")
        
        # 检查是否有子成本中心
        children = await CostCenter.filter(
            tenant_id=tenant_id,
            parent_id=center.id,
            deleted_at__isnull=True
        ).count()
        
        if children > 0:
            raise ValidationError(f"成本中心 {center.center_code} 存在子成本中心，无法删除")
        
        # 软删除
        center.deleted_at = datetime.now()
        await center.save()

