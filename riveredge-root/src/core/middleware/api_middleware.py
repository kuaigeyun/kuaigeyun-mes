"""
API 治理中间件模块

提供 API 版本控制、请求限流、API 监控等功能
"""

import time
import hashlib
from typing import Dict, Optional, Tuple
from collections import defaultdict

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger

from core.cache.cache_manager import cache_manager
from core.exceptions.exceptions import RateLimitError


class APIVersionMiddleware(BaseHTTPMiddleware):
    """
    API 版本控制中间件

    处理 API 版本头，设置默认版本等
    """

    def __init__(self, app, default_version: str = "v1"):
        super().__init__(app)
        self.default_version = default_version

    async def dispatch(self, request: Request, call_next):
        # 检查 Accept 头中的版本信息
        accept_header = request.headers.get("Accept", "")
        if "application/vnd.riveredge." in accept_header:
            # 解析版本信息，如: application/vnd.riveredge.v2+json
            try:
                version_part = accept_header.split("vnd.riveredge.")[1].split("+")[0]
                request.state.api_version = version_part
            except (IndexError, AttributeError):
                request.state.api_version = self.default_version
        else:
            request.state.api_version = self.default_version

        # 设置响应头
        response = await call_next(request)
        response.headers["X-API-Version"] = request.state.api_version
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    请求限流中间件

    基于 IP 地址和用户 ID 进行请求限流
    """

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst_limit: int = 10
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_limit = burst_limit
        self._requests: Dict[str, list] = defaultdict(list)

    def _get_client_key(self, request: Request) -> str:
        """
        获取客户端标识

        Args:
            request: 请求对象

        Returns:
            str: 客户端键
        """
        # 优先使用用户 ID，其次使用 IP 地址
        user_id = getattr(request.state, 'user_id', None)
        if user_id:
            return f"user:{user_id}"

        # 获取客户端 IP
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"

    def _is_rate_limited(self, client_key: str) -> Tuple[bool, int]:
        """
        检查是否达到限流阈值

        Args:
            client_key: 客户端键

        Returns:
            Tuple[bool, int]: (是否限流, 剩余请求数)
        """
        now = time.time()
        window_start = now - 60  # 1分钟窗口

        # 清理过期请求
        self._requests[client_key] = [
            req_time for req_time in self._requests[client_key]
            if req_time > window_start
        ]

        request_count = len(self._requests[client_key])

        if request_count >= self.requests_per_minute:
            return True, 0

        # 检查突发限制
        recent_requests = [
            req_time for req_time in self._requests[client_key]
            if req_time > now - 10  # 最近10秒
        ]

        if len(recent_requests) >= self.burst_limit:
            return True, 0

        return False, self.requests_per_minute - request_count

    async def dispatch(self, request: Request, call_next):
        client_key = self._get_client_key(request)

        # 检查限流
        is_limited, remaining = self._is_rate_limited(client_key)

        if is_limited:
            raise RateLimitError("请求过于频繁，请稍后再试")

        # 记录请求
        self._requests[client_key].append(time.time())

        # 设置响应头
        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)

        return response


class APIMonitoringMiddleware(BaseHTTPMiddleware):
    """
    API 监控中间件

    记录 API 调用统计、响应时间等监控数据
    """

    def __init__(self, app):
        super().__init__(app)
        self._stats: Dict[str, Dict] = defaultdict(lambda: {
            "calls": 0,
            "errors": 0,
            "total_time": 0.0,
            "avg_time": 0.0,
            "status_codes": defaultdict(int)
        })

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        endpoint = f"{request.method} {request.url.path}"

        try:
            response = await call_next(request)

            # 计算响应时间
            response_time = time.time() - start_time

            # 更新统计信息
            stats = self._stats[endpoint]
            stats["calls"] += 1
            stats["total_time"] += response_time
            stats["avg_time"] = stats["total_time"] / stats["calls"]
            stats["status_codes"][response.status_code] += 1

            # 设置响应头
            response.headers["X-Response-Time"] = f"{response_time:.3f}s"

            # 记录慢请求
            if response_time > 1.0:  # 超过1秒
                logger.warning(
                    f"慢请求检测: {endpoint} - {response_time:.3f}s - "
                    f"客户端: {request.client.host if request.client else 'unknown'}"
                )

            return response

        except Exception as e:
            # 记录错误统计
            stats = self._stats[endpoint]
            stats["calls"] += 1
            stats["errors"] += 1
            stats["status_codes"][500] += 1

            raise

    def get_stats(self) -> Dict[str, Dict]:
        """
        获取 API 统计信息

        Returns:
            Dict[str, Dict]: API 统计数据
        """
        return dict(self._stats)

    def reset_stats(self):
        """重置统计信息"""
        self._stats.clear()


class APIVersionRouter:
    """
    API 版本路由器

    提供 API 版本控制功能
    """

    def __init__(self, default_version: str = "v1"):
        self.default_version = default_version
        self._versioned_routes: Dict[str, Dict] = defaultdict(dict)

    def add_route(
        self,
        path: str,
        methods: list,
        endpoint,
        version: str = None,
        **kwargs
    ):
        """
        添加版本化路由

        Args:
            path: 路由路径
            methods: HTTP 方法列表
            endpoint: 端点函数
            version: API 版本
            **kwargs: 其他路由参数
        """
        version = version or self.default_version

        for method in methods:
            key = f"{method} {path}"
            self._versioned_routes[version][key] = {
                "endpoint": endpoint,
                "methods": methods,
                **kwargs
            }

    def get_routes_for_version(self, version: str) -> Dict[str, Dict]:
        """
        获取指定版本的路由

        Args:
            version: API 版本

        Returns:
            Dict[str, Dict]: 版本路由配置
        """
        return dict(self._versioned_routes.get(version, {}))


# 创建全局中间件实例
api_version_middleware = APIVersionMiddleware
rate_limit_middleware = RateLimitMiddleware
api_monitoring_middleware = APIMonitoringMiddleware
api_version_router = APIVersionRouter()


# 便捷函数

def get_api_stats() -> Dict[str, Dict]:
    """
    获取 API 统计信息

    Returns:
        Dict[str, Dict]: API 统计数据
    """
    return api_monitoring_middleware.get_stats()


def reset_api_stats():
    """重置 API 统计信息"""
    api_monitoring_middleware.reset_stats()


# API 版本装饰器

def api_version(version: str) -> callable:
    """
    API 版本装饰器

    Args:
        version: API 版本

    Returns:
        callable: 装饰器函数
    """
    def decorator(func):
        func._api_version = version
        return func
    return decorator
