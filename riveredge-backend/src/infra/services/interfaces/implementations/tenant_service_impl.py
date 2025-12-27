"""
组织服务实现

将TenantService适配为TenantServiceInterface接口实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Any, Dict, Optional
from infra.services.interfaces.service_interface import TenantServiceInterface
from infra.services.tenant_service import TenantService


class TenantServiceImpl(TenantServiceInterface):
    """
    组织服务实现类
    
    将 TenantService 适配为接口实现。
    """
    
    def __init__(self):
        self._tenant_service = TenantService()
    
    @property
    def service_name(self) -> str:
        return "tenant_service"
    
    @property
    def service_version(self) -> str:
        return "1.0.0"
    
    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "status": "healthy",
            "service": "tenant_service",
            "version": self.service_version
        }
    
    async def list_tenants(
        self,
        page: int = 1,
        page_size: int = 10,
        status: Optional[Any] = None,
        plan: Optional[Any] = None,
        name: Optional[str] = None,
        domain: Optional[str] = None,
        sort: Optional[str] = None,
        order: Optional[str] = None,
        skip_tenant_filter: bool = False
    ) -> Dict[str, Any]:
        """获取组织列表"""
        return await self._tenant_service.list_tenants(
            page=page,
            page_size=page_size,
            status=status,
            plan=plan,
            name=name,
            domain=domain,
            sort=sort,
            order=order,
            skip_tenant_filter=skip_tenant_filter
        )
    
    async def get_tenant_by_id(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True
    ) -> Optional[Any]:
        """根据ID获取组织"""
        return await self._tenant_service.get_tenant_by_id(
            tenant_id=tenant_id,
            skip_tenant_filter=skip_tenant_filter
        )
    
    async def create_tenant(self, data: Any) -> Any:
        """创建组织"""
        return await self._tenant_service.create_tenant(data)
    
    async def update_tenant(
        self,
        tenant_id: int,
        data: Any,
        skip_tenant_filter: bool = True
    ) -> Optional[Any]:
        """更新组织"""
        return await self._tenant_service.update_tenant(
            tenant_id=tenant_id,
            data=data,
            skip_tenant_filter=skip_tenant_filter
        )
    
    async def delete_tenant(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True
    ) -> bool:
        """删除组织"""
        return await self._tenant_service.delete_tenant(
            tenant_id=tenant_id,
            skip_tenant_filter=skip_tenant_filter
        )

