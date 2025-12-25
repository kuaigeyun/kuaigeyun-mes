"""
全局库存视图服务模块

提供全局库存视图的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiscm.models.global_inventory_view import GlobalInventoryView
from apps.kuaiscm.schemas.global_inventory_view_schemas import (
    GlobalInventoryViewCreate, GlobalInventoryViewUpdate, GlobalInventoryViewResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class GlobalInventoryViewService:
    """全局库存视图服务"""
    
    @staticmethod
    async def create_global_inventory_view(
        tenant_id: int,
        data: GlobalInventoryViewCreate
    ) -> GlobalInventoryViewResponse:
        """创建全局库存视图"""
        existing = await GlobalInventoryView.filter(
            tenant_id=tenant_id,
            view_no=data.view_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"全局库存视图编号 {data.view_no} 已存在")
        
        view = await GlobalInventoryView.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return GlobalInventoryViewResponse.model_validate(view)
    
    @staticmethod
    async def get_global_inventory_view_by_uuid(
        tenant_id: int,
        view_uuid: str
    ) -> GlobalInventoryViewResponse:
        """根据UUID获取全局库存视图"""
        view = await GlobalInventoryView.filter(
            tenant_id=tenant_id,
            uuid=view_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not view:
            raise NotFoundError(f"全局库存视图 {view_uuid} 不存在")
        
        return GlobalInventoryViewResponse.model_validate(view)
    
    @staticmethod
    async def list_global_inventory_views(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        inventory_type: Optional[str] = None,
        alert_status: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[GlobalInventoryViewResponse]:
        """获取全局库存视图列表"""
        query = GlobalInventoryView.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if inventory_type:
            query = query.filter(inventory_type=inventory_type)
        if alert_status:
            query = query.filter(alert_status=alert_status)
        if status:
            query = query.filter(status=status)
        
        views = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [GlobalInventoryViewResponse.model_validate(v) for v in views]
    
    @staticmethod
    async def update_global_inventory_view(
        tenant_id: int,
        view_uuid: str,
        data: GlobalInventoryViewUpdate
    ) -> GlobalInventoryViewResponse:
        """更新全局库存视图"""
        view = await GlobalInventoryView.filter(
            tenant_id=tenant_id,
            uuid=view_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not view:
            raise NotFoundError(f"全局库存视图 {view_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(view, key, value)
        
        await view.save()
        
        return GlobalInventoryViewResponse.model_validate(view)
    
    @staticmethod
    async def delete_global_inventory_view(
        tenant_id: int,
        view_uuid: str
    ) -> None:
        """删除全局库存视图（软删除）"""
        view = await GlobalInventoryView.filter(
            tenant_id=tenant_id,
            uuid=view_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not view:
            raise NotFoundError(f"全局库存视图 {view_uuid} 不存在")
        
        view.deleted_at = datetime.utcnow()
        await view.save()

