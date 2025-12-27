"""
服务初始化器

负责在应用启动时初始化和注册所有服务接口及其实现。
确保各层之间的服务依赖正确建立。
"""

import logging
from typing import List, Type

from .service_interface import (
    ServiceInterface,
    UserActivityServiceInterface,
    AuditLogServiceInterface,
    ApplicationServiceInterface,
    UserServiceInterface,
    RoleServiceInterface,
    MessageServiceInterface,
)
from .implementations.user_activity_service_impl import UserActivityServiceImpl
from .implementations.audit_log_service_impl import AuditLogServiceImpl
from .implementations.application_service_impl import ApplicationServiceImpl
from .implementations.user_service_impl import UserServiceImpl
from .implementations.role_service_impl import RoleServiceImpl
from .implementations.message_service_impl import MessageServiceImpl
from .service_registry import ServiceLocator

logger = logging.getLogger(__name__)


class ServiceInitializer:
    """
    服务初始化器

    管理所有服务接口和实现的初始化和注册。
    """

    # 需要注册的服务实现列表
    _service_implementations: List[Type] = [
        UserActivityServiceImpl,
        AuditLogServiceImpl,
        ApplicationServiceImpl,
        # ⚠️ 第二阶段改进：添加高频使用的服务
        UserServiceImpl,
        RoleServiceImpl,
        MessageServiceImpl,
    ]

    @staticmethod
    async def initialize_services() -> None:
        """
        初始化所有服务

        注册服务类型并实例化服务实现。
        """
        logger.info("🔄 开始初始化服务接口层...")

        try:
            # 注册所有服务实现
            for service_impl_class in ServiceInitializer._service_implementations:
                await ServiceInitializer._register_service_implementation(service_impl_class)

            logger.info("✅ 服务接口层初始化完成")

        except Exception as e:
            logger.error(f"❌ 服务接口层初始化失败: {e}")
            raise

    @staticmethod
    async def _register_service_implementation(
        service_impl_class: Type,
    ) -> None:
        """
        注册单个服务实现

        Args:
            service_impl_class: 服务实现类
        """
        try:
            # 创建服务实例
            service_instance = service_impl_class()

            # 获取服务名称
            service_name = service_instance.service_name

            # ⚠️ 第二阶段改进：先注册服务类型，再注册服务实例
            # 获取服务接口类型（从实现类的基类中获取）
            service_interface = None
            for base in service_impl_class.__bases__:
                if hasattr(base, 'service_name'):
                    service_interface = base
                    break
            
            if service_interface:
                ServiceLocator.register_service_type(service_interface)

            # 注册到服务定位器
            ServiceLocator.register_service(service_name, service_instance)

            logger.debug(f"✅ 注册服务实现: {service_name} -> {service_impl_class.__name__}")

        except Exception as e:
            logger.error(f"❌ 注册服务实现失败 {service_impl_class.__name__}: {e}")
            raise

    @staticmethod
    async def shutdown_services() -> None:
        """
        关闭所有服务

        清理服务资源。
        """
        logger.info("🔄 开始关闭服务接口层...")

        try:
            # 这里可以添加服务清理逻辑
            # 比如关闭数据库连接、清理缓存等

            logger.info("✅ 服务接口层关闭完成")

        except Exception as e:
            logger.error(f"❌ 服务接口层关闭失败: {e}")
            raise

    @staticmethod
    async def health_check() -> dict:
        """
        服务层健康检查

        Returns:
            dict: 健康检查结果
        """
        from .service_registry import service_registry

        return await service_registry.health_check_all()
