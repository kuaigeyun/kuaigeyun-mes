"""
经营仪表盘服务模块

提供经营仪表盘的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.business_analysis import BusinessDashboard
from apps.kuaiepm.schemas.business_dashboard_schemas import (
    BusinessDashboardCreate, BusinessDashboardUpdate, BusinessDashboardResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class BusinessDashboardService:
    """经营仪表盘服务"""
    
    @staticmethod
    async def create_businessdashboard(
        tenant_id: int,
        data: BusinessDashboardCreate
    ) -> BusinessDashboardResponse:
        """
        创建经营仪表盘
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            BusinessDashboardResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await BusinessDashboard.filter(
            tenant_id=tenant_id,
            dashboard_no=data.dashboard_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"仪表盘编号 {data.dashboard_no} 已存在")
        
        # 创建对象
        obj = await BusinessDashboard.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return BusinessDashboardResponse.model_validate(obj)
    
    @staticmethod
    async def get_businessdashboard_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> BusinessDashboardResponse:
        """
        根据UUID获取经营仪表盘
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            BusinessDashboardResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BusinessDashboard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"经营仪表盘 {obj_uuid} 不存在")
        
        return BusinessDashboardResponse.model_validate(obj)
    
    @staticmethod
    async def list_businessdashboards(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[BusinessDashboardResponse]:
        """
        获取经营仪表盘列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[BusinessDashboardResponse]: 对象列表
        """
        query = BusinessDashboard.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [BusinessDashboardResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_businessdashboard(
        tenant_id: int,
        obj_uuid: str,
        data: BusinessDashboardUpdate
    ) -> BusinessDashboardResponse:
        """
        更新经营仪表盘
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            BusinessDashboardResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BusinessDashboard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"经营仪表盘 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return BusinessDashboardResponse.model_validate(obj)
    
    @staticmethod
    async def delete_businessdashboard(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除经营仪表盘（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await BusinessDashboard.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"经营仪表盘 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
