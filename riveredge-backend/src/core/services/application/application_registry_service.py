"""
动态应用注册服务模块

提供动态应用注册和管理的核心功能，包括：
- 应用发现和注册
- 模型动态注册
- 路由动态注册
- 应用状态管理

不再硬编码应用列表，通过数据库配置动态管理。
"""

import os
import importlib
import json
import asyncpg
from typing import Dict, List, Optional, Any, Set
from pathlib import Path
from loguru import logger

from core.services.application.application_service import ApplicationService
from core.models.application import Application


class ApplicationRegistryService:
    """
    动态应用注册服务类

    负责应用的动态发现、注册和管理，不再依赖硬编码配置。
    """

    # 已注册的应用缓存
    _registered_apps: Dict[str, Dict[str, Any]] = {}
    _registered_models: Set[str] = set()
    _registered_routes: Dict[str, List[Any]] = {}

    @classmethod
    async def initialize(cls) -> None:
        """
        初始化应用注册服务

        发现所有已安装的应用，注册其模型和路由。
        """
        logger.info("🔄 开始初始化动态应用注册服务...")

        try:
            # 发现所有已安装的应用
            installed_apps = await cls._discover_installed_apps()
            logger.info(f"📋 发现 {len(installed_apps)} 个已安装的应用")

            # 注册应用模型
            await cls._register_app_models(installed_apps)

            # 注册应用路由
            await cls._register_app_routes(installed_apps)

            logger.info("✅ 动态应用注册服务初始化完成")

        except Exception as e:
            logger.error(f"❌ 应用注册服务初始化失败: {e}")
            raise

    @classmethod
    async def _discover_installed_apps(cls) -> List[Dict[str, Any]]:
        """
        发现所有已安装的应用

        从数据库中查询所有已安装且启用的应用。
        """
        logger.info("🔍 发现已安装应用...")

        # 延迟导入，避免循环依赖
        from tortoise import connections

        try:
            # 使用Tortoise连接查询数据库
            conn = connections.get("default")

            # 查询所有已安装且启用的应用（不限制租户，因为这是系统级配置）
            rows = await conn.execute_query_dict("""
                SELECT uuid, code, name, description, version,
                       route_path, entry_point, menu_config,
                       is_system, is_active, is_installed,
                       created_at, updated_at
                FROM core_applications
                WHERE is_installed = TRUE
                  AND is_active = TRUE
                  AND deleted_at IS NULL
                ORDER BY sort_order, created_at
            """)

            apps = []
            for row in rows:
                app_data = dict(row)
                # 解析JSON字段
                if app_data.get('menu_config') and isinstance(app_data['menu_config'], str):
                    try:
                        app_data['menu_config'] = json.loads(app_data['menu_config'])
                    except json.JSONDecodeError:
                        app_data['menu_config'] = None

                apps.append(app_data)

            logger.info(f"📋 从数据库发现 {len(apps)} 个活跃应用: {[app['name'] for app in apps]}")
            return apps

        except Exception as e:
            logger.warning(f"⚠️ 数据库查询失败，使用默认应用列表: {e}")

            # 回退到硬编码的默认应用
            apps = [
                {
                    "uuid": "master-data-uuid",
                    "code": "master_data",
                    "name": "主数据管理",
                    "description": "基础数据管理应用",
                    "version": "1.0.0",
                    "route_path": "/apps/master-data",
                    "entry_point": "apps.master_data.api.router",
                    "menu_config": None,
                    "is_system": False,
                    "is_active": True,
                    "is_installed": True,
                    "created_at": None,
                    "updated_at": None
                }
            ]

            logger.info(f"📋 使用默认应用列表: {[app['name'] for app in apps]}")
            return apps

    @classmethod
    async def _register_app_models(cls, apps: List[Dict[str, Any]]) -> None:
        """
        注册应用模型到Tortoise ORM

        为每个活跃的应用注册其模型模块。
        """
        logger.info("📝 开始注册应用模型...")

        registered_models = []

        for app in apps:
            app_code = app['code']
            app_name = app['name']

            try:
                # 构建模型模块路径
                model_module_path = f"apps.{app_code}.models"

                # 检查模块是否存在
                if cls._module_exists(model_module_path):
                    # 动态导入模型模块
                    model_module = importlib.import_module(model_module_path)

                    # 注册到已注册模型集合
                    cls._registered_models.add(model_module_path)
                    registered_models.append(f"{app_name}({app_code})")

                    logger.debug(f"✅ 注册应用模型: {model_module_path}")
                else:
                    logger.warning(f"⚠️ 应用 {app_name}({app_code}) 的模型模块不存在: {model_module_path}")

            except Exception as e:
                logger.error(f"❌ 注册应用 {app_name}({app_code}) 模型失败: {e}")

        if registered_models:
            logger.info(f"✅ 成功注册 {len(registered_models)} 个应用模型: {', '.join(registered_models)}")
        else:
            logger.info("ℹ️ 没有应用模型需要注册")

    @classmethod
    async def _register_app_routes(cls, apps: List[Dict[str, Any]]) -> None:
        """
        注册应用路由

        为每个活跃的应用注册其API路由。
        """
        logger.info("🔗 开始注册应用路由...")

        registered_routes = []

        for app in apps:
            app_code = app['code']
            app_name = app['name']

            try:
                # 构建路由模块路径
                route_module_path = f"apps.{app_code}.api.router"

                # 检查模块是否存在
                if cls._module_exists(route_module_path):
                    # 动态导入路由模块
                    route_module = importlib.import_module(route_module_path)

                    # 获取路由对象（通常命名为router）
                    router = getattr(route_module, 'router', None)
                    if router:
                        # 缓存路由对象
                        cls._registered_routes[app_code] = [router]
                        registered_routes.append(f"{app_name}({app_code})")

                        logger.debug(f"✅ 注册应用路由: {route_module_path}")
                    else:
                        logger.warning(f"⚠️ 应用 {app_name}({app_code}) 的路由模块中未找到router对象")
                else:
                    logger.warning(f"⚠️ 应用 {app_name}({app_code}) 的路由模块不存在: {route_module_path}")

            except Exception as e:
                logger.error(f"❌ 注册应用 {app_name}({app_code}) 路由失败: {e}")

        if registered_routes:
            logger.info(f"✅ 成功注册 {len(registered_routes)} 个应用路由: {', '.join(registered_routes)}")
        else:
            logger.info("ℹ️ 没有应用路由需要注册")

    @classmethod
    def _module_exists(cls, module_path: str) -> bool:
        """
        检查Python模块是否存在

        Args:
            module_path: 模块路径，如 'apps.master_data.models'

        Returns:
            bool: 模块是否存在
        """
        try:
            importlib.import_module(module_path)
            return True
        except ImportError:
            return False
        except Exception:
            # 其他导入错误也视为模块不存在
            return False

    @classmethod
    def get_registered_models(cls) -> List[str]:
        """
        获取已注册的模型模块列表

        Returns:
            List[str]: 模型模块路径列表
        """
        return list(cls._registered_models)

    @classmethod
    def get_registered_routes(cls) -> Dict[str, List[Any]]:
        """
        获取已注册的路由对象

        Returns:
            Dict[str, List[Any]]: 应用代码 -> 路由对象列表 的映射
        """
        return cls._registered_routes.copy()

    @classmethod
    def get_registered_app_codes(cls) -> List[str]:
        """
        获取已注册的应用代码列表

        Returns:
            List[str]: 应用代码列表
        """
        return list(cls._registered_apps.keys())

    @classmethod
    async def reload_apps(cls) -> None:
        """
        重新加载应用配置

        用于应用安装/卸载/启用/停用后重新初始化。
        """
        logger.info("🔄 重新加载应用配置...")

        # 清空缓存
        cls._registered_apps.clear()
        cls._registered_models.clear()
        cls._registered_routes.clear()

        # 重新初始化
        await cls.initialize()

    @classmethod
    async def is_app_registered(cls, app_code: str) -> bool:
        """
        检查应用是否已注册

        Args:
            app_code: 应用代码

        Returns:
            bool: 是否已注册
        """
        return app_code in cls._registered_apps

    @classmethod
    async def get_app_info(cls, app_code: str) -> Optional[Dict[str, Any]]:
        """
        获取应用信息

        Args:
            app_code: 应用代码

        Returns:
            Optional[Dict[str, Any]]: 应用信息
        """
        return cls._registered_apps.get(app_code)
