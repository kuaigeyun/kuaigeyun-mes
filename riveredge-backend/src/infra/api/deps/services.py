"""
平台级服务依赖注入

提供 FastAPI Depends 函数，用于依赖注入平台级服务。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Optional, Any, Dict
from fastapi import Depends, Request
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
        
        async def guest_login(self, request: Any = None) -> Dict[str, Any]:
            return await self._auth_service.guest_login(request)
        
        async def register_personal(self, data: Any) -> Dict[str, Any]:
            return await self._auth_service.register_personal(data)
        
        async def register_organization(self, data: Any) -> Dict[str, Any]:
            return await self._auth_service.register_organization(data)

        async def get_accessible_tenants(self, current_user: Any) -> list[dict]:
            return await self._auth_service.get_accessible_tenants(current_user)

        async def switch_tenant(self, current_user: Any, target_tenant_id: int, request: Any = None) -> Dict[str, Any]:
            return await self._auth_service.switch_tenant(
                current_user=current_user,
                target_tenant_id=target_tenant_id,
                request=request,
            )

        async def generate_login_result(self, user: Any, request: Any = None, tenant_id: Any = None) -> Dict[str, Any]:
            return await self._auth_service.generate_login_result(
                user,
                request=request,
                tenant_id=tenant_id,
            )
    
    return AuthServiceAdapter()


def get_tenant_service_with_fallback() -> Any:
    """
    获取组织服务，如果未注册则回退到直接导入
    
    Returns:
        组织服务实例（TenantServiceImpl）或适配器对象（向后兼容）
    """
    from typing import Dict, Optional
    
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

        async def activate_tenant(self, tenant_id: int, skip_tenant_filter: bool = True):
            return await self._tenant_service.activate_tenant(tenant_id, skip_tenant_filter=skip_tenant_filter)

        async def deactivate_tenant(self, tenant_id: int, skip_tenant_filter: bool = True):
            return await self._tenant_service.deactivate_tenant(tenant_id, skip_tenant_filter=skip_tenant_filter)

        async def initialize_tenant_data(
            self,
            tenant_id: int,
            init_data_options=None,
            current_user_id=None,
            industry_preset=None,
        ):
            return await self._tenant_service.initialize_tenant_data(
                tenant_id=tenant_id,
                init_data_options=init_data_options,
                current_user_id=current_user_id,
                industry_preset=industry_preset,
            )
    
    return TenantServiceAdapter()


def get_package_service_with_fallback() -> Any:
    """
    获取套餐服务，如果未注册则回退到直接导入
    
    Returns:
        套餐服务实例（PackageServiceImpl）或适配器对象（向后兼容）
    """
    service = get_package_service()
    if service:
        return service
    
    # 回退到直接导入（向后兼容）
    class PackageServiceAdapter:
        """PackageService 适配器"""
        def __init__(self):
            self._package_service = PackageService()
        
        async def list_packages(self, **kwargs) -> Dict[str, Any]:
            return await self._package_service.list_packages(**kwargs)
        
        async def get_package_by_id(self, package_id: int) -> Optional[Any]:
            return await self._package_service.get_package_by_id(package_id)

        async def create_package(self, data: Any) -> Any:
            return await self._package_service.create_package(data)

        async def update_package(self, package_id: int, data: Any) -> Optional[Any]:
            return await self._package_service.update_package(package_id, data)

        async def delete_package(self, package_id: int) -> bool:
            return await self._package_service.delete_package(package_id)
    
    return PackageServiceAdapter()


def get_infra_superadmin_service_with_fallback() -> Any:
    """
    获取平台超级管理员服务，如果未注册则回退到直接导入
    
    Returns:
        平台超级管理员服务实例（InfraSuperAdminServiceImpl）或适配器对象（向后兼容）
    """
    service = get_infra_superadmin_service()
    if service:
        return service
    
    # 回退到直接导入（向后兼容）
    class InfraSuperAdminServiceAdapter:
        """InfraSuperAdminService 适配器"""
        def __init__(self):
            self._admin_service = InfraSuperAdminService()
        
        async def get_current_admin(self) -> Optional[Any]:
            return await self._admin_service.get_infra_superadmin()
        
        async def create_admin(self, data: Any) -> Any:
            return await self._admin_service.create_infra_superadmin(data)
        
        async def update_admin(self, data: Any) -> Any:
            return await self._admin_service.update_infra_superadmin(data)
        
        # 向后兼容：也支持直接调用原方法名
        async def create_infra_superadmin(self, data: Any) -> Any:
            return await self._admin_service.create_infra_superadmin(data)
        
        async def update_infra_superadmin(self, data: Any) -> Any:
            return await self._admin_service.update_infra_superadmin(data)
    
    return InfraSuperAdminServiceAdapter()


def get_saved_search_service_with_fallback() -> Any:
    """
    获取保存搜索服务，如果未注册则回退到直接导入
    
    Returns:
        保存搜索服务实例（SavedSearchServiceImpl）或适配器对象（向后兼容）
    """
    service = get_saved_search_service()
    if service:
        return service
    
    # 回退到直接导入（向后兼容）
    class SavedSearchServiceAdapter:
        """SavedSearchService 适配器"""
        def __init__(self):
            self._saved_search_service = SavedSearchService()
        
        async def list_saved_searches(self, page_path: str, user_id: int, include_shared: bool = True, tenant_id: Optional[int] = None) -> Dict[str, Any]:
            return await self._saved_search_service.list_saved_searches(page_path, user_id, include_shared, tenant_id)
        
        async def create_saved_search(self, data: Any, user_id: int, tenant_id: Optional[int] = None) -> Any:
            return await self._saved_search_service.create_saved_search(data, user_id, tenant_id)
        
        async def get_saved_search_by_uuid(self, uuid: str, user_id: int) -> Optional[Any]:
            return await self._saved_search_service.get_saved_search_by_uuid(uuid, user_id)
        
        async def update_saved_search(self, uuid: str, data: Any, user_id: int) -> Optional[Any]:
            return await self._saved_search_service.update_saved_search(uuid, data, user_id)
        
        async def delete_saved_search(self, uuid: str, user_id: int) -> bool:
            return await self._saved_search_service.delete_saved_search(uuid, user_id)
    
def get_biometric_service(request: Request) -> Any:
    """
    获取生物识别服务（依赖注入）

    WebAuthn 的 rp_id / expected_origin 必须与浏览器地址栏主机一致。
    从请求 Origin（或 Referer）解析，并校验落在 CORS / BASE_URL 允许集合内；
    无合法 Origin 时回退 FRONTEND_HOST:FRONTEND_PORT。
    """
    from urllib.parse import urlparse

    from infra.config.infra_config import infra_settings
    from infra.services.biometric_service import BiometricService

    def _normalize_origin(raw: str) -> str:
        raw = (raw or "").strip()
        if not raw:
            return ""
        parsed = urlparse(raw)
        if not parsed.scheme or not parsed.netloc:
            return ""
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    allowed: set[str] = {o.rstrip("/") for o in infra_settings.get_cors_origins()}
    base = (infra_settings.BASE_URL or "").strip().rstrip("/")
    if base:
        allowed.add(base)

    origin = _normalize_origin(request.headers.get("origin") or "")
    if not origin:
        origin = _normalize_origin(request.headers.get("referer") or "")

    if origin and origin not in allowed:
        # 生产显式 CORS 未含当前入口时，拒绝用错误 rp_id 蒙混，回退配置默认
        origin = ""

    if not origin:
        fh = (infra_settings.FRONTEND_HOST or "127.0.0.1").strip()
        # 浏览器在 localhost 上对 WebAuthn 有特殊放宽；127.0.0.1 与 localhost 视为同族回退
        if fh in ("127.0.0.1", "localhost", "::1"):
            origin = f"http://localhost:{infra_settings.FRONTEND_PORT}"
        else:
            origin = f"http://{fh}:{infra_settings.FRONTEND_PORT}"

    parsed = urlparse(origin)
    rp_id = parsed.hostname or "localhost"

    return BiometricService(
        rp_id=rp_id,
        rp_name=infra_settings.APP_NAME,
        origin=origin,
    )

