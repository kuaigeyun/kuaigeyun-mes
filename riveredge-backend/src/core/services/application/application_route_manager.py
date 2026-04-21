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
        # 启动期日志精简：INFO 仅输出一次"注册完成"汇总；逐路由/包含 FastAPI 对象 id 等细节改走 DEBUG。
        # 之前每个 router 都会遍历整个 app.routes 计数，N 个 app × N 个 router → O(N²) 扫描，去掉以加速冷启动。
        logger.debug(
            f"开始注册应用 {app_code} 路由 prefix={prefix} routers={len(routers) if routers else 0}"
        )
        if not routers:
            logger.warning(f"应用 {app_code} 没有路由需要注册")
            return

        if app_code in self._registered_routes:
            logger.debug(f"应用 {app_code} 已存在路由，先移除旧路由")
            self.unregister_app_routes(app_code)

        # 构建应用路由前缀：/api/v1/apps/{app_code}
        app_prefix = f"{prefix}/apps/{app_code}"

        registered: List[APIRouter] = []
        for router in routers:
            try:
                router_prefix = router.prefix if router.prefix else ""
                # 如果 router 的 prefix 已包含 /apps/{app_code}，则不再重复添加
                if f"/apps/{app_code}" in router_prefix:
                    final_prefix = router_prefix
                else:
                    final_prefix = app_prefix

                self.app.include_router(router, prefix=final_prefix)
                registered.append(router)
                logger.debug(f"已挂载 {app_code} 路由: {final_prefix} tags={router.tags}")
            except Exception as e:
                logger.error(f"❌ 注册应用 {app_code} 的路由失败: {e}")
                import traceback
                logger.error(f"路由注册错误详情:\n{traceback.format_exc()}")
                continue

        if registered:
            self._registered_routes[app_code] = registered
            self._route_registry[app_code] = {
                'routers': routers,
                'prefix': app_prefix,
            }
            logger.info(
                f"✅ 应用 {app_code} 路由注册完成（{len(registered)}/{len(routers)}，prefix={app_prefix}）"
            )
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

