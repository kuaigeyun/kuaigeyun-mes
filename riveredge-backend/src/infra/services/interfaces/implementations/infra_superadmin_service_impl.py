"""
平台超级管理员服务实现

将InfraSuperAdminService适配为InfraSuperAdminServiceInterface接口实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Any, Dict, Optional
from infra.services.interfaces.service_interface import InfraSuperAdminServiceInterface
from infra.services.infra_superadmin_service import InfraSuperAdminService


class InfraSuperAdminServiceImpl(InfraSuperAdminServiceInterface):
    """
    平台超级管理员服务实现类
    
    将 InfraSuperAdminService 适配为接口实现。
    """
    
    def __init__(self):
        self._admin_service = InfraSuperAdminService()
    
    @property
    def service_name(self) -> str:
        return "infra_superadmin_service"
    
    @property
    def service_version(self) -> str:
        return "1.0.0"
    
    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "status": "healthy",
            "service": "infra_superadmin_service",
            "version": self.service_version
        }
    
    async def get_current_admin(self) -> Optional[Any]:
        """获取当前平台超级管理员"""
        return await self._admin_service.get_infra_superadmin()
    
    async def create_admin(self, data: Any) -> Any:
        """创建平台超级管理员"""
        return await self._admin_service.create_infra_superadmin(data)
    
    async def update_admin(self, data: Any) -> Any:
        """更新平台超级管理员"""
        return await self._admin_service.update_infra_superadmin(data)
    
    # 向后兼容：也支持直接调用原方法名
    async def create_infra_superadmin(self, data: Any) -> Any:
        """创建平台超级管理员（向后兼容方法名）"""
        return await self._admin_service.create_infra_superadmin(data)
    
    async def update_infra_superadmin(self, data: Any) -> Any:
        """更新平台超级管理员（向后兼容方法名）"""
        return await self._admin_service.update_infra_superadmin(data)

