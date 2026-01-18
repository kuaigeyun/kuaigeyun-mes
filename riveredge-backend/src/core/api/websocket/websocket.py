"""
WebSocket API路由模块

提供WebSocket连接端点。

Author: Luigi Lu
Date: 2026-01-27
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Cookie
from typing import Optional
from loguru import logger
import jwt
from datetime import datetime

from core.services.websocket.websocket_service import WebSocketService
from infra.models.user import User
from infra.api.deps.deps import get_current_user as get_current_user_dep
from infra.api.deps.deps import oauth2_scheme

router = APIRouter(prefix="/ws", tags=["WebSocket"])


async def get_user_from_token(token: str) -> Optional[User]:
    """
    从token获取用户信息
    
    Args:
        token: JWT token
        
    Returns:
        Optional[User]: 用户对象，如果token无效则返回None
    """
    try:
        # 复用现有的get_current_user函数
        user = await get_current_user_dep(token)
        return user
    except Exception as e:
        logger.error(f"解析token失败: {e}")
        return None


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    channels: Optional[str] = Query(None, description="订阅的频道列表（逗号分隔）"),
):
    """
    WebSocket连接端点
    
    建立WebSocket连接，支持实时数据推送。
    
    - **channels**: 订阅的频道列表（逗号分隔，如：production,equipment,quality）
    - **token**: 访问令牌（从查询参数或Cookie获取）
    
    消息格式：
    - 订阅频道: {"type": "subscribe", "channel": "production"}
    - 取消订阅: {"type": "unsubscribe", "channel": "production"}
    - 心跳检测: {"type": "ping"}
    
    推送消息格式：
    - 数据推送: {"type": "data", "channel": "production", "data": {...}, "timestamp": "..."}
    """
    # 从查询参数获取token
    token = websocket.query_params.get("token")
    
    # 如果没有从查询参数获取token，尝试从Cookie获取
    if not token:
        # WebSocket不支持直接使用Depends获取Cookie，需要手动解析
        cookie_header = websocket.headers.get("cookie", "")
        if cookie_header:
            cookies = {}
            for cookie in cookie_header.split(";"):
                if "=" in cookie:
                    key, value = cookie.strip().split("=", 1)
                    cookies[key] = value
            token = cookies.get("access_token")
    
    if not token:
        await websocket.close(code=1008, reason="未提供访问令牌")
        return
    
    # 获取用户信息
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=1008, reason="无效的访问令牌")
        return
    
    # 获取租户ID
    tenant_id = user.tenant_id or 0
    
    # 解析频道列表
    channel_list = []
    if channels:
        channel_list = [ch.strip() for ch in channels.split(",") if ch.strip()]
    
    # 处理WebSocket连接
    await WebSocketService.handle_websocket(
        websocket=websocket,
        tenant_id=tenant_id,
        user_id=user.id,
        channels=channel_list,
    )
