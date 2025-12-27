"""
平台级服务初始化器

初始化并注册所有平台级服务接口和实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from loguru import logger
from infra.services.service_registry import InfraServiceLocator
from infra.services.interfaces.service_interface import (
    AuthServiceInterface,
    TenantServiceInterface,
    PackageServiceInterface,
    InfraSuperAdminServiceInterface,
    SavedSearchServiceInterface,
)
from infra.services.interfaces.implementations.auth_service_impl import AuthServiceImpl
from infra.services.interfaces.implementations.tenant_service_impl import TenantServiceImpl
from infra.services.interfaces.implementations.package_service_impl import PackageServiceImpl
from infra.services.interfaces.implementations.infra_superadmin_service_impl import InfraSuperAdminServiceImpl
from infra.services.interfaces.implementations.saved_search_service_impl import SavedSearchServiceImpl


class InfraServiceInitializer:
    """
    平台级服务初始化器
    
    负责初始化并注册所有平台级服务接口和实现。
    """
    
    # 服务实现类映射
    _service_implementations = {
        "auth_service": AuthServiceImpl,
        "tenant_service": TenantServiceImpl,
        "package_service": PackageServiceImpl,
        "infra_superadmin_service": InfraSuperAdminServiceImpl,
        "saved_search_service": SavedSearchServiceImpl,
    }
    
    @classmethod
    async def initialize_services(cls) -> None:
        """
        初始化所有平台级服务
        
        创建服务实例并注册到服务注册表。
        """
        logger.info("开始初始化平台级服务...")
        
        for service_name, service_impl_class in cls._service_implementations.items():
            try:
                # 创建服务实例
                service_instance = service_impl_class()
                
                # 注册服务类型（接口）
                service_interface = None
                for base in service_impl_class.__bases__:
                    if hasattr(base, 'service_name'):
                        service_interface = base
                        break
                
                if service_interface:
                    # 注册服务类型（如果需要）
                    pass
                
                # 注册服务实例
                InfraServiceLocator.register_service(service_name, service_instance)
                logger.info(f"✅ 注册平台级服务: {service_name} ({service_impl_class.__name__})")
                
            except Exception as e:
                logger.error(f"❌ 注册平台级服务失败 {service_name}: {e}")
                import traceback
                traceback.print_exc()
        
        logger.info(f"✅ 平台级服务初始化完成，共注册 {len(cls._service_implementations)} 个服务")

