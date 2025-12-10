"""
插件加载器工具模块

提供插件动态加载和注册功能。
"""

import importlib
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter


class PluginLoader:
    """
    插件加载器类
    
    负责动态加载和注册插件。
    """
    
    @staticmethod
    def load_plugin_routes(plugin_path: str) -> Optional[APIRouter]:
        """
        加载插件路由
        
        Args:
            plugin_path: 插件路径（相对于 riveredge-apps 目录）
            
        Returns:
            APIRouter: 插件路由对象，如果加载失败返回 None
        """
        try:
            # 构建插件模块路径
            plugin_module_path = f"seed_{plugin_path.replace('/', '_').replace('-', '_')}"
            
            # 构建插件 API 路径
            plugin_api_path = Path(__file__).parent.parent.parent.parent / "riveredge-apps" / plugin_path / "backend" / "src" / "api"
            
            if not plugin_api_path.exists():
                return None
            
            # 添加插件路径到 Python 路径
            plugin_backend_path = plugin_api_path.parent
            if str(plugin_backend_path) not in sys.path:
                sys.path.insert(0, str(plugin_backend_path))
            
            # 尝试导入插件路由
            # 这里需要根据实际插件结构来导入
            # 例如：from seed_kuaimes.api.orders.orders import router as kuaimes_orders_router
            
            return None
        except Exception as e:
            print(f"加载插件 {plugin_path} 失败: {e}")
            return None
    
    @staticmethod
    def register_plugin_routes(app, plugin_code: str, plugin_path: str) -> bool:
        """
        注册插件路由到 FastAPI 应用
        
        Args:
            app: FastAPI 应用实例
            plugin_code: 插件代码
            plugin_path: 插件路径
            
        Returns:
            bool: 是否注册成功
        """
        try:
            # 构建插件模块路径
            plugin_module_name = f"seed_{plugin_code}"
            
            # 构建插件后端路径
            plugin_backend_path = Path(__file__).parent.parent.parent.parent / "riveredge-apps" / plugin_path / "backend" / "src"
            
            if not plugin_backend_path.exists():
                return False
            
            # 添加插件路径到 Python 路径
            if str(plugin_backend_path) not in sys.path:
                sys.path.insert(0, str(plugin_backend_path))
            
            # 动态导入插件 API 路由
            # 这里需要根据实际插件结构来导入
            # 例如：from seed_kuaimes.api.orders.orders import router as kuaimes_orders_router
            
            # 注册路由
            # app.include_router(kuaimes_orders_router, prefix="/api/v1")
            
            return True
        except Exception as e:
            print(f"注册插件 {plugin_code} 路由失败: {e}")
            return False

