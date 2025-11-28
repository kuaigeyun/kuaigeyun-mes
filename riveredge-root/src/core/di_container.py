"""
依赖注入容器模块

提供简单的依赖注入容器，实现服务的注册、解析和管理
"""

import inspect
from typing import Dict, Type, Any, Optional, Callable, TypeVar, Generic
from contextlib import asynccontextmanager
from loguru import logger

T = TypeVar('T')


class DependencyContainer:
    """
    依赖注入容器

    提供服务的注册、解析和生命周期管理
    """

    def __init__(self):
        self._services: Dict[Type, Dict[str, Any]] = {}
        self._singletons: Dict[Type, Any] = {}
        self._factories: Dict[Type, Callable] = {}

    def register(
        self,
        service_type: Type[T],
        implementation: Optional[Type[T]] = None,
        factory: Optional[Callable[[], T]] = None,
        singleton: bool = True
    ):
        """
        注册服务

        Args:
            service_type: 服务接口类型
            implementation: 服务实现类（可选）
            factory: 服务工厂函数（可选）
            singleton: 是否为单例模式
        """
        if factory:
            self._factories[service_type] = factory
            self._services[service_type] = {
                "factory": factory,
                "singleton": singleton
            }
        elif implementation:
            self._services[service_type] = {
                "implementation": implementation,
                "singleton": singleton
            }
        else:
            raise ValueError("必须提供 implementation 或 factory")

        logger.debug(f"服务已注册: {service_type.__name__}")

    def register_instance(self, service_type: Type[T], instance: T):
        """
        注册服务实例（用于单例）

        Args:
            service_type: 服务类型
            instance: 服务实例
        """
        self._singletons[service_type] = instance
        logger.debug(f"服务实例已注册: {service_type.__name__}")

    async def resolve(self, service_type: Type[T]) -> T:
        """
        解析服务

        Args:
            service_type: 服务类型

        Returns:
            T: 服务实例

        Raises:
            ValueError: 当服务未注册时抛出
        """
        # 检查单例缓存
        if service_type in self._singletons:
            return self._singletons[service_type]

        # 检查服务注册
        if service_type not in self._services:
            raise ValueError(f"服务未注册: {service_type.__name__}")

        service_config = self._services[service_type]

        # 使用工厂函数
        if "factory" in service_config:
            instance = service_config["factory"]()
        else:
            # 使用实现类
            implementation = service_config["implementation"]

            # 检查是否需要异步初始化
            if inspect.iscoroutinefunction(implementation.__init__):
                instance = await implementation()
            else:
                instance = implementation()

        # 如果是单例，缓存实例
        if service_config["singleton"]:
            self._singletons[service_type] = instance

        logger.debug(f"服务已解析: {service_type.__name__}")
        return instance

    def unregister(self, service_type: Type[T]):
        """
        取消注册服务

        Args:
            service_type: 服务类型
        """
        if service_type in self._services:
            del self._services[service_type]
        if service_type in self._singletons:
            del self._singletons[service_type]
        if service_type in self._factories:
            del self._factories[service_type]

        logger.debug(f"服务已取消注册: {service_type.__name__}")

    def clear(self):
        """
        清空所有注册的服务
        """
        self._services.clear()
        self._singletons.clear()
        self._factories.clear()
        logger.debug("所有服务已清空")


# 全局依赖注入容器实例
container = DependencyContainer()


# 服务注册装饰器

def service(
    service_type: Optional[Type] = None,
    singleton: bool = True
) -> Callable:
    """
    服务注册装饰器

    Args:
        service_type: 服务类型（可选，默认使用类本身）
        singleton: 是否为单例

    Returns:
        Callable: 装饰器函数
    """
    def decorator(cls: Type[T]) -> Type[T]:
        actual_service_type = service_type or cls
        container.register(actual_service_type, implementation=cls, singleton=singleton)
        return cls
    return decorator


# 依赖注入函数

async def inject(service_type: Type[T]) -> T:
    """
    注入服务依赖

    Args:
        service_type: 服务类型

    Returns:
        T: 服务实例
    """
    return await container.resolve(service_type)


# FastAPI 依赖注入适配器

def get_service(service_type: Type[T]) -> Callable:
    """
    获取 FastAPI 依赖注入函数

    Args:
        service_type: 服务类型

    Returns:
        Callable: FastAPI 依赖注入函数
    """
    async def dependency() -> T:
        return await container.resolve(service_type)
    return dependency


# 上下文管理器

@asynccontextmanager
async def dependency_scope():
    """
    依赖注入作用域上下文管理器

    用于在特定作用域内管理依赖的生命周期
    """
    try:
        yield container
    finally:
        # 这里可以添加清理逻辑
        pass


# 初始化常用服务

async def init_services():
    """
    初始化常用服务

    注册应用中常用的服务到容器中
    """
    from services.user_service import UserService
    from services.tenant_service import TenantService
    from services.auth_service import AuthService
    from core.cache.cache_manager import cache_manager

    # 注册服务
    container.register_instance(UserService, UserService())
    container.register_instance(TenantService, TenantService())
    container.register_instance(AuthService, AuthService())
    container.register_instance(type(cache_manager), cache_manager)

    logger.info("依赖注入服务初始化完成")


# 便捷的类型别名

ServiceContainer = DependencyContainer

__all__ = [
    "DependencyContainer",
    "ServiceContainer",
    "container",
    "service",
    "inject",
    "get_service",
    "dependency_scope",
    "init_services"
]
