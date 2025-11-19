"""
插件注册器模块

负责插件的注册、管理和状态维护
"""

from typing import Dict, List, Optional, Any
from pathlib import Path
import json

from .base import Plugin, PluginMetadata, PluginState
from core.exceptions import ValidationError


class PluginRegistry:
    """
    插件注册器

    管理所有已注册的插件，包括状态维护和依赖关系处理
    """

    def __init__(self):
        self._plugins: Dict[str, Plugin] = {}
        self._plugin_order: List[str] = []  # 插件加载顺序

    def register(self, plugin: Plugin) -> None:
        """
        注册插件

        Args:
            plugin: 插件实例

        Raises:
            ValidationError: 当插件已存在或依赖不满足时
        """
        if plugin.name in self._plugins:
            raise ValidationError(f"插件 '{plugin.name}' 已被注册")

        # 验证依赖
        self._validate_dependencies(plugin)

        # 注册插件
        self._plugins[plugin.name] = plugin
        self._plugin_order.append(plugin.name)

        print(f"插件 '{plugin.name}' 已注册")

    def unregister(self, name: str) -> None:
        """
        取消注册插件

        Args:
            name: 插件名称

        Raises:
            ValidationError: 当插件不存在或正在使用时
        """
        if name not in self._plugins:
            raise ValidationError(f"插件 '{name}' 未注册")

        plugin = self._plugins[name]

        # 检查是否有其他插件依赖此插件
        dependents = self._get_dependents(name)
        if dependents:
            raise ValidationError(f"插件 '{name}' 正在被以下插件依赖: {dependents}")

        # 停用插件
        if plugin.is_active:
            plugin.on_deactivate()

        # 卸载插件
        plugin.on_unload()

        # 从注册表中移除
        del self._plugins[name]
        self._plugin_order.remove(name)

        print(f"插件 '{name}' 已取消注册")

    def get_plugin(self, name: str) -> Optional[Plugin]:
        """
        获取插件实例

        Args:
            name: 插件名称

        Returns:
            Plugin实例或None
        """
        return self._plugins.get(name)

    def get_all_plugins(self) -> Dict[str, Plugin]:
        """
        获取所有已注册的插件

        Returns:
            插件字典 {插件名: 插件实例}
        """
        return self._plugins.copy()

    def get_active_plugins(self) -> Dict[str, Plugin]:
        """
        获取所有激活的插件

        Returns:
            激活插件字典 {插件名: 插件实例}
        """
        return {
            name: plugin for name, plugin in self._plugins.items()
            if plugin.is_active
        }

    def activate_plugin(self, name: str) -> None:
        """
        激活插件

        Args:
            name: 插件名称

        Raises:
            ValidationError: 当插件不存在或依赖不满足时
        """
        if name not in self._plugins:
            raise ValidationError(f"插件 '{name}' 未注册")

        plugin = self._plugins[name]

        if plugin.is_active:
            return  # 已经激活

        # 确保依赖插件已激活
        for dep in plugin.metadata.dependencies:
            dep_plugin = self.get_plugin(dep)
            if not dep_plugin or not dep_plugin.is_active:
                raise ValidationError(f"插件 '{name}' 的依赖 '{dep}' 未激活")

        try:
            plugin.on_activate()
            print(f"插件 '{name}' 已激活")
        except Exception as e:
            plugin.state = PluginState.ERROR
            raise ValidationError(f"插件 '{name}' 激活失败: {e}")

    def deactivate_plugin(self, name: str) -> None:
        """
        停用插件

        Args:
            name: 插件名称

        Raises:
            ValidationError: 当插件不存在时
        """
        if name not in self._plugins:
            raise ValidationError(f"插件 '{name}' 未注册")

        plugin = self._plugins[name]

        if not plugin.is_active:
            return  # 已经停用

        try:
            plugin.on_deactivate()
            print(f"插件 '{name}' 已停用")
        except Exception as e:
            plugin.state = PluginState.ERROR
            print(f"插件 '{name}' 停用失败: {e}")

    def activate_all(self) -> None:
        """
        激活所有插件（按依赖顺序）
        """
        # 拓扑排序确保依赖顺序
        ordered_plugins = self._topological_sort()

        for name in ordered_plugins:
            try:
                self.activate_plugin(name)
            except ValidationError as e:
                print(f"跳过激活插件 '{name}': {e}")

    def deactivate_all(self) -> None:
        """
        停用所有插件（反向依赖顺序）
        """
        # 反向顺序停用
        for name in reversed(self._plugin_order):
            try:
                self.deactivate_plugin(name)
            except ValidationError as e:
                print(f"停用插件 '{name}' 时出错: {e}")

    def get_plugin_info(self, name: str) -> Optional[Dict[str, Any]]:
        """
        获取插件信息

        Args:
            name: 插件名称

        Returns:
            插件信息字典
        """
        plugin = self.get_plugin(name)
        if not plugin:
            return None

        return {
            "name": plugin.name,
            "version": plugin.version,
            "description": plugin.metadata.description,
            "author": plugin.metadata.author,
            "state": plugin.state.value,
            "is_active": plugin.is_active,
            "dependencies": plugin.metadata.dependencies,
            "provides": plugin.metadata.provides,
            "tags": plugin.metadata.tags
        }

    def list_plugins(self) -> List[Dict[str, Any]]:
        """
        列出所有插件信息

        Returns:
            插件信息列表
        """
        return [
            self.get_plugin_info(name)
            for name in self._plugin_order
            if self.get_plugin_info(name)
        ]

    def _validate_dependencies(self, plugin: Plugin) -> None:
        """
        验证插件依赖

        Args:
            plugin: 插件实例

        Raises:
            ValidationError: 当依赖不满足时
        """
        for dep in plugin.metadata.dependencies:
            if dep not in self._plugins:
                raise ValidationError(f"插件 '{plugin.name}' 依赖 '{dep}' 未注册")

            dep_plugin = self._plugins[dep]
            # 检查循环依赖
            if plugin.name in dep_plugin.metadata.dependencies:
                raise ValidationError(f"检测到循环依赖: '{plugin.name}' <-> '{dep}'")

    def _get_dependents(self, name: str) -> List[str]:
        """
        获取依赖指定插件的其他插件

        Args:
            name: 插件名称

        Returns:
            依赖插件名称列表
        """
        dependents = []
        for plugin_name, plugin in self._plugins.items():
            if name in plugin.metadata.dependencies:
                dependents.append(plugin_name)
        return dependents

    def _topological_sort(self) -> List[str]:
        """
        拓扑排序插件加载顺序

        Returns:
            排序后的插件名称列表
        """
        # 简单的拓扑排序实现
        visited = set()
        temp_visited = set()
        order = []

        def visit(name: str):
            if name in temp_visited:
                raise ValidationError(f"检测到循环依赖包含 '{name}'")
            if name in visited:
                return

            temp_visited.add(name)

            plugin = self._plugins[name]
            for dep in plugin.metadata.dependencies:
                if dep in self._plugins:  # 只处理已注册的依赖
                    visit(dep)

            temp_visited.remove(name)
            visited.add(name)
            order.append(name)

        # 对所有插件进行拓扑排序
        for name in self._plugin_order:
            if name not in visited:
                visit(name)

        return order
