"""
插件加载器模块

负责从文件系统加载插件，支持多种加载方式
"""

import importlib.util
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
import json

from .base import Plugin, PluginMetadata
from .registry import PluginRegistry
from core.exceptions import ValidationError


class PluginLoader:
    """
    插件加载器

    支持从指定目录加载插件，支持配置文件和自动发现
    """

    def __init__(self, plugin_dirs: Optional[List[Path]] = None):
        """
        初始化加载器

        Args:
            plugin_dirs: 插件目录列表，默认使用标准目录
        """
        if plugin_dirs is None:
            # 默认插件目录
            plugins_base = Path(__file__).parent
            plugin_dirs = [
                plugins_base / "builtin",      # 自制插件目录
                plugins_base / "thirdparty",   # 第三方插件目录
            ]
        self.plugin_dirs = plugin_dirs
        self._loaded_modules = {}  # 已加载的模块缓存

    def load_from_directory(self, directory: Path, registry: PluginRegistry) -> int:
        """
        从目录加载插件

        Args:
            directory: 插件目录
            registry: 插件注册器

        Returns:
            int: 加载的插件数量
        """
        if not directory.exists():
            print(f"插件目录不存在: {directory}")
            return 0

        loaded_count = 0

        # 查找插件配置文件
        config_files = list(directory.glob("*/plugin.json"))
        config_files.extend(directory.glob("*/plugin.toml"))
        config_files.extend(directory.glob("*/plugin.yaml"))

        for config_file in config_files:
            try:
                plugin_dir = config_file.parent
                plugin_name = plugin_dir.name

                # 加载插件配置
                metadata = self._load_plugin_metadata(config_file)
                if not metadata:
                    continue

                # 加载插件模块
                plugin_instance = self._load_plugin_module(plugin_dir, metadata)
                if plugin_instance:
                    registry.register(plugin_instance)
                    loaded_count += 1
                    print(f"成功加载插件: {plugin_name}")

            except Exception as e:
                print(f"加载插件失败 {config_file.parent.name}: {e}")

        return loaded_count

    def load_all_directories(self, registry: PluginRegistry) -> int:
        """
        从所有配置的目录加载插件

        Args:
            registry: 插件注册器

        Returns:
            int: 总共加载的插件数量
        """
        total_loaded = 0

        for directory in self.plugin_dirs:
            loaded = self.load_from_directory(directory, registry)
            total_loaded += loaded

        print(f"插件加载完成，共加载 {total_loaded} 个插件")
        return total_loaded

    def reload_plugin(self, name: str, registry: PluginRegistry) -> bool:
        """
        重新加载插件

        Args:
            name: 插件名称
            registry: 插件注册器

        Returns:
            bool: 是否成功重新加载
        """
        plugin = registry.get_plugin(name)
        if not plugin:
            print(f"插件 '{name}' 未找到")
            return False

        try:
            # 停用插件
            if plugin.is_active:
                plugin.on_deactivate()

            # 卸载插件
            plugin.on_unload()

            # 重新加载模块
            plugin_dir = self._find_plugin_directory(name)
            if plugin_dir:
                metadata = self._load_plugin_metadata(plugin_dir / "plugin.json")
                if metadata:
                    new_plugin = self._load_plugin_module(plugin_dir, metadata)
                    if new_plugin:
                        # 重新注册
                        registry.unregister(name)
                        registry.register(new_plugin)
                        print(f"插件 '{name}' 重新加载成功")
                        return True

        except Exception as e:
            print(f"重新加载插件 '{name}' 失败: {e}")

        return False

    def _load_plugin_metadata(self, config_file: Path) -> Optional[PluginMetadata]:
        """
        加载插件元数据

        Args:
            config_file: 配置文件路径

        Returns:
            PluginMetadata实例或None
        """
        try:
            if config_file.suffix == ".json":
                with open(config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            elif config_file.suffix in [".toml", ".yaml", ".yml"]:
                # 这里可以扩展支持其他格式
                print(f"暂不支持的配置文件格式: {config_file.suffix}")
                return None
            else:
                return None

            # 验证必需字段
            required_fields = ["name", "version", "description", "author"]
            for field in required_fields:
                if field not in data:
                    print(f"插件配置缺少必需字段: {field}")
                    return None

            # 创建元数据对象
            metadata = PluginMetadata(
                name=data["name"],
                version=data["version"],
                description=data["description"],
                author=data["author"],
                dependencies=data.get("dependencies", []),
                requires=data.get("requires", []),
                provides=data.get("provides", []),
                config_schema=data.get("config_schema"),
                tags=data.get("tags", []),
                homepage=data.get("homepage"),
                license=data.get("license")
            )

            return metadata

        except Exception as e:
            print(f"加载插件配置失败 {config_file}: {e}")
            return None

    def _load_plugin_module(self, plugin_dir: Path, metadata: PluginMetadata) -> Optional[Plugin]:
        """
        加载插件模块

        Args:
            plugin_dir: 插件目录
            metadata: 插件元数据

        Returns:
            Plugin实例或None
        """
        try:
            # 查找主模块文件
            main_file = None
            for candidate in ["__init__.py", "plugin.py", f"{metadata.name}.py"]:
                candidate_path = plugin_dir / candidate
                if candidate_path.exists():
                    main_file = candidate_path
                    break

            if not main_file:
                print(f"未找到插件主文件: {plugin_dir}")
                return None

            # 动态加载模块
            module_name = f"plugins.{metadata.name}"
            spec = importlib.util.spec_from_file_location(module_name, main_file)

            if spec is None or spec.loader is None:
                print(f"无法创建模块规范: {main_file}")
                return None

            module = importlib.util.module_from_spec(spec)

            # 添加到 sys.modules 避免重复加载
            if module_name in sys.modules:
                # 如果已经加载，先移除
                del sys.modules[module_name]

            sys.modules[module_name] = module
            self._loaded_modules[module_name] = module

            # 执行模块
            spec.loader.exec_module(module)

            # 查找插件类
            plugin_class = None
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (isinstance(attr, type) and
                    issubclass(attr, Plugin) and
                    attr != Plugin):
                    plugin_class = attr
                    break

            if not plugin_class:
                print(f"未找到插件类: {plugin_dir}")
                return None

            # 创建插件实例
            plugin_instance = plugin_class(metadata)

            return plugin_instance

        except Exception as e:
            print(f"加载插件模块失败 {plugin_dir}: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _find_plugin_directory(self, plugin_name: str) -> Optional[Path]:
        """
        查找插件目录

        Args:
            plugin_name: 插件名称

        Returns:
            插件目录路径或None
        """
        for base_dir in self.plugin_dirs:
            plugin_dir = base_dir / plugin_name
            if plugin_dir.exists() and plugin_dir.is_dir():
                return plugin_dir
        return None

    def unload_module(self, module_name: str) -> None:
        """
        卸载模块

        Args:
            module_name: 模块名称
        """
        if module_name in sys.modules:
            del sys.modules[module_name]
        if module_name in self._loaded_modules:
            del self._loaded_modules[module_name]
