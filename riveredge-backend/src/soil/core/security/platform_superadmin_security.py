"""
平台超级管理员安全工具模块

提供平台超级管理员 JWT Token 生成、验证功能。
平台超级管理员使用独立的 Token 系统，不包含 tenant_id。
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from jose import JWTError, jwt

from soil.config.platform_config import platform_settings as settings
from soil.models.platform_superadmin import PlatformSuperAdmin


def create_platform_superadmin_token(
    admin: PlatformSuperAdmin,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    创建平台超级管理员 JWT 访问令牌
    
    生成包含平台超级管理员信息的 JWT Token。
    注意：平台超级管理员 Token 不包含 tenant_id（因为平台超级管理员不属于任何租户）。
    
    Args:
        admin: 平台超级管理员对象
        expires_delta: 过期时间增量（可选，默认使用配置中的过期时间）
        
    Returns:
        str: JWT Token 字符串
        
    Example:
        >>> admin = PlatformSuperAdmin(id=1, username="platform_admin")
        >>> token = create_platform_superadmin_token(admin)
        >>> len(token) > 0
        True
    """
    to_encode: Dict[str, Any] = {
        "sub": str(admin.id),  # 平台超级管理员 ID
        "username": admin.username,
        "is_platform_superadmin": True,  # ⭐ 关键：标记为平台超级管理员
        "tenant_id": None,  # ⭐ 关键：平台超级管理员不属于任何租户
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


def get_platform_superadmin_token_payload(token: str) -> Optional[Dict[str, Any]]:
    """
    获取平台超级管理员 Token 载荷
    
    验证并解码平台超级管理员 JWT Token，返回 Token 中的载荷数据。
    
    Args:
        token: JWT Token 字符串
        
    Returns:
        Optional[Dict[str, Any]]: Token 载荷数据，如果验证失败则返回 None
        
    Example:
        >>> admin = PlatformSuperAdmin(id=1, username="platform_admin")
        >>> token = create_platform_superadmin_token(admin)
        >>> payload = get_platform_superadmin_token_payload(token)
        >>> payload is not None
        True
        >>> payload.get("is_platform_superadmin")
        True
    """
    try:
        from loguru import logger
        logger.info(f"🔍 开始验证平台超级管理员 Token，Token 长度: {len(token) if token else 0}")
        logger.info(f"🔍 使用密钥长度: {len(settings.JWT_SECRET_KEY)}，算法: {settings.JWT_ALGORITHM}")
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        logger.info(f"🔍 Token 解码成功，payload keys: {list(payload.keys())}")
        logger.info(f"🔍 is_platform_superadmin: {payload.get('is_platform_superadmin')}")
        
        # 验证是否为平台超级管理员 Token
        if not payload.get("is_platform_superadmin"):
            logger.warning(f"❌ Token 不是平台超级管理员 Token，payload: {payload}")
            return None
        
        logger.info(f"✅ 平台超级管理员 Token 验证成功，admin_id: {payload.get('sub')}")
        return payload
    except JWTError as e:
        from loguru import logger
        logger.error(f"❌ 平台超级管理员 Token 验证失败 (JWTError): {e}")
        logger.error(f"❌ Token 前50个字符: {token[:50] if token else 'None'}")
        return None
    except Exception as e:
        from loguru import logger
        logger.error(f"❌ 平台超级管理员 Token 验证失败 (Exception): {e}")
        logger.error(f"❌ Token 前50个字符: {token[:50] if token else 'None'}")
        return None


def create_token_for_platform_superadmin(admin: PlatformSuperAdmin) -> Dict[str, Any]:
    """
    为平台超级管理员创建 Token 信息
    
    创建访问令牌和过期时间信息。
    
    Args:
        admin: 平台超级管理员对象
        
    Returns:
        Dict[str, Any]: 包含 access_token、token_type、expires_in 的字典
        
    Example:
        >>> admin = PlatformSuperAdmin(id=1, username="platform_admin")
        >>> result = create_token_for_platform_superadmin(admin)
        >>> "access_token" in result
        True
    """
    access_token = create_platform_superadmin_token(admin)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }

