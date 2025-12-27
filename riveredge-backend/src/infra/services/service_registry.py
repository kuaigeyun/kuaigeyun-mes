"""
平台级服务注册表

为平台级服务提供统一的管理机制，与系统级服务注册表分离。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Dict, Type, Any, Optional, List
from loguru import logger


class InfraServiceRegistry:
    """
    平台级服务注册表
    
    管理所有平台级服务的注册、发现和生命周期。
    采用单例模式，确保全局唯一。
    
    Author: Luigi Lu
    Date: 2025-12-27
    """
    
    _instance: Optional['InfraServiceRegistry'] = None
    _services: Dict[str, Any]  # ⚠️ 修复：使用普通Dict而不是WeakValueDictionary，避免服务实例被垃圾回收
    
    def __new__(cls) -> 'InfraServiceRegistry':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._services = {}  # ⚠️ 修复：使用普通字典
        return cls._instance
    
    @classmethod
    def get_instance(cls) -> 'InfraServiceRegistry':
        """获取服务注册表实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def register_service(
        self,
        service_name: str,
        service_instance: Any,
    ) -> None:
        """
        注册服务实例
        
        Args:
            service_name: 服务名称
            service_instance: 服务实例
        """
        self._services[service_name] = service_instance
        logger.info(f"✅ 注册平台级服务: {service_name} ({type(service_instance).__name__})")
    
    def unregister_service(self, service_name: str) -> None:
        """
        注销服务实例
        
        Args:
            service_name: 服务名称
        """
        if service_name in self._services:
            del self._services[service_name]
            logger.info(f"✅ 注销平台级服务: {service_name}")
    
    def get_service(self, service_name: str) -> Any:
        """
        获取服务实例
        
        Args:
            service_name: 服务名称
            
        Returns:
            Any: 服务实例
            
        Raises:
            ServiceNotFoundError: 服务未找到
        """
        if service_name not in self._services:
            available_services = list(self._services.keys())
            raise ServiceNotFoundError(
                f"平台级服务 {service_name} 未找到，可用服务: {available_services}"
            )
        
        return self._services[service_name]
    
    def has_service(self, service_name: str) -> bool:
        """
        检查服务是否已注册
        
        Args:
            service_name: 服务名称
            
        Returns:
            bool: 是否已注册
        """
        return service_name in self._services
    
    def list_services(self) -> List[str]:
        """
        列出所有已注册的服务
        
        Returns:
            List[str]: 服务名称列表
        """
        return list(self._services.keys())
    
    def clear_all(self) -> None:
        """清空所有服务注册（用于测试或重置）"""
        self._services.clear()
        logger.info("🧹 清空所有平台级服务注册")


class InfraServiceLocator:
    """
    平台级服务定位器
    
    提供便捷的服务定位功能，是InfraServiceRegistry的简化接口。
    """
    
    _registry: InfraServiceRegistry = InfraServiceRegistry.get_instance()
    
    @staticmethod
    def register_service(service_name: str, service_instance: Any) -> None:
        """
        注册服务实例
        
        Args:
            service_name: 服务名称
            service_instance: 服务实例
        """
        InfraServiceLocator._registry.register_service(service_name, service_instance)
    
    @staticmethod
    def get_service(service_name: str) -> Any:
        """
        获取服务实例
        
        Args:
            service_name: 服务名称
            
        Returns:
            Any: 服务实例
        """
        return InfraServiceLocator._registry.get_service(service_name)
    
    @staticmethod
    def has_service(service_name: str) -> bool:
        """
        检查服务是否已注册
        
        Args:
            service_name: 服务名称
            
        Returns:
            bool: 是否已注册
        """
        return InfraServiceLocator._registry.has_service(service_name)
    
    @staticmethod
    def list_services() -> List[str]:
        """
        列出所有已注册的服务
        
        Returns:
            List[str]: 服务名称列表
        """
        return InfraServiceLocator._registry.list_services()


class ServiceNotFoundError(Exception):
    """服务未找到异常"""
    pass


# 全局服务注册表实例
infra_service_registry = InfraServiceRegistry.get_instance()

