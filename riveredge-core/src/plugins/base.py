"""
插件基类模块

定义插件的基本结构和生命周期接口
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum


class PluginState(Enum):
    """插件状态枚举"""
    UNLOADED = "unloaded"      # 未加载
    LOADING = "loading"        # 加载中
    LOADED = "loaded"          # 已加载
    ACTIVATING = "activating"  # 激活中
    ACTIVE = "active"          # 已激活
    DEACTIVATING = "deactivating"  # 停用中
    INACTIVE = "inactive"      # 已停用
    ERROR = "error"           # 错误状态


@dataclass
class PluginMetadata:
    """插件元数据"""
    name: str                           # 插件名称
    version: str                       # 插件版本
    description: str                   # 插件描述
    author: str                        # 插件作者
    dependencies: List[str] = field(default_factory=list)  # 依赖插件列表
    requires: List[str] = field(default_factory=list)      # 必需的系统组件
    provides: List[str] = field(default_factory=list)      # 提供的功能
    config_schema: Optional[Dict[str, Any]] = None         # 配置模式
    tags: List[str] = field(default_factory=list)          # 标签
    homepage: Optional[str] = None      # 主页
    license: Optional[str] = None       # 许可证


class Plugin(ABC):
    """
    插件基类

    所有插件都必须继承此类，实现相应的生命周期方法
    """

    def __init__(self, metadata: PluginMetadata):
        self.metadata = metadata
        self.state = PluginState.UNLOADED
        self.config: Dict[str, Any] = {}
        self._hooks: Dict[str, List[Callable]] = {}

    @property
    def name(self) -> str:
        """插件名称"""
        return self.metadata.name

    @property
    def version(self) -> str:
        """插件版本"""
        return self.metadata.version

    @property
    def is_active(self) -> bool:
        """插件是否激活"""
        return self.state == PluginState.ACTIVE

    def set_config(self, config: Dict[str, Any]) -> None:
        """
        设置插件配置

        Args:
            config: 配置字典
        """
        self.config.update(config)

    def get_config(self, key: str, default: Any = None) -> Any:
        """
        获取配置值

        Args:
            key: 配置键
            default: 默认值

        Returns:
            配置值
        """
        return self.config.get(key, default)

    # 生命周期方法

    def on_load(self) -> None:
        """
        插件加载时调用

        用于插件初始化，注册钩子等
        """
        self.state = PluginState.LOADING
        pass

    def on_unload(self) -> None:
        """
        插件卸载时调用

        用于清理资源，取消注册等
        """
        self.state = PluginState.UNLOADED
        pass

    def on_activate(self) -> None:
        """
        插件激活时调用

        用于启动插件功能
        """
        self.state = PluginState.ACTIVATING
        self.state = PluginState.ACTIVE

    def on_deactivate(self) -> None:
        """
        插件停用时调用

        用于暂停插件功能
        """
        self.state = PluginState.DEACTIVATING
        self.state = PluginState.INACTIVE

    # 可选实现的方法

    def get_api_routes(self) -> Optional[Any]:
        """
        获取插件提供的API路由

        Returns:
            FastAPI路由对象或None
        """
        return None

    def get_models(self) -> List[Any]:
        """
        获取插件提供的数据模型

        Returns:
            数据模型类列表
        """
        return []

    def get_services(self) -> Dict[str, Any]:
        """
        获取插件提供的服务

        Returns:
            服务字典 {服务名: 服务实例}
        """
        return {}

    def get_middlewares(self) -> List[Any]:
        """
        获取插件提供的中间件

        Returns:
            中间件列表
        """
        return []

    def get_commands(self) -> Dict[str, Callable]:
        """
        获取插件提供的命令行命令

        Returns:
            命令字典 {命令名: 命令函数}
        """
        return {}

    def register_hook(self, hook_name: str, callback: Callable) -> None:
        """
        注册钩子函数

        Args:
            hook_name: 钩子名称
            callback: 回调函数
        """
        if hook_name not in self._hooks:
            self._hooks[hook_name] = []
        self._hooks[hook_name].append(callback)

    def unregister_hook(self, hook_name: str, callback: Callable) -> None:
        """
        取消注册钩子函数

        Args:
            hook_name: 钩子名称
            callback: 回调函数
        """
        if hook_name in self._hooks:
            self._hooks[hook_name].remove(callback)
            if not self._hooks[hook_name]:
                del self._hooks[hook_name]

    def trigger_hook(self, hook_name: str, *args, **kwargs) -> List[Any]:
        """
        触发钩子函数

        Args:
            hook_name: 钩子名称
            *args: 位置参数
            **kwargs: 关键字参数

        Returns:
            钩子函数返回值列表
        """
        results = []
        if hook_name in self._hooks:
            for callback in self._hooks[hook_name]:
                try:
                    result = callback(*args, **kwargs)
                    results.append(result)
                except Exception as e:
                    # 钩子函数执行失败不应该影响主流程
                    print(f"Hook {hook_name} execution failed: {e}")
        return results
