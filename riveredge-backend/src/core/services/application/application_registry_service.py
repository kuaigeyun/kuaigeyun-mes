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
from core.services.application.application_route_manager import get_route_manager
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
            logger.warning(f"⚠️ 数据库查询失败，尝试从文件系统扫描应用: {e}")

            # 回退方案：从文件系统扫描应用目录，自动发现应用
            # 不再硬编码应用列表，而是动态扫描 apps 目录
            apps = []
            try:
                # 使用 ApplicationService 的扫描方法
                from core.services.application.application_service import ApplicationService
                discovered_plugins = ApplicationService._scan_plugin_manifests()
                
                for manifest in discovered_plugins:
                    app_code = manifest.get('code')
                    if not app_code:
                        continue
                    
                    # 构建应用数据（从 manifest.json 读取）
                    apps.append({
                        "uuid": f"{app_code}-fallback-uuid",
                        "code": app_code,
                        "name": manifest.get('name', app_code),
                        "description": manifest.get('description', ''),
                        "version": manifest.get('version', '1.0.0'),
                        "route_path": manifest.get('route_path', f"/apps/{app_code}"),
                        "entry_point": manifest.get('entry_point', f"apps.{app_code.replace('-', '_')}.api.router"),
                        "menu_config": manifest.get('menu_config'),
                        "is_system": False,
                        "is_active": True,
                        "is_installed": True,
                        "created_at": None,
                        "updated_at": None
                    })
                
                logger.info(f"📋 从文件系统扫描到 {len(apps)} 个应用: {[app['name'] for app in apps]}")
            except Exception as scan_error:
                logger.error(f"❌ 从文件系统扫描应用失败: {scan_error}")
                # 最后的回退：返回空列表，避免系统崩溃
                apps = []
                logger.warning("⚠️ 无法发现任何应用，系统可能无法正常工作")

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
                # 将应用代码中的连字符转换为下划线，以匹配Python模块命名规范
                module_code = app_code.replace('-', '_')
                model_module_path = f"apps.{module_code}.models"

                # 检查模块是否存在
                if cls._module_exists(model_module_path):
                    # 动态导入模型模块
                    model_module = importlib.import_module(model_module_path)

                    # ⚠️ 关键修复：确保模型使用正确的数据库连接
                    # 在 Tortoise ORM 中，每个模型的 _meta.db 属性指定其数据库连接
                    # 问题在于动态导入的模型没有被 Tortoise 初始化，所以需要手动设置
                    try:
                        # 导入 Tortoise 的连接模块
                        from tortoise import connections

                        # 为模块中的所有 Tortoise 模型设置数据库连接
                        for attr_name in dir(model_module):
                            attr = getattr(model_module, attr_name)
                            # 检查是否是 Tortoise 模型类
                            if (hasattr(attr, '_meta') and
                                hasattr(attr._meta, 'db_table') and
                                hasattr(attr, '__bases__') and
                                hasattr(attr, 'Meta')):
                                # 强制设置数据库连接
                                attr._meta.db = 'default'
                                logger.info(f"✅ 设置模型 {attr.__name__} 的数据库连接为 'default'")

                        # 尝试注册模型到 Tortoise（如果可能的话）
                        # 注意：Tortoise.init 后可能无法动态添加模型，但我们可以尝试
                        try:
                            from tortoise import Tortoise
                            # 如果 Tortoise 已经初始化，尝试重新注册模型
                            if hasattr(Tortoise, '_apps') and 'models' in Tortoise._apps:
                                # 强制将模型添加到已注册的应用中
                                if model_module_path not in Tortoise._apps['models']['models']:
                                    Tortoise._apps['models']['models'].append(model_module_path)
                                    logger.info(f"✅ 将模型模块 {model_module_path} 添加到 Tortoise 配置")
                        except Exception as e:
                            logger.debug(f"无法动态注册模型到 Tortoise: {e}")

                    except Exception as setup_error:
                        logger.error(f"设置模型数据库连接失败: {setup_error}")

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
                # 将应用代码中的连字符转换为下划线，以匹配Python模块命名规范
                module_code = app_code.replace('-', '_')
                route_module_path = f"apps.{module_code}.api.router"

                # 检查模块是否存在
                if cls._module_exists(route_module_path):
                    try:
                        # 动态导入路由模块
                        route_module = importlib.import_module(route_module_path)

                        # 获取路由对象（通常命名为router）
                        router = getattr(route_module, 'router', None)
                        if router:
                            # 缓存路由对象
                            cls._registered_routes[app_code] = [router]
                            registered_routes.append(f"{app_name}({app_code})")

                            # 如果路由管理器已初始化，则注册路由
                            route_manager = get_route_manager()
                            if route_manager:
                                # 使用应用的 route_path 作为路由前缀
                                route_prefix = app.get('route_path', '/api/v1')
                                route_manager.register_app_routes(app_code, [router], prefix=route_prefix)
                                logger.info(f"✅ 通过路由管理器注册应用路由: {route_module_path} (prefix: {route_prefix})")
                            else:
                                logger.debug(f"✅ 缓存应用路由（路由管理器未初始化）: {route_module_path}")
                        else:
                            logger.warning(f"⚠️ 应用 {app_name}({app_code}) 的路由模块中未找到router对象")
                    except ImportError as ie:
                        logger.error(f"❌ 导入应用 {app_name}({app_code}) 路由模块失败: {ie}")
                        logger.info(f"💡 这可能是由于缺少运行时依赖导致的，请确保所有依赖都已正确安装")
                    except Exception as e:
                        logger.error(f"❌ 注册应用 {app_name}({app_code}) 路由时发生错误: {e}")
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

        注意：由于运行时依赖可能不完整，这里使用文件系统检查而不是导入检查

        Args:
            module_path: 模块路径，如 'apps.master_data.api.router'

        Returns:
            bool: 模块文件是否存在
        """
        try:
            # 将模块路径转换为文件路径
            # apps.master_data.api.router -> apps/master_data/api/router.py
            file_path = module_path.replace('.', '/') + '.py'

            # 检查文件是否存在于src目录中
            import os
            from pathlib import Path

            # 获取当前文件的目录，然后向上查找src目录
            current_file = Path(__file__)
            src_dir = current_file.parent.parent.parent.parent  # 向上4级到src目录

            full_path = src_dir / file_path
            return full_path.exists()

        except Exception as e:
            logger.debug(f"检查模块 {module_path} 存在性失败: {e}")
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
    async def register_single_app(cls, app_code: str) -> bool:
        """
        注册单个应用的路由和模型
        
        用于应用启用时动态注册。
        
        Args:
            app_code: 应用代码
            
        Returns:
            bool: 是否注册成功
        """
        try:
            # 从数据库查询应用信息（使用 ApplicationService 确保一致性）
            # 注意：这里需要 tenant_id，但我们暂时使用 0 作为系统级查询
            # 实际使用时应该传入正确的 tenant_id
            from infra.infrastructure.database.database import get_db_connection
            conn = await get_db_connection()
            
            try:
                rows = await conn.fetch("""
                    SELECT uuid, code, name, description, version,
                           route_path, entry_point, menu_config,
                           is_system, is_active, is_installed,
                           created_at, updated_at
                    FROM core_applications
                    WHERE code = $1
                      AND is_installed = TRUE
                      AND is_active = TRUE
                      AND deleted_at IS NULL
                    LIMIT 1
                """, app_code)
                
                if not rows:
                    logger.warning(f"应用 {app_code} 不存在或未启用")
                    return False
                
                app_data = dict(rows[0])
            finally:
                await conn.close()
            
            # 解析JSON字段
            if app_data.get('menu_config') and isinstance(app_data['menu_config'], str):
                try:
                    app_data['menu_config'] = json.loads(app_data['menu_config'])
                except json.JSONDecodeError:
                    app_data['menu_config'] = None
            
            # 注册应用模型
            await cls._register_app_models([app_data])
            
            # 注册应用路由
            await cls._register_app_routes([app_data])
            
            logger.info(f"✅ 应用 {app_code} 注册成功")
            return True
            
        except Exception as e:
            logger.error(f"❌ 注册应用 {app_code} 失败: {e}")
            return False
    
    @classmethod
    async def unregister_single_app(cls, app_code: str) -> None:
        """
        注销单个应用的路由
        
        用于应用禁用时移除路由。
        
        注意：FastAPI 不支持动态移除路由，这里只是从缓存中移除
        实际的路由仍然存在，但可以通过权限中间件来阻止访问
        
        Args:
            app_code: 应用代码
        """
        try:
            # 从缓存中移除
            if app_code in cls._registered_routes:
                del cls._registered_routes[app_code]
                logger.info(f"✅ 应用 {app_code} 的路由已从缓存中移除")
            
            # 从路由管理器中移除
            route_manager = get_route_manager()
            if route_manager:
                route_manager.unregister_app_routes(app_code)
                
        except Exception as e:
            logger.error(f"❌ 注销应用 {app_code} 失败: {e}")

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
