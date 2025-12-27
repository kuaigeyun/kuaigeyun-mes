"""
服务注册表和定位器

提供服务注册、发现和定位的功能，实现层间解耦合。
通过接口编程，各层通过接口调用服务，而不是直接依赖具体实现。
"""

import asyncio
from typing import Dict, Type, Any, Optional, List
# ⚠️ 修复：移除 WeakValueDictionary，使用普通字典
import logging

from .service_interface import ServiceInterface

logger = logging.getLogger(__name__)


class ServiceRegistry:
    """
    服务注册表

    管理所有服务的注册、发现和生命周期。
    采用单例模式，确保全局唯一。
    """

    _instance: Optional['ServiceRegistry'] = None
    _services: Dict[str, ServiceInterface]  # ⚠️ 修复：使用普通字典而不是 WeakValueDictionary，避免服务被垃圾回收
    _service_types: Dict[str, Type[ServiceInterface]]
    _initialized: bool = False

    def __new__(cls) -> 'ServiceRegistry':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            # ⚠️ 修复：使用普通字典，确保服务实例不会被垃圾回收
            cls._instance._services = {}
            cls._instance._service_types = {}
        return cls._instance

    @classmethod
    def get_instance(cls) -> 'ServiceRegistry':
        """获取服务注册表实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_service_type(
        self,
        service_type: Type[ServiceInterface],
    ) -> None:
        """
        注册服务类型

        Args:
            service_type: 服务接口类型
        """
        # 从类属性获取服务名称
        service_name = getattr(service_type, 'service_name', service_type.__name__.lower().replace('interface', '_service'))

        self._service_types[service_name] = service_type
        logger.info(f"✅ 注册服务类型: {service_name}")

    def register_service(
        self,
        service_name: str,
        service_instance: ServiceInterface,
    ) -> None:
        """
        注册服务实例

        Args:
            service_name: 服务名称
            service_instance: 服务实例
        """
        if service_name not in self._service_types:
            raise ValueError(f"服务类型 {service_name} 未注册，请先注册服务类型")

        if not isinstance(service_instance, self._service_types[service_name]):
            raise TypeError(f"服务实例类型不匹配，期望 {self._service_types[service_name]}")

        self._services[service_name] = service_instance
        logger.info(f"✅ 注册服务实例: {service_name} ({type(service_instance).__name__})")

    def unregister_service(self, service_name: str) -> None:
        """
        注销服务实例

        Args:
            service_name: 服务名称
        """
        if service_name in self._services:
            del self._services[service_name]
            logger.info(f"✅ 注销服务实例: {service_name}")

    def get_service(self, service_name: str) -> ServiceInterface:
        """
        获取服务实例

        Args:
            service_name: 服务名称

        Returns:
            ServiceInterface: 服务实例

        Raises:
            ServiceNotFoundError: 服务未找到
        """
        if service_name not in self._services:
            available_services = list(self._services.keys())
            raise ServiceNotFoundError(
                f"服务 {service_name} 未找到，可用服务: {available_services}"
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

    def list_service_types(self) -> List[str]:
        """
        列出所有已注册的服务类型

        Returns:
            List[str]: 服务类型名称列表
        """
        return list(self._service_types.keys())

    async def health_check_all(self) -> Dict[str, Any]:
        """
        检查所有服务的健康状态

        Returns:
            Dict[str, Any]: 健康检查结果
        """
        results = {
            "overall_healthy": True,
            "services": {},
            "timestamp": asyncio.get_event_loop().time(),
        }

        for service_name, service in self._services.items():
            try:
                health_info = await service.health_check()
                results["services"][service_name] = {
                    "healthy": True,
                    "info": health_info,
                }
            except Exception as e:
                results["services"][service_name] = {
                    "healthy": False,
                    "error": str(e),
                }
                results["overall_healthy"] = False
                logger.error(f"服务 {service_name} 健康检查失败: {e}")

        return results

    def clear_all(self) -> None:
        """清空所有服务注册（用于测试或重置）"""
        self._services.clear()
        self._service_types.clear()
        logger.info("🧹 清空所有服务注册")


class ServiceLocator:
    """
    服务定位器

    提供便捷的服务定位功能，是ServiceRegistry的简化接口。
    """

    _registry: ServiceRegistry = ServiceRegistry.get_instance()

    @staticmethod
    def register_service_type(service_type: Type[ServiceInterface]) -> None:
        """
        注册服务类型

        Args:
            service_type: 服务接口类型
        """
        ServiceLocator._registry.register_service_type(service_type)

    @staticmethod
    def register_service(service_name: str, service_instance: ServiceInterface) -> None:
        """
        注册服务实例

        Args:
            service_name: 服务名称
            service_instance: 服务实例
        """
        ServiceLocator._registry.register_service(service_name, service_instance)

    @staticmethod
    def get_service(service_name: str) -> ServiceInterface:
        """
        获取服务实例

        Args:
            service_name: 服务名称

        Returns:
            ServiceInterface: 服务实例
        """
        return ServiceLocator._registry.get_service(service_name)

    @staticmethod
    def has_service(service_name: str) -> bool:
        """
        检查服务是否已注册

        Args:
            service_name: 服务名称

        Returns:
            bool: 是否已注册
        """
        return ServiceLocator._registry.has_service(service_name)


class ServiceNotFoundError(Exception):
    """服务未找到异常"""
    pass


# 便捷的装饰器
def service_implementation(service_interface: Type[ServiceInterface]):
    """
    服务实现装饰器

    用于标记某个类是特定服务接口的实现，会自动注册到服务注册表。

    Args:
        service_interface: 服务接口类型

    Returns:
        装饰器函数
    """
    def decorator(cls: Type) -> Type:
        # 注册服务类型
        ServiceLocator.register_service_type(service_interface)

        # 标记这个类是服务实现
        cls._service_interface = service_interface
        cls._is_service_implementation = True

        return cls

    return decorator


# 全局服务注册表实例
service_registry = ServiceRegistry.get_instance()
