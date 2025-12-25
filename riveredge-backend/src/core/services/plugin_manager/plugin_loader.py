"""
插件加载器

动态加载和注册插件路由。
"""

import importlib
from pathlib import Path
from typing import Dict, List, Any, Optional
from fastapi import APIRouter

from .plugin_discovery import PluginDiscoveryService, DiscoveredPlugin


class PluginLoaderService:
    """
    插件加载服务

    根据插件的启用状态动态加载和注册插件路由。
    """

    def __init__(self, apps_dir: Path):
        """
        初始化插件加载服务

        Args:
            apps_dir: 应用目录路径
        """
        self.apps_dir = apps_dir
        self.discovery_service = PluginDiscoveryService(apps_dir)

    def load_enabled_plugins(self, enabled_plugins: List[str]) -> List[Dict[str, Any]]:
        """
        加载所有启用的插件

        Args:
            enabled_plugins: 启用的插件代码列表

        Returns:
            List[Dict[str, Any]]: 加载成功的插件信息列表
        """
        # 发现所有插件
        discovered_plugins = self.discovery_service.discover_plugins()

        loaded_plugins = []

        for plugin in discovered_plugins:
            if plugin.code not in enabled_plugins:
                print(f"⏸️ 跳过插件 {plugin.code} (未启用)")
                continue

            if not plugin.is_valid:
                print(f"⚠️ 跳过无效插件 {plugin.code}: {plugin.error_message}")
                continue

            try:
                # 加载插件路由
                routers = self._load_plugin_routers(plugin)
                if routers:
                    loaded_plugins.append({
                        'code': plugin.code,
                        'name': plugin.manifest.name,
                        'routers': routers,
                        'manifest': plugin.manifest
                    })
                    print(f"✅ 插件 {plugin.code} 加载成功，注册了 {len(routers)} 个路由")
                else:
                    print(f"⚠️ 插件 {plugin.code} 没有找到可用的路由")

            except Exception as e:
                print(f"❌ 加载插件 {plugin.code} 失败: {str(e)}")
                import traceback
                traceback.print_exc()

        return loaded_plugins

    def _load_plugin_routers(self, plugin: DiscoveredPlugin) -> List[APIRouter]:
        """
        加载插件的路由

        Args:
            plugin: 插件信息

        Returns:
            List[APIRouter]: 插件的路由列表
        """
        routers = []

        try:
            # 尝试导入插件的 API 模块
            api_module_path = f"apps.{plugin.code}.api"

            try:
                # 首先尝试导入整个 api 模块
                api_module = importlib.import_module(api_module_path)

                # 查找所有 APIRouter 对象
                for attr_name in dir(api_module):
                    attr = getattr(api_module, attr_name)
                    if isinstance(attr, APIRouter):
                        routers.append(attr)
                        print(f"  📍 从 {api_module_path} 注册路由: {attr_name}")

            except ImportError:
                # 如果整个模块导入失败，尝试导入子模块
                self._load_plugin_submodule_routers(plugin, api_module_path, routers)

        except Exception as e:
            print(f"  ⚠️ 加载插件 {plugin.code} 的路由时出错: {str(e)}")

        return routers

    def _load_plugin_submodule_routers(self, plugin: DiscoveredPlugin, api_module_path: str, routers: List[APIRouter]):
        """
        加载插件子模块的路由

        Args:
            plugin: 插件信息
            api_module_path: API模块路径
            routers: 路由列表
        """
        api_dir = plugin.path / "api"

        if not api_dir.exists():
            return

        # 遍历 API 目录下的所有子目录
        for subdir in api_dir.iterdir():
            if not subdir.is_dir():
                continue

            # 遍历子目录中的 Python 文件
            for py_file in subdir.glob("*.py"):
                if py_file.name == "__init__.py":
                    continue

                module_name = py_file.stem
                submodule_path = f"{api_module_path}.{subdir.name}.{module_name}"

                try:
                    module = importlib.import_module(submodule_path)

                    # 查找路由对象
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if isinstance(attr, APIRouter):
                            routers.append(attr)
                            print(f"  📍 从 {submodule_path} 注册路由: {attr_name}")

                except Exception as e:
                    print(f"  ⚠️ 加载子模块 {submodule_path} 失败: {str(e)}")

    def get_available_plugins(self) -> List[Dict[str, Any]]:
        """
        获取所有可用的插件信息

        Returns:
            List[Dict[str, Any]]: 插件信息列表
        """
        discovered_plugins = self.discovery_service.discover_plugins()

        available_plugins = []
        for plugin in discovered_plugins:
            available_plugins.append({
                'code': plugin.code,
                'name': plugin.manifest.name,
                'version': plugin.manifest.version,
                'description': plugin.manifest.description,
                'icon': plugin.manifest.icon,
                'author': plugin.manifest.author,
                'is_valid': plugin.is_valid,
                'error_message': plugin.error_message
            })

        return available_plugins
