"""
超级管理员安全工具模块

提供超级管理员 JWT Token 生成、验证功能
注意：平台管理员使用 User 模型（is_platform_admin=True 且 tenant_id=None）
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from jose import JWTError, jwt

from app.config import settings
from models.user import User


def create_superadmin_token(
    user: User,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    创建系统级超级管理员 JWT 访问令牌
    
    生成包含系统级超级管理员信息的 JWT Token。
    注意：系统级超级管理员 Token 的 tenant_id 为 None。
    
    Args:
        user: 平台管理员用户对象（is_platform_admin=True 且 tenant_id=None）
        expires_delta: 过期时间增量（可选，默认使用配置中的过期时间）
        
    Returns:
        str: JWT Token 字符串
        
    Example:
        >>> user = User(id=1, username="superadmin", is_platform_admin=True, tenant_id=None)
        >>> token = create_superadmin_token(user)
        >>> len(token) > 0
        True
    """
    to_encode: Dict[str, Any] = {
        "sub": str(user.id),  # 用户 ID
        "username": user.username,
        "is_superadmin": True,  # ⭐ 关键：标记为系统级超级管理员
        "tenant_id": None,  # ⭐ 关键：系统级超级管理员 tenant_id 为 None
    }
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def get_superadmin_token_payload(token: str) -> Optional[Dict[str, Any]]:
    """
    获取超级管理员 Token 载荷
    
    验证并解码超级管理员 JWT Token，返回 Token 中的载荷数据。
    
    Args:
        token: JWT Token 字符串
        
    Returns:
        Optional[Dict[str, Any]]: Token 载荷数据，如果验证失败则返回 None
        
    Example:
        >>> user = User(id=1, username="superadmin", is_platform_admin=True, tenant_id=None)
        >>> token = create_superadmin_token(user)
        >>> payload = get_superadmin_token_payload(token)
        >>> payload is not None
        True
        >>> payload.get("is_superadmin")
        True
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # 验证是否为超级管理员 Token
        if not payload.get("is_superadmin"):
            return None
        
        return payload
    except JWTError:
        return None


def create_token_for_superadmin(user: User) -> Dict[str, Any]:
    """
    为系统级超级管理员创建 Token 信息
    
    创建访问令牌和刷新令牌（如果需要）。
    
    Args:
        user: 平台管理员用户对象（is_platform_admin=True 且 tenant_id=None）
        
    Returns:
        Dict[str, Any]: 包含 token、token_type、expires_in 的字典
        
    Example:
        >>> user = User(id=1, username="superadmin", is_platform_admin=True, tenant_id=None)
        >>> result = create_token_for_superadmin(user)
        >>> "token" in result
        True
    """
    access_token = create_superadmin_token(user)
    
    return {
        "token": access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }

