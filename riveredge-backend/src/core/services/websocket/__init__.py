"""
WebSocket服务模块

提供WebSocket连接管理和实时数据推送功能。
"""

from .websocket_service import WebSocketService, websocket_manager

__all__ = ["WebSocketService", "websocket_manager"]
