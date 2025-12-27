"""
套餐服务实现

将PackageService适配为PackageServiceInterface接口实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Any, Dict, Optional
from infra.services.interfaces.service_interface import PackageServiceInterface
from infra.services.package_service import PackageService


class PackageServiceImpl(PackageServiceInterface):
    """
    套餐服务实现类
    
    将 PackageService 适配为接口实现。
    """
    
    def __init__(self):
        self._package_service = PackageService()
    
    @property
    def service_name(self) -> str:
        return "package_service"
    
    @property
    def service_version(self) -> str:
        return "1.0.0"
    
    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "status": "healthy",
            "service": "package_service",
            "version": self.service_version
        }
    
    async def list_packages(
        self,
        page: int = 1,
        page_size: int = 10,
        **kwargs
    ) -> Dict[str, Any]:
        """获取套餐列表"""
        return await self._package_service.list_packages(
            page=page,
            page_size=page_size,
            **kwargs
        )
    
    async def get_package_by_id(self, package_id: int) -> Optional[Any]:
        """根据ID获取套餐"""
        return await self._package_service.get_package_by_id(package_id)

