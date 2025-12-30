"""
应用路由管理器

提供动态注册和移除应用路由的功能，支持应用启用/禁用时的路由更新。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Dict, List, Optional, Any
from fastapi import APIRouter, FastAPI
from loguru import logger


class ApplicationRouteManager:
    """
    应用路由管理器
    
    管理应用路由的动态注册和移除，支持运行时路由更新。
    """
    
    def __init__(self, app: FastAPI):
        """
        初始化路由管理器
        
        Args:
            app: FastAPI 应用实例
        """
        self.app = app
        # 记录已注册的路由，用于后续移除
        self._registered_routes: Dict[str, List[APIRouter]] = {}
        # 记录路由的注册信息（用于重新注册）
        self._route_registry: Dict[str, Dict[str, Any]] = {}
    
    def register_app_routes(
        self,
        app_code: str,
        routers: List[APIRouter],
        prefix: str = "/api/v1"
    ) -> None:
        """
        注册应用路由

        Args:
            app_code: 应用代码
            routers: 路由列表
            prefix: 路由前缀
        """
        logger.info(f"🔧 开始注册应用 {app_code} 的路由，prefix={prefix}, routers数量={len(routers) if routers else 0}")
        if not routers:
            logger.warning(f"应用 {app_code} 没有路由需要注册")
            return

        # 如果应用已注册过路由，先移除旧路由
        if app_code in self._registered_routes:
            logger.info(f"应用 {app_code} 已存在路由，先移除旧路由")
            self.unregister_app_routes(app_code)

        # 注册新路由
        registered = []
        for router in routers:
            try:
                logger.debug(f"📝 正在注册路由器，prefix={router.prefix}, tags={router.tags}")
                self.app.include_router(router, prefix=prefix)
                registered.append(router)
                logger.debug(f"✅ 注册应用 {app_code} 的路由: {router.prefix}")
                # 检查路由是否真的被添加了
                route_count = len([route for route in self.app.routes if hasattr(route, 'path') and route.path.startswith(prefix)])
                logger.debug(f"📊 当前应用路由数量（以 {prefix} 开头）: {route_count}")
                # 打印所有以 prefix 开头的路由
                matching_routes = [route.path for route in self.app.routes if hasattr(route, 'path') and route.path.startswith(prefix)]
                if matching_routes:
                    logger.debug(f"📋 匹配的路由路径: {matching_routes[:5]}")  # 只打印前5个
            except Exception as e:
                logger.error(f"❌ 注册应用 {app_code} 的路由失败: {e}")
                continue
        
        if registered:
            self._registered_routes[app_code] = registered
            self._route_registry[app_code] = {
                'routers': routers,
                'prefix': prefix
            }
            logger.info(f"✅ 应用 {app_code} 路由注册完成，共注册 {len(registered)} 个路由")
        else:
            logger.warning(f"⚠️ 应用 {app_code} 没有成功注册任何路由")
    
    def unregister_app_routes(self, app_code: str) -> None:
        """
        移除应用路由
        
        注意：FastAPI 不支持动态移除路由，这里只是从记录中移除
        实际的路由仍然存在，但可以通过重新注册来覆盖
        
        Args:
            app_code: 应用代码
        """
        if app_code not in self._registered_routes:
            logger.debug(f"应用 {app_code} 没有已注册的路由")
            return
        
        # 从记录中移除
        del self._registered_routes[app_code]
        if app_code in self._route_registry:
            del self._route_registry[app_code]
        
        logger.info(f"✅ 应用 {app_code} 的路由记录已移除")
    
    def reload_app_routes(
        self,
        app_code: str,
        routers: List[APIRouter],
        prefix: str = "/api/v1"
    ) -> None:
        """
        重新加载应用路由
        
        先移除旧路由，再注册新路由
        
        Args:
            app_code: 应用代码
            routers: 路由列表
            prefix: 路由前缀
        """
        logger.info(f"🔄 重新加载应用 {app_code} 的路由")
        self.unregister_app_routes(app_code)
        self.register_app_routes(app_code, routers, prefix)
    
    def get_registered_routes(self) -> Dict[str, List[APIRouter]]:
        """
        获取已注册的路由
        
        Returns:
            Dict[str, List[APIRouter]]: 应用代码 -> 路由列表 的映射
        """
        return self._registered_routes.copy()
    
    def is_app_registered(self, app_code: str) -> bool:
        """
        检查应用是否已注册路由
        
        Args:
            app_code: 应用代码
            
        Returns:
            bool: 是否已注册
        """
        return app_code in self._registered_routes


# 全局路由管理器实例（在应用启动时初始化）
_route_manager: Optional[ApplicationRouteManager] = None


def get_route_manager() -> Optional[ApplicationRouteManager]:
    """
    获取路由管理器实例
    
    Returns:
        Optional[ApplicationRouteManager]: 路由管理器实例，如果未初始化则返回 None
    """
    return _route_manager


def init_route_manager(app: FastAPI) -> ApplicationRouteManager:
    """
    初始化路由管理器
    
    Args:
        app: FastAPI 应用实例
        
    Returns:
        ApplicationRouteManager: 路由管理器实例
    """
    global _route_manager
    _route_manager = ApplicationRouteManager(app)
    logger.info("✅ 应用路由管理器已初始化")
    return _route_manager

