"""
WebSocket服务模块

提供WebSocket连接管理和实时数据推送功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Dict, Any, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger
import json
import asyncio
from datetime import datetime


class WebSocketManager:
    """
    WebSocket连接管理器
    
    管理所有WebSocket连接，支持按租户、用户、频道分组管理。
    """
    
    def __init__(self):
        # 存储所有活跃连接：{connection_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        # 存储连接信息：{connection_id: {tenant_id, user_id, channels}}
        self.connection_info: Dict[str, Dict[str, Any]] = {}
        # 按租户分组：{tenant_id: Set[connection_id]}
        self.tenant_connections: Dict[int, Set[str]] = {}
        # 按用户分组：{user_id: Set[connection_id]}
        self.user_connections: Dict[int, Set[str]] = {}
        # 按频道分组：{channel: Set[connection_id]}
        self.channel_connections: Dict[str, Set[str]] = {}
    
    def generate_connection_id(self, tenant_id: int, user_id: int) -> str:
        """
        生成连接ID
        
        Args:
            tenant_id: 租户ID
            user_id: 用户ID
            
        Returns:
            str: 连接ID
        """
        return f"{tenant_id}_{user_id}_{datetime.now().timestamp()}"
    
    async def connect(self, websocket: WebSocket, tenant_id: int, user_id: int, channels: Optional[list] = None) -> str:
        """
        建立WebSocket连接
        
        Args:
            websocket: WebSocket连接对象
            tenant_id: 租户ID
            user_id: 用户ID
            channels: 订阅的频道列表（可选）
            
        Returns:
            str: 连接ID
        """
        await websocket.accept()
        
        connection_id = self.generate_connection_id(tenant_id, user_id)
        
        # 存储连接
        self.active_connections[connection_id] = websocket
        self.connection_info[connection_id] = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "channels": set(channels or []),
            "connected_at": datetime.now(),
        }
        
        # 添加到租户分组
        if tenant_id not in self.tenant_connections:
            self.tenant_connections[tenant_id] = set()
        self.tenant_connections[tenant_id].add(connection_id)
        
        # 添加到用户分组
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(connection_id)
        
        # 添加到频道分组
        if channels:
            for channel in channels:
                if channel not in self.channel_connections:
                    self.channel_connections[channel] = set()
                self.channel_connections[channel].add(connection_id)
        
        logger.info(f"WebSocket连接建立: {connection_id} (租户: {tenant_id}, 用户: {user_id})")
        
        # 发送连接成功消息
        await self.send_personal_message(connection_id, {
            "type": "connected",
            "connection_id": connection_id,
            "message": "WebSocket连接成功",
        })
        
        return connection_id
    
    def disconnect(self, connection_id: str):
        """
        断开WebSocket连接
        
        Args:
            connection_id: 连接ID
        """
        if connection_id not in self.active_connections:
            return
        
        # 获取连接信息
        info = self.connection_info.get(connection_id, {})
        tenant_id = info.get("tenant_id")
        user_id = info.get("user_id")
        channels = info.get("channels", set())
        
        # 从租户分组移除
        if tenant_id and tenant_id in self.tenant_connections:
            self.tenant_connections[tenant_id].discard(connection_id)
            if not self.tenant_connections[tenant_id]:
                del self.tenant_connections[tenant_id]
        
        # 从用户分组移除
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(connection_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        # 从频道分组移除
        for channel in channels:
            if channel in self.channel_connections:
                self.channel_connections[channel].discard(connection_id)
                if not self.channel_connections[channel]:
                    del self.channel_connections[channel]
        
        # 移除连接
        del self.active_connections[connection_id]
        del self.connection_info[connection_id]
        
        logger.info(f"WebSocket连接断开: {connection_id}")
    
    async def send_personal_message(self, connection_id: str, message: Dict[str, Any]):
        """
        发送个人消息
        
        Args:
            connection_id: 连接ID
            message: 消息内容
        """
        if connection_id not in self.active_connections:
            logger.warning(f"连接不存在: {connection_id}")
            return
        
        websocket = self.active_connections[connection_id]
        try:
            await websocket.send_text(json.dumps(message, ensure_ascii=False))
        except Exception as e:
            logger.error(f"发送消息失败: {connection_id}, 错误: {e}")
            self.disconnect(connection_id)
    
    async def broadcast_to_tenant(self, tenant_id: int, message: Dict[str, Any]):
        """
        向租户内所有连接广播消息
        
        Args:
            tenant_id: 租户ID
            message: 消息内容
        """
        if tenant_id not in self.tenant_connections:
            return
        
        connection_ids = list(self.tenant_connections[tenant_id])
        for connection_id in connection_ids:
            await self.send_personal_message(connection_id, message)
    
    async def broadcast_to_user(self, user_id: int, message: Dict[str, Any]):
        """
        向用户的所有连接广播消息
        
        Args:
            user_id: 用户ID
            message: 消息内容
        """
        if user_id not in self.user_connections:
            return
        
        connection_ids = list(self.user_connections[user_id])
        for connection_id in connection_ids:
            await self.send_personal_message(connection_id, message)
    
    async def broadcast_to_channel(self, channel: str, message: Dict[str, Any]):
        """
        向频道内所有连接广播消息
        
        Args:
            channel: 频道名称
            message: 消息内容
        """
        if channel not in self.channel_connections:
            return
        
        connection_ids = list(self.channel_connections[channel])
        for connection_id in connection_ids:
            await self.send_personal_message(connection_id, message)
    
    async def subscribe_channel(self, connection_id: str, channel: str):
        """
        订阅频道
        
        Args:
            connection_id: 连接ID
            channel: 频道名称
        """
        if connection_id not in self.connection_info:
            return
        
        # 添加到连接信息
        self.connection_info[connection_id]["channels"].add(channel)
        
        # 添加到频道分组
        if channel not in self.channel_connections:
            self.channel_connections[channel] = set()
        self.channel_connections[channel].add(connection_id)
        
        logger.info(f"连接 {connection_id} 订阅频道: {channel}")
    
    async def unsubscribe_channel(self, connection_id: str, channel: str):
        """
        取消订阅频道
        
        Args:
            connection_id: 连接ID
            channel: 频道名称
        """
        if connection_id not in self.connection_info:
            return
        
        # 从连接信息移除
        self.connection_info[connection_id]["channels"].discard(channel)
        
        # 从频道分组移除
        if channel in self.channel_connections:
            self.channel_connections[channel].discard(connection_id)
            if not self.channel_connections[channel]:
                del self.channel_connections[channel]
        
        logger.info(f"连接 {connection_id} 取消订阅频道: {channel}")
    
    def get_connection_count(self) -> Dict[str, int]:
        """
        获取连接统计信息
        
        Returns:
            Dict[str, int]: 连接统计信息
        """
        return {
            "total": len(self.active_connections),
            "tenants": len(self.tenant_connections),
            "users": len(self.user_connections),
            "channels": len(self.channel_connections),
        }


# 全局WebSocket管理器实例
websocket_manager = WebSocketManager()


class WebSocketService:
    """
    WebSocket服务类
    
    提供WebSocket连接管理和实时数据推送功能。
    """
    
    @staticmethod
    async def handle_websocket(
        websocket: WebSocket,
        tenant_id: int,
        user_id: int,
        channels: Optional[list] = None
    ):
        """
        处理WebSocket连接
        
        Args:
            websocket: WebSocket连接对象
            tenant_id: 租户ID
            user_id: 用户ID
            channels: 订阅的频道列表（可选）
        """
        connection_id = await websocket_manager.connect(websocket, tenant_id, user_id, channels)
        
        try:
            while True:
                # 接收客户端消息
                data = await websocket.receive_text()
                
                try:
                    message = json.loads(data)
                    message_type = message.get("type")
                    
                    if message_type == "subscribe":
                        # 订阅频道
                        channel = message.get("channel")
                        if channel:
                            await websocket_manager.subscribe_channel(connection_id, channel)
                            await websocket_manager.send_personal_message(connection_id, {
                                "type": "subscribed",
                                "channel": channel,
                                "message": f"已订阅频道: {channel}",
                            })
                    
                    elif message_type == "unsubscribe":
                        # 取消订阅频道
                        channel = message.get("channel")
                        if channel:
                            await websocket_manager.unsubscribe_channel(connection_id, channel)
                            await websocket_manager.send_personal_message(connection_id, {
                                "type": "unsubscribed",
                                "channel": channel,
                                "message": f"已取消订阅频道: {channel}",
                            })
                    
                    elif message_type == "ping":
                        # 心跳检测
                        await websocket_manager.send_personal_message(connection_id, {
                            "type": "pong",
                            "timestamp": datetime.now().isoformat(),
                        })
                    
                    else:
                        logger.warning(f"未知消息类型: {message_type}")
                
                except json.JSONDecodeError:
                    logger.error(f"消息格式错误: {data}")
                except Exception as e:
                    logger.error(f"处理消息失败: {e}")
        
        except WebSocketDisconnect:
            logger.info(f"WebSocket连接断开: {connection_id}")
        except Exception as e:
            logger.error(f"WebSocket连接错误: {e}")
        finally:
            websocket_manager.disconnect(connection_id)
    
    @staticmethod
    async def push_to_tenant(tenant_id: int, channel: str, data: Dict[str, Any]):
        """
        向租户推送数据
        
        Args:
            tenant_id: 租户ID
            channel: 频道名称
            data: 数据内容
        """
        message = {
            "type": "data",
            "channel": channel,
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }
        await websocket_manager.broadcast_to_tenant(tenant_id, message)
    
    @staticmethod
    async def push_to_user(user_id: int, channel: str, data: Dict[str, Any]):
        """
        向用户推送数据
        
        Args:
            user_id: 用户ID
            channel: 频道名称
            data: 数据内容
        """
        message = {
            "type": "data",
            "channel": channel,
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }
        await websocket_manager.broadcast_to_user(user_id, message)
    
    @staticmethod
    async def push_to_channel(channel: str, data: Dict[str, Any]):
        """
        向频道推送数据
        
        Args:
            channel: 频道名称
            data: 数据内容
        """
        message = {
            "type": "data",
            "channel": channel,
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }
        await websocket_manager.broadcast_to_channel(channel, message)
