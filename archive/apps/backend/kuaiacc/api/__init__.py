"""
财务 API 模块

提供财务相关的 RESTful API 接口，支持多组织隔离。
按照中国财务规范设计。
"""

from apps.kuaiacc.api.router import router

__all__ = ["router"]

