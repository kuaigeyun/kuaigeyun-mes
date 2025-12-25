"""
层间事件通信系统

提供轻量级的事件驱动通信机制，实现层间解耦合。
各层可以通过事件进行异步通信，而不直接依赖。
"""

import asyncio
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class EventPriority(Enum):
    """事件优先级"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class Event:
    """事件数据结构"""
    name: str
    data: Dict[str, Any]
    source: str  # 事件源（层名或服务名）
    priority: EventPriority = EventPriority.NORMAL
    timestamp: Optional[float] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = asyncio.get_event_loop().time()


class EventBus:
    """
    事件总线

    管理事件的发布和订阅，实现层间异步通信。
    """

    _instance: Optional['EventBus'] = None
    _handlers: Dict[str, List[Callable]] = {}
    _running: bool = True

    def __new__(cls) -> 'EventBus':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._handlers = {}
            cls._instance._running = True
        return cls._instance

    @classmethod
    def get_instance(cls) -> 'EventBus':
        """获取事件总线实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def subscribe(self, event_name: str, handler: Callable) -> None:
        """
        订阅事件

        Args:
            event_name: 事件名称
            handler: 事件处理器函数
        """
        if event_name not in self._handlers:
            self._handlers[event_name] = []

        self._handlers[event_name].append(handler)
        logger.debug(f"✅ 订阅事件: {event_name} -> {handler.__name__}")

    def unsubscribe(self, event_name: str, handler: Callable) -> None:
        """
        取消订阅事件

        Args:
            event_name: 事件名称
            handler: 事件处理器函数
        """
        if event_name in self._handlers:
            try:
                self._handlers[event_name].remove(handler)
                logger.debug(f"✅ 取消订阅事件: {event_name} -> {handler.__name__}")
            except ValueError:
                logger.warning(f"⚠️ 尝试取消订阅不存在的事件处理器: {event_name} -> {handler.__name__}")

    async def publish(self, event: Event) -> None:
        """
        发布事件

        Args:
            event: 事件对象
        """
        if not self._running:
            return

        if event.name in self._handlers:
            logger.debug(f"📢 发布事件: {event.name} (来自: {event.source})")

            # 创建任务列表，避免阻塞
            tasks = []
            for handler in self._handlers[event.name]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        task = asyncio.create_task(handler(event))
                    else:
                        # 同步处理器在线程池中执行
                        task = asyncio.get_event_loop().run_in_executor(None, handler, event)
                    tasks.append(task)
                except Exception as e:
                    logger.error(f"❌ 创建事件处理器任务失败: {handler.__name__} - {e}")

            # 等待所有处理器完成（根据优先级）
            if event.priority == EventPriority.CRITICAL:
                # 关键事件等待完成
                await asyncio.gather(*tasks, return_exceptions=True)
            else:
                # 其他事件异步执行，不等待
                asyncio.create_task(self._process_tasks(tasks))
        else:
            logger.debug(f"ℹ️ 无处理器订阅事件: {event.name}")

    async def _process_tasks(self, tasks: List[asyncio.Task]) -> None:
        """处理异步任务，记录异常但不抛出"""
        if not tasks:
            return

        try:
            await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as e:
            logger.error(f"❌ 事件处理器执行失败: {e}")

    def publish_sync(self, event: Event) -> None:
        """
        同步发布事件（用于非异步上下文）

        Args:
            event: 事件对象
        """
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.publish(event))
        except RuntimeError:
            # 没有运行中的事件循环，使用新循环
            asyncio.run(self.publish(event))

    def shutdown(self) -> None:
        """关闭事件总线"""
        self._running = False
        self._handlers.clear()
        logger.info("🔄 事件总线已关闭")

    def get_subscribed_events(self) -> List[str]:
        """
        获取所有已订阅的事件名称

        Returns:
            List[str]: 事件名称列表
        """
        return list(self._handlers.keys())

    def get_event_handlers(self, event_name: str) -> List[str]:
        """
        获取指定事件的处理器名称列表

        Args:
            event_name: 事件名称

        Returns:
            List[str]: 处理器名称列表
        """
        if event_name in self._handlers:
            return [handler.__name__ for handler in self._handlers[event_name]]
        return []


# 便捷函数
def subscribe_event(event_name: str):
    """
    事件订阅装饰器

    Args:
        event_name: 事件名称

    Returns:
        装饰器函数
    """
    def decorator(func: Callable) -> Callable:
        event_bus = EventBus.get_instance()
        event_bus.subscribe(event_name, func)
        return func
    return decorator


def publish_event(
    event_name: str,
    data: Dict[str, Any],
    source: str,
    priority: EventPriority = EventPriority.NORMAL,
) -> None:
    """
    发布事件的便捷函数

    Args:
        event_name: 事件名称
        data: 事件数据
        source: 事件源
        priority: 事件优先级
    """
    event = Event(
        name=event_name,
        data=data,
        source=source,
        priority=priority,
    )

    event_bus = EventBus.get_instance()
    event_bus.publish_sync(event)


# 预定义的事件名称常量
class SystemEvents:
    """系统事件定义"""

    # 用户相关事件
    USER_LOGIN_SUCCESS = "user.login.success"
    USER_LOGIN_FAILED = "user.login.failed"
    USER_LOGOUT = "user.logout"
    USER_ACTIVITY_UPDATE = "user.activity.update"

    # 应用相关事件
    APP_INSTALLED = "app.installed"
    APP_UNINSTALLED = "app.uninstalled"
    APP_ENABLED = "app.enabled"
    APP_DISABLED = "app.disabled"

    # 系统相关事件
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"
    DATABASE_CONNECTED = "database.connected"
    CACHE_CONNECTED = "cache.connected"

    # 业务相关事件
    ORDER_CREATED = "order.created"
    ORDER_UPDATED = "order.updated"
    INVENTORY_LOW = "inventory.low"
    QUALITY_CHECK_FAILED = "quality.check.failed"


# 全局事件总线实例
event_bus = EventBus.get_instance()
