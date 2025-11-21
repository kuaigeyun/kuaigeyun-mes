"""
中间件配置模块

配置 FastAPI 中间件，如异常处理、日志记录、组织上下文等
"""

from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from core.tenant_context import set_current_tenant_id, clear_tenant_context


class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    组织上下文中间件
    
    从请求头或 JWT Token 中提取组织 ID，并设置到上下文变量中。
    支持以下方式获取组织 ID：
    1. 请求头：X-Tenant-ID
    2. JWT Token：从 Authorization 头中解析（后续实现）
    
    Attributes:
        app: FastAPI 应用实例
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求，提取组织 ID 并设置到上下文
        
        Args:
            request: FastAPI 请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: HTTP 响应对象
        """
        # 从请求头获取组织 ID（X-Tenant-ID）
        tenant_id_header = request.headers.get("X-Tenant-ID")
        
        if tenant_id_header:
            try:
                tenant_id = int(tenant_id_header)
                # 设置组织上下文
                set_current_tenant_id(tenant_id)
            except ValueError:
                # 如果组织 ID 格式错误，忽略（后续可以由认证中间件处理）
                pass
        
        # 注意：JWT Token 中的组织 ID 提取将在认证中间件中实现
        # 这里只处理请求头方式
        
        try:
            # 调用下一个中间件或路由处理函数
            response = await call_next(request)
            return response
        finally:
            # 请求结束后清除组织上下文（确保上下文不会泄漏到其他请求）
            clear_tenant_context()
