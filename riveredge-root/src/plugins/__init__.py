"""
插件系统模块

RiverEdge 后端插件系统，提供系统功能插件的注册、加载和管理。
插件系统支持自制和第三方系统功能插件的动态加载。

插件类型：
- 系统功能插件：位于 riveredge-core/src/plugins/
- 业务应用插件：位于 riveredge-seed/（保持原有架构）

插件功能：
- API 路由扩展
- 服务组件注册
- 数据模型扩展
- 中间件注入
- 钩子函数注册
"""

from .registry import PluginRegistry
from .loader import PluginLoader
from .base import Plugin, PluginMetadata
from .hooks import PluginHooks

# 全局插件注册器和加载器实例
plugin_registry = PluginRegistry()
plugin_loader = PluginLoader()
plugin_hooks = PluginHooks()

__all__ = [
    "Plugin",
    "PluginMetadata",
    "PluginRegistry",
    "PluginLoader",
    "PluginHooks",
    "plugin_registry",
    "plugin_loader",
    "plugin_hooks"
]
