"""
API性能监控中间件模块

监控API响应时间，识别慢API，优化性能。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from typing import Callable, Dict, List, Any
from collections import defaultdict
from loguru import logger


class PerformanceMiddleware(BaseHTTPMiddleware):
    """
    API性能监控中间件
    
    监控API响应时间，识别慢API，记录性能指标。
    """
    
    # 慢API阈值（毫秒）
    SLOW_API_THRESHOLD = 1000  # 1秒
    
    # 排除的路径（不需要监控的路径）
    EXCLUDED_PATHS = [
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/inngest",
    ]
    
    # 性能统计（内存中，重启后丢失）
    _stats: Dict[str, Dict[str, any]] = defaultdict(lambda: {
        "count": 0,
        "total_time": 0.0,
        "min_time": float('inf'),
        "max_time": 0.0,
        "slow_count": 0,
    })
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并监控性能
        
        Args:
            request: 请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: 响应对象
        """
        # 检查是否需要监控
        if not self._should_monitor(request):
            return await call_next(request)
        
        # 记录开始时间
        start_time = time.time()
        
        # 执行请求
        try:
            response = await call_next(request)
        except Exception as e:
            # 即使出错也记录性能
            elapsed_time = (time.time() - start_time) * 1000
            self._record_performance(request, elapsed_time, success=False)
            raise
        
        # 记录结束时间
        elapsed_time = (time.time() - start_time) * 1000
        
        # 记录性能指标
        self._record_performance(request, elapsed_time, success=True)
        
        # 添加响应头（性能指标）
        response.headers["X-Response-Time"] = f"{elapsed_time:.2f}ms"
        
        # 如果响应时间超过阈值，记录警告
        if elapsed_time > self.SLOW_API_THRESHOLD:
            logger.warning(
                f"⚠️ 慢API检测: {request.method} {request.url.path} - "
                f"响应时间: {elapsed_time:.2f}ms"
            )
        
        return response
    
    def _should_monitor(self, request: Request) -> bool:
        """
        判断是否需要监控
        
        Args:
            request: 请求对象
            
        Returns:
            bool: 是否需要监控
        """
        # 排除的路径
        if request.url.path in self.EXCLUDED_PATHS:
            return False
        
        if request.url.path.startswith("/api/inngest"):
            return False
            
        # 只监控API路径
        if not request.url.path.startswith("/api/"):
            return False
        
        return True
    
    def _record_performance(
        self,
        request: Request,
        elapsed_time: float,
        success: bool = True
    ) -> None:
        """
        记录性能指标
        
        Args:
            request: 请求对象
            elapsed_time: 响应时间（毫秒）
            success: 是否成功
        """
        # 生成统计键（方法 + 路径）
        stats_key = f"{request.method}:{request.url.path}"
        
        # 更新统计信息
        stats = self._stats[stats_key]
        stats["count"] += 1
        stats["total_time"] += elapsed_time
        stats["min_time"] = min(stats["min_time"], elapsed_time)
        stats["max_time"] = max(stats["max_time"], elapsed_time)
        
        if elapsed_time > self.SLOW_API_THRESHOLD:
            stats["slow_count"] += 1
        
        # 计算平均响应时间
        stats["avg_time"] = stats["total_time"] / stats["count"]
    
    @classmethod
    def get_stats(cls) -> Dict[str, Dict[str, any]]:
        """
        获取性能统计信息
        
        Returns:
            Dict[str, Dict[str, any]]: 性能统计信息
        """
        return dict(cls._stats)
    
    @classmethod
    def get_slow_apis(cls, limit: int = 10) -> List[Dict[str, any]]:
        """
        获取慢API列表
        
        Args:
            limit: 返回数量限制
        
        Returns:
            List[Dict[str, any]]: 慢API列表
        """
        slow_apis = []
        for path, stats in cls._stats.items():
            if stats["slow_count"] > 0 or stats["avg_time"] > cls.SLOW_API_THRESHOLD:
                slow_apis.append({
                    "path": path,
                    "count": stats["count"],
                    "avg_time": stats["avg_time"],
                    "min_time": stats["min_time"],
                    "max_time": stats["max_time"],
                    "slow_count": stats["slow_count"],
                    "slow_rate": stats["slow_count"] / stats["count"] if stats["count"] > 0 else 0,
                })
        
        # 按平均响应时间排序
        slow_apis.sort(key=lambda x: x["avg_time"], reverse=True)
        
        return slow_apis[:limit]
    
    @classmethod
    def reset_stats(cls) -> None:
        """
        重置性能统计
        """
        cls._stats.clear()