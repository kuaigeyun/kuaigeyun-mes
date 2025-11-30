"""
监控 API 模块

提供平台级监控和统计相关的 API 接口
"""

from .statistics import router as statistics_router

__all__ = ['statistics_router']
