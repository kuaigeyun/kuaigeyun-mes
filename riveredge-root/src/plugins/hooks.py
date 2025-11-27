"""
插件钩子系统模块

定义插件系统的钩子函数，用于在系统运行时提供扩展点。
插件可以通过钩子函数在特定时间点执行自定义逻辑。

钩子类型：
- 应用启动钩子：应用启动前/后执行
- 请求处理钩子：请求处理前/后执行
- 数据库操作钩子：数据库操作前/后执行
- 用户认证钩子：用户登录/登出时执行
"""

from typing import List, Callable, Any, Dict
from loguru import logger


class PluginHooks:
    """
    插件钩子管理器

    提供统一的钩子注册和执行接口，支持同步和异步钩子函数。
    """

    def __init__(self):
        """初始化钩子管理器"""
        self._hooks: Dict[str, List[Callable]] = {}

    def register_hook(self, hook_name: str, callback: Callable) -> None:
        """
        注册钩子函数

        Args:
            hook_name: 钩子名称
            callback: 钩子回调函数
        """
        if hook_name not in self._hooks:
            self._hooks[hook_name] = []

        self._hooks[hook_name].append(callback)
        logger.debug(f"注册钩子: {hook_name} -> {callback.__name__}")

    def unregister_hook(self, hook_name: str, callback: Callable) -> None:
        """
        取消注册钩子函数

        Args:
            hook_name: 钩子名称
            callback: 要取消注册的回调函数
        """
        if hook_name in self._hooks:
            try:
                self._hooks[hook_name].remove(callback)
                logger.debug(f"取消注册钩子: {hook_name} -> {callback.__name__}")
            except ValueError:
                logger.warning(f"钩子函数未找到: {hook_name} -> {callback.__name__}")

    async def execute_hook(self, hook_name: str, *args, **kwargs) -> List[Any]:
        """
        执行指定钩子的所有回调函数

        Args:
            hook_name: 钩子名称
            *args: 传递给回调函数的位置参数
            **kwargs: 传递给回调函数的关键字参数

        Returns:
            List[Any]: 所有回调函数的返回值列表
        """
        results = []

        if hook_name not in self._hooks:
            return results

        for callback in self._hooks[hook_name]:
            try:
                if hasattr(callback, '__call__'):
                    # 检查是否是异步函数
                    import asyncio
                    import inspect

                    if inspect.iscoroutinefunction(callback):
                        result = await callback(*args, **kwargs)
                    else:
                        # 在线程池中执行同步函数
                        loop = asyncio.get_event_loop()
                        result = await loop.run_in_executor(None, callback, *args, **kwargs)

                    results.append(result)
                    logger.debug(f"执行钩子成功: {hook_name} -> {callback.__name__}")
            except Exception as e:
                logger.error(f"执行钩子失败: {hook_name} -> {callback.__name__}: {e}")

        return results

    def get_registered_hooks(self) -> Dict[str, int]:
        """
        获取已注册的钩子统计信息

        Returns:
            Dict[str, int]: 钩子名称到注册函数数量的映射
        """
        return {name: len(callbacks) for name, callbacks in self._hooks.items()}

    def clear_hooks(self, hook_name: str = None) -> None:
        """
        清空钩子注册

        Args:
            hook_name: 要清空的钩子名称，如果为None则清空所有钩子
        """
        if hook_name:
            if hook_name in self._hooks:
                del self._hooks[hook_name]
                logger.debug(f"清空钩子: {hook_name}")
        else:
            self._hooks.clear()
            logger.debug("清空所有钩子")


# 预定义的钩子常量
class HookNames:
    """钩子名称常量"""

    # 应用生命周期钩子
    APP_STARTUP = "app_startup"
    APP_SHUTDOWN = "app_shutdown"

    # 请求处理钩子
    BEFORE_REQUEST = "before_request"
    AFTER_REQUEST = "after_request"

    # 用户认证钩子
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"

    # 数据库操作钩子
    BEFORE_DB_COMMIT = "before_db_commit"
    AFTER_DB_COMMIT = "after_db_commit"

    # 组织操作钩子
    TENANT_CREATED = "tenant_created"
    TENANT_UPDATED = "tenant_updated"
    TENANT_DELETED = "tenant_deleted"

    # 插件钩子
    PLUGIN_LOADED = "plugin_loaded"
    PLUGIN_UNLOADED = "plugin_unloaded"
