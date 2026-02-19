import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Any, Dict
from apps.base_service import AppBaseService
from apps.kuaireport.models.dashboard import Dashboard
from apps.kuaireport.schemas.dashboard import DashboardCreate, DashboardUpdate
from infra.exceptions.exceptions import NotFoundError

class DashboardService(AppBaseService[Dashboard]):
    def __init__(self):
        super().__init__(Dashboard)

    async def get_dashboard_by_code(self, tenant_id: int, code: str) -> Optional[Dashboard]:
        return await self.model.get_or_none(tenant_id=tenant_id, code=code)

    async def create(self, tenant_id: int, data: DashboardCreate, created_by: int) -> Dashboard:
        """创建看板"""
        return await self.create_with_user(tenant_id, created_by, **data.model_dump())

    async def update(self, tenant_id: int, id: int, data: DashboardUpdate, updated_by: int) -> Dashboard:
        """更新看板"""
        return await self.update_with_user(tenant_id, id, updated_by, **data.model_dump(exclude_unset=True))

    async def list(self, tenant_id: int, skip: int = 0, limit: int = 100) -> Dict[str, Any]:
        """列表查询"""
        total = await self.model.filter(tenant_id=tenant_id).count()
        data = await self.list_all(tenant_id, skip, limit)
        return {
            "data": data,
            "total": total,
            "success": True
        }

    async def delete(self, tenant_id: int, id: int) -> bool:
        """删除看板"""
        return await self.delete_with_validation(tenant_id, id, soft_delete=False)

    async def share(
        self, tenant_id: int, dashboard_id: int, expires_days: Optional[int] = 30
    ) -> Dict[str, Any]:
        """生成分享链接"""
        dashboard = await self.model.get_or_none(tenant_id=tenant_id, id=dashboard_id)
        if not dashboard:
            raise NotFoundError("大屏", str(dashboard_id))
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=expires_days) if expires_days else None
        dashboard.is_shared = True
        dashboard.share_token = token
        dashboard.share_expires_at = expires_at
        await dashboard.save()
        return {
            "share_token": token,
            "share_expires_at": expires_at.isoformat() if expires_at else None,
            "is_shared": True,
        }

    async def unshare(self, tenant_id: int, dashboard_id: int) -> None:
        """取消分享"""
        dashboard = await self.model.get_or_none(tenant_id=tenant_id, id=dashboard_id)
        if not dashboard:
            raise NotFoundError("大屏", str(dashboard_id))
        dashboard.is_shared = False
        dashboard.share_token = None
        dashboard.share_expires_at = None
        await dashboard.save()

    async def get_by_share_token(self, token: str) -> Optional[Dashboard]:
        """通过分享令牌获取大屏（公开，无需登录）"""
        dashboard = await self.model.get_or_none(share_token=token)
        if not dashboard:
            return None
        if dashboard.share_expires_at and dashboard.share_expires_at < datetime.utcnow():
            return None
        return dashboard
