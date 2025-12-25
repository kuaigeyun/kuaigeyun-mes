"""
插件发现器

自动扫描和发现系统中所有可用的插件应用。
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class PluginManifest:
    """插件清单信息"""
    name: str
    code: str
    version: str
    description: str
    icon: str
    author: str
    entry_point: str
    route_path: str
    sort_order: int
    menu_config: Dict[str, Any]
    permissions: List[str]
    dependencies: Dict[str, str]


@dataclass
class DiscoveredPlugin:
    """发现的插件信息"""
    code: str
    path: Path
    manifest: PluginManifest
    is_valid: bool
    error_message: Optional[str] = None


class PluginDiscoveryService:
    """
    插件发现服务

    自动扫描 apps 目录，发现所有插件应用并读取其配置信息。
    """

    def __init__(self, apps_dir: Path):
        """
        初始化插件发现服务

        Args:
            apps_dir: 应用目录路径
        """
        self.apps_dir = apps_dir

    def discover_plugins(self) -> List[DiscoveredPlugin]:
        """
        发现所有插件应用

        Returns:
            List[DiscoveredPlugin]: 发现的插件列表
        """
        plugins = []

        if not self.apps_dir.exists():
            return plugins

        # 遍历 apps 目录下的所有子目录
        for plugin_dir in self.apps_dir.iterdir():
            if not plugin_dir.is_dir():
                continue

            plugin_code = plugin_dir.name

            # 读取插件清单
            manifest_path = plugin_dir / "manifest.json"
            if not manifest_path.exists():
                # 如果没有 manifest.json，创建一个基本的插件信息
                plugin = DiscoveredPlugin(
                    code=plugin_code,
                    path=plugin_dir,
                    manifest=self._create_basic_manifest(plugin_code, plugin_dir),
                    is_valid=False,
                    error_message="缺少 manifest.json 文件"
                )
            else:
                try:
                    manifest_data = self._load_manifest(manifest_path)
                    manifest = self._parse_manifest(manifest_data)
                    plugin = DiscoveredPlugin(
                        code=plugin_code,
                        path=plugin_dir,
                        manifest=manifest,
                        is_valid=True
                    )
                except Exception as e:
                    plugin = DiscoveredPlugin(
                        code=plugin_code,
                        path=plugin_dir,
                        manifest=self._create_basic_manifest(plugin_code, plugin_dir),
                        is_valid=False,
                        error_message=f"解析 manifest.json 失败: {str(e)}"
                    )

            plugins.append(plugin)

        return plugins

    def _load_manifest(self, manifest_path: Path) -> Dict[str, Any]:
        """加载插件清单文件"""
        with open(manifest_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _parse_manifest(self, data: Dict[str, Any]) -> PluginManifest:
        """解析插件清单数据"""
        return PluginManifest(
            name=data.get('name', ''),
            code=data.get('code', ''),
            version=data.get('version', '1.0.0'),
            description=data.get('description', ''),
            icon=data.get('icon', 'appstore'),
            author=data.get('author', ''),
            entry_point=data.get('entry_point', ''),
            route_path=data.get('route_path', ''),
            sort_order=data.get('sort_order', 0),
            menu_config=data.get('menu_config', {}),
            permissions=data.get('permissions', []),
            dependencies=data.get('dependencies', {})
        )

    def _create_basic_manifest(self, plugin_code: str, plugin_dir: Path) -> PluginManifest:
        """为没有 manifest.json 的插件创建基本清单"""
        return PluginManifest(
            name=plugin_code,
            code=plugin_code,
            version="1.0.0",
            description=f"{plugin_code} 应用",
            icon="appstore",
            author="RiverEdge Team",
            entry_point=f"../apps/{plugin_code}/index.tsx",
            route_path=f"/apps/{plugin_code}",
            sort_order=0,
            menu_config={},
            permissions=[],
            dependencies={}
        )
