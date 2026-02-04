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
