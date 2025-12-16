"""
操作日志中间件模块

自动记录所有 API 操作日志。
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import status
import asyncio
from typing import Callable, Optional

from loguru import logger

from core.services.operation_log_service import OperationLogService


class OperationLogMiddleware(BaseHTTPMiddleware):
    """
    操作日志中间件
    
    自动记录所有 API 操作日志。
    注意：异步执行，不影响业务性能。
    """
    
    # 排除的路径（不需要记录日志的路径）
    EXCLUDED_PATHS = [
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
    ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并记录操作日志
        
        Args:
            request: 请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: 响应对象
        """
        # 检查是否需要记录日志
        if not self._should_log(request):
            return await call_next(request)
        
        # 执行请求
        response = await call_next(request)
        
        # 异步记录操作日志（不阻塞响应）
        asyncio.create_task(self._log_operation(request, response))
        
        return response
    
    def _should_log(self, request: Request) -> bool:
        """
        判断是否需要记录日志
        
        Args:
            request: 请求对象
            
        Returns:
            bool: 是否需要记录日志
        """
        # 排除的路径
        if request.url.path in self.EXCLUDED_PATHS:
            return False
        
        # 只记录 API 路径
        if not request.url.path.startswith("/api/"):
            return False
        
        # 只记录非 GET 请求（或者根据需求调整）
        # 这里记录所有请求，包括 GET
        return True
    
    async def _log_operation(
        self,
        request: Request,
        response: Response
    ) -> None:
        """
        记录操作日志
        
        Args:
            request: 请求对象
            response: 响应对象
        """
        try:
            # 从 Token 中解析 tenant_id 和 user_id
            tenant_id = None
            user_id = None
            
            try:
                from infra.domain.security.security import get_token_payload
                from infra.models.user import User
                
                # 获取 Token
                authorization = request.headers.get("Authorization")
                if authorization and authorization.startswith("Bearer "):
                    token = authorization.replace("Bearer ", "")
                    payload = get_token_payload(token)
                    if payload:
                        # 从 Token 中获取 tenant_id
                        tenant_id = payload.get("tenant_id")
                        if tenant_id:
                            tenant_id = int(tenant_id)
                        
                        # 从 Token 中获取 user_id（sub 字段是 user UUID）
                        user_id_str = payload.get("sub")
                        if user_id_str:
                            # 查询用户获取 user_id
                            user = await User.filter(uuid=user_id_str).first()
                            if user:
                                user_id = user.id
            except Exception:
                # 如果无法获取，跳过记录
                pass
            
            # 如果无法获取组织ID或用户ID，跳过记录
            if not tenant_id or not user_id:
                return
            
            # 解析操作类型和模块
            operation_type = self._parse_operation_type(request.method, response.status_code)
            operation_module = self._parse_operation_module(request.url.path)
            operation_object_type = self._parse_operation_object_type(request.url.path)
            
            # 从请求路径中提取操作对象的 UUID（如果存在）
            operation_object_uuid = self._parse_operation_object_uuid(request.url.path)
            
            # 获取操作内容（包含操作结果）
            operation_result = "成功" if response.status_code < 400 else "失败"
            operation_content = f"{request.method} {request.url.path} - {operation_result} (状态码: {response.status_code})"
            
            # 获取 IP 地址
            ip_address = self._get_client_ip(request)
            
            # 获取用户代理
            user_agent = request.headers.get("User-Agent", "")
            
            # 创建操作日志（异步执行，不阻塞）
            await OperationLogService.create_operation_log(
                tenant_id=tenant_id,
                user_id=user_id,
                operation_type=operation_type,
                operation_module=operation_module,
                operation_object_type=operation_object_type,
                operation_object_uuid=operation_object_uuid,
                operation_content=operation_content,
                ip_address=ip_address,
                user_agent=user_agent,
                request_method=request.method,
                request_path=request.url.path,
            )
            
            # 更新用户活动时间（异步执行，不阻塞）
            try:
                from core.services.online_user_service import OnlineUserService
                asyncio.create_task(
                    OnlineUserService.update_user_activity(
                        tenant_id=tenant_id,
                        user_id=user_id,
                        login_ip=ip_address,
                    )
                )
            except Exception:
                # 更新活动时间失败不影响业务，静默处理
                pass
        except Exception as e:
            # 日志记录失败不影响业务，静默处理
            logger.warning(f"记录操作日志失败: {e}")
    
    def _parse_operation_type(self, method: str, status_code: int) -> str:
        """
        解析操作类型
        
        Args:
            method: HTTP 方法
            status_code: HTTP 状态码
            
        Returns:
            str: 操作类型
        """
        # 如果请求失败，返回 error
        if status_code >= 400:
            return "error"
        
        # 根据 HTTP 方法解析操作类型
        method_map = {
            "GET": "view",
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }
        return method_map.get(method, "unknown")
    
    def _parse_operation_module(self, path: str) -> Optional[str]:
        """
        解析操作模块
        
        Args:
            path: 请求路径
            
        Returns:
            Optional[str]: 操作模块
        """
        # 从路径中提取模块名称
        # 例如：/api/v1/core/users -> users
        # 例如：/api/v1/personal/profile -> profile
        parts = path.split("/")
        if len(parts) >= 4:
            # /api/v1/{module}/...
            module = parts[3]
            if len(parts) >= 5:
                # /api/v1/{module}/{submodule}/...
                submodule = parts[4]
                return f"{module}/{submodule}"
            return module
        return None
    
    def _parse_operation_object_type(self, path: str) -> Optional[str]:
        """
        解析操作对象类型
        
        Args:
            path: 请求路径
            
        Returns:
            Optional[str]: 操作对象类型
        """
        # 从路径中提取对象类型
        # 例如：/api/v1/core/users -> User
        # 例如：/api/v1/personal/profile -> UserProfile
        parts = path.split("/")
        if len(parts) >= 5:
            # /api/v1/{module}/{object}/
            object_name = parts[4]
            # 转换为类名（首字母大写，单数形式）
            # 这里简单处理，实际可能需要更复杂的映射
            return object_name.capitalize()
        return None
    
    def _parse_operation_object_uuid(self, path: str) -> Optional[str]:
        """
        从请求路径中提取操作对象的 UUID
        
        Args:
            path: 请求路径
            
        Returns:
            Optional[str]: 操作对象 UUID
        """
        # 从路径中提取 UUID（如果存在）
        # 例如：/api/v1/core/users/{uuid} -> uuid
        # 例如：/api/v1/core/users/{uuid}/roles -> uuid
        import re
        # UUID 格式：8-4-4-4-12 十六进制字符
        uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        match = re.search(uuid_pattern, path, re.IGNORECASE)
        if match:
            return match.group(0)
        return None
    
    def _get_client_ip(self, request: Request) -> Optional[str]:
        """
        获取客户端 IP 地址
        
        Args:
            request: 请求对象
            
        Returns:
            Optional[str]: 客户端 IP 地址
        """
        # 优先从 X-Forwarded-For 获取（代理服务器）
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # X-Forwarded-For 可能包含多个 IP，取第一个
            return forwarded_for.split(",")[0].strip()
        
        # 从 X-Real-IP 获取
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # 从客户端地址获取
        if request.client:
            return request.client.host
        
        return None



