"""
平台级服务依赖注入

提供 FastAPI Depends 函数，用于依赖注入平台级服务。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Optional
from fastapi import Depends
from infra.services.service_registry import InfraServiceLocator
from infra.services.interfaces.service_interface import (
    AuthServiceInterface,
    TenantServiceInterface,
    PackageServiceInterface,
    InfraSuperAdminServiceInterface,
    SavedSearchServiceInterface,
)
from infra.services.auth_service import AuthService
from infra.services.tenant_service import TenantService
from infra.services.package_service import PackageService
from infra.services.infra_superadmin_service import InfraSuperAdminService
from infra.services.saved_search_service import SavedSearchService


def get_auth_service() -> Optional[AuthServiceInterface]:
    """
    获取认证服务（依赖注入）
    
    ⚠️ 第三阶段改进：使用服务注册表获取服务，支持向后兼容
    
    Returns:
        Optional[AuthServiceInterface]: 认证服务实例，如果未注册则返回 None
    """
    try:
        return InfraServiceLocator.get_service("auth_service")
    except Exception:
        # 向后兼容：如果服务未注册，返回 None
        # 调用方可以回退到直接导入 AuthService
        return None


def get_tenant_service() -> Optional[TenantServiceInterface]:
    """
    获取组织服务（依赖注入）
    
    Returns:
        Optional[TenantServiceInterface]: 组织服务实例，如果未注册则返回 None
    """
    try:
        return InfraServiceLocator.get_service("tenant_service")
    except Exception:
        return None


def get_package_service() -> Optional[PackageServiceInterface]:
    """
    获取套餐服务（依赖注入）
    
    Returns:
        Optional[PackageServiceInterface]: 套餐服务实例，如果未注册则返回 None
    """
    try:
        return InfraServiceLocator.get_service("package_service")
    except Exception:
        return None


def get_infra_superadmin_service() -> Optional[InfraSuperAdminServiceInterface]:
    """
    获取平台超级管理员服务（依赖注入）
    
    Returns:
        Optional[InfraSuperAdminServiceInterface]: 平台超级管理员服务实例，如果未注册则返回 None
    """
    try:
        return InfraServiceLocator.get_service("infra_superadmin_service")
    except Exception:
        return None


def get_saved_search_service() -> Optional[SavedSearchServiceInterface]:
    """
    获取保存搜索服务（依赖注入）
    
    Returns:
        Optional[SavedSearchServiceInterface]: 保存搜索服务实例，如果未注册则返回 None
    """
    try:
        return InfraServiceLocator.get_service("saved_search_service")
    except Exception:
        return None


# 服务获取辅助函数（带回退）
def get_auth_service_with_fallback() -> Any:
    """
    获取认证服务，如果未注册则回退到直接导入
    
    Returns:
        认证服务实例（AuthServiceImpl）或适配器对象（向后兼容）
    """
    from typing import Any
    
    service = get_auth_service()
    if service:
        return service
    
    # 回退到直接导入（向后兼容）
    class AuthServiceAdapter:
        """AuthService 适配器，将静态方法适配为实例方法"""
        def __init__(self):
            self._auth_service = AuthService()
        
        async def login(self, data: Any, request: Any) -> Dict[str, Any]:
            return await self._auth_service.login(data, request)
        
        async def register(self, data: Any) -> Any:
            return await self._auth_service.register(data)
        
        async def guest_login(self) -> Dict[str, Any]:
            return await self._auth_service.guest_login()
        
        async def register_personal(self, data: Any) -> Dict[str, Any]:
            return await self._auth_service.register_personal(data)
        
        async def register_organization(self, data: Any) -> Dict[str, Any]:
            return await self._auth_service.register_organization(data)
    
    return AuthServiceAdapter()


def get_tenant_service_with_fallback() -> Any:
    """
    获取组织服务，如果未注册则回退到直接导入
    
    Returns:
        组织服务实例（TenantServiceImpl）或适配器对象（向后兼容）
    """
    from typing import Any, Dict, Optional
    
    service = get_tenant_service()
    if service:
        return service
    
    # 回退到直接导入（向后兼容）
    class TenantServiceAdapter:
        """TenantService 适配器"""
        def __init__(self):
            self._tenant_service = TenantService()
        
        async def list_tenants(self, **kwargs) -> Dict[str, Any]:
            return await self._tenant_service.list_tenants(**kwargs)
        
        async def get_tenant_by_id(self, tenant_id: int, **kwargs) -> Optional[Any]:
            return await self._tenant_service.get_tenant_by_id(tenant_id, **kwargs)
        
        async def create_tenant(self, data: Any) -> Any:
            return await self._tenant_service.create_tenant(data)
        
        async def update_tenant(self, tenant_id: int, data: Any, **kwargs) -> Optional[Any]:
            return await self._tenant_service.update_tenant(tenant_id, data, **kwargs)
        
        async def delete_tenant(self, tenant_id: int, **kwargs) -> bool:
            return await self._tenant_service.delete_tenant(tenant_id, **kwargs)
    
    return TenantServiceAdapter()

