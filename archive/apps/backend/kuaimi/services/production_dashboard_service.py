"""
实时生产看板服务模块

提供实时生产看板的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimi.models.production_dashboard import ProductionDashboard
from apps.kuaimi.schemas.production_dashboard_schemas import (
    ProductionDashboardCreate, ProductionDashboardUpdate, ProductionDashboardResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProductionDashboardService:
    """实时生产看板服务"""
    
    @staticmethod
    async def create_production_dashboard(
        tenant_id: int,
        data: ProductionDashboardCreate
    ) -> ProductionDashboardResponse:
        """创建实时生产看板"""
        existing = await ProductionDashboard.filter(
            tenant_id=tenant_id,
            dashboard_no=data.dashboard_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"实时生产看板编号 {data.dashboard_no} 已存在")
        
        dashboard = await ProductionDashboard.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProductionDashboardResponse.model_validate(dashboard)
    
    @staticmethod
    async def get_production_dashboard_by_uuid(
        tenant_id: int,
        dashboard_uuid: str
    ) -> ProductionDashboardResponse:
        """根据UUID获取实时生产看板"""
        dashboard = await ProductionDashboard.filter(
            tenant_id=tenant_id,
            uuid=dashboard_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not dashboard:
            raise NotFoundError(f"实时生产看板 {dashboard_uuid} 不存在")
        
        return ProductionDashboardResponse.model_validate(dashboard)
    
    @staticmethod
    async def list_production_dashboards(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        dashboard_type: Optional[str] = None,
        alert_level: Optional[str] = None,
        alert_status: Optional[str] = None
    ) -> List[ProductionDashboardResponse]:
        """获取实时生产看板列表"""
        query = ProductionDashboard.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if dashboard_type:
            query = query.filter(dashboard_type=dashboard_type)
        if alert_level:
            query = query.filter(alert_level=alert_level)
        if alert_status:
            query = query.filter(alert_status=alert_status)
        
        dashboards = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ProductionDashboardResponse.model_validate(d) for d in dashboards]
    
    @staticmethod
    async def update_production_dashboard(
        tenant_id: int,
        dashboard_uuid: str,
        data: ProductionDashboardUpdate
    ) -> ProductionDashboardResponse:
        """更新实时生产看板"""
        dashboard = await ProductionDashboard.filter(
            tenant_id=tenant_id,
            uuid=dashboard_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not dashboard:
            raise NotFoundError(f"实时生产看板 {dashboard_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(dashboard, key, value)
        
        await dashboard.save()
        
        return ProductionDashboardResponse.model_validate(dashboard)
    
    @staticmethod
    async def delete_production_dashboard(
        tenant_id: int,
        dashboard_uuid: str
    ) -> None:
        """删除实时生产看板（软删除）"""
        dashboard = await ProductionDashboard.filter(
            tenant_id=tenant_id,
            uuid=dashboard_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not dashboard:
            raise NotFoundError(f"实时生产看板 {dashboard_uuid} 不存在")
        
        dashboard.deleted_at = datetime.utcnow()
        await dashboard.save()

