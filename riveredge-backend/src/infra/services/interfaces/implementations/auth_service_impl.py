"""
认证服务实现

将AuthService适配为AuthServiceInterface接口实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Any, Dict
from infra.services.interfaces.service_interface import AuthServiceInterface
from infra.services.auth_service import AuthService


class AuthServiceImpl(AuthServiceInterface):
    """
    认证服务实现类
    
    将 AuthService 适配为接口实现。
    """
    
    def __init__(self):
        self._auth_service = AuthService()
    
    @property
    def service_name(self) -> str:
        return "auth_service"
    
    @property
    def service_version(self) -> str:
        return "1.0.0"
    
    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "status": "healthy",
            "service": "auth_service",
            "version": self.service_version
        }
    
    async def login(self, data: Any, request: Any) -> Dict[str, Any]:
        """用户登录"""
        return await self._auth_service.login(data, request)
    
    async def register(self, data: Any) -> Any:
        """用户注册"""
        return await self._auth_service.register(data)
    
    async def guest_login(self, request: Any = None) -> Dict[str, Any]:
        """体验登录"""
        return await self._auth_service.guest_login(request)
    
    async def register_personal(self, data: Any) -> Dict[str, Any]:
        """个人注册"""
        return await self._auth_service.register_personal(data)
    
    async def register_organization(self, data: Any) -> Dict[str, Any]:
        """组织注册"""
        return await self._auth_service.register_organization(data)

