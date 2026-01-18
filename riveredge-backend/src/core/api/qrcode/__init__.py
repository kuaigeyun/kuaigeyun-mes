"""
二维码 API 模块

提供二维码生成和解析的 RESTful API 接口。
"""

from .qrcode import router

__all__ = ["router"]
