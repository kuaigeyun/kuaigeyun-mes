"""
主数据管理 APP - API 层

提供物料、客户、供应商、产品的 RESTful API 接口。
"""

from .router import router

__all__ = ["router"]

