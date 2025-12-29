"""
安全工具模块

提供 JWT Token 生成、验证和密码加密功能
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from infra.config.infra_config import infra_settings as settings


# 密码加密上下文（使用 pbkdf2，更好的跨平台兼容性）
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
    pbkdf2_sha256__default_rounds=30000
)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    创建 JWT 访问令牌
    
    生成包含用户信息和组织信息的 JWT Token。
    
    Args:
        data: 要编码到 Token 中的数据（必须包含 sub 和 tenant_id）
        expires_delta: 过期时间增量（可选，默认使用配置中的过期时间）
        
    Returns:
        str: JWT Token 字符串
        
    Example:
        >>> token = create_access_token(
        ...     data={"sub": "user123", "tenant_id": 1, "username": "testuser"}
        ... )
        >>> len(token) > 0
        True
    """
    to_encode = data.copy()
    
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


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    验证 JWT Token
    
    验证并解码 JWT Token，返回 Token 中的载荷数据。
    
    Args:
        token: JWT Token 字符串
        
    Returns:
        Optional[Dict[str, Any]]: Token 载荷数据，如果验证失败则返回 None
        
    Example:
        >>> token = create_access_token({"sub": "user123", "tenant_id": 1})
        >>> payload = verify_token(token)
        >>> payload is not None
        True
        >>> payload["sub"]
        'user123'
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def hash_password(password: str) -> str:
    """
    加密密码

    使用 pbkdf2_sha256 算法加密密码，支持任意长度的密码。

    Args:
        password: 明文密码

    Returns:
        str: 加密后的密码哈希值（固定长度约60字符）

    Example:
        >>> hashed = hash_password("mypassword")
        >>> len(hashed) > 0
        True
    """
    # pbkdf2_sha256 支持任意长度的密码，不需要长度限制
    
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码
    
    验证提供的明文密码是否与存储的密码哈希值匹配。
    
    Args:
        plain_password: 明文密码
        hashed_password: 密码哈希值
        
    Returns:
        bool: 密码匹配返回 True，否则返回 False
        
    Example:
        >>> hashed = hash_password("mypassword")
        >>> verify_password("mypassword", hashed)
        True
        >>> verify_password("wrongpassword", hashed)
        False
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_token_for_user(
    user_id: int,
    username: str,
    tenant_id: Optional[int],
    is_infra_admin: bool = False,
    is_tenant_admin: bool = False,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    为用户创建 JWT Token
    
    生成包含用户信息和组织信息的 JWT Token。
    系统级超级管理员的 tenant_id 可以为 None。
    
    Args:
        user_id: 用户 ID
        username: 用户名
        tenant_id: 组织 ID（关键：用于多组织隔离，系统级超级管理员可为 None）
        is_infra_admin: 是否为平台管理（系统级超级管理员）
        is_tenant_admin: 是否为组织管理员
        expires_delta: 过期时间增量（可选）
        
    Returns:
        str: JWT Token 字符串
        
    Example:
        >>> token = create_token_for_user(
        ...     user_id=1,
        ...     username="testuser",
        ...     tenant_id=1,
        ...     is_infra_admin=False,
        ...     is_tenant_admin=True
        ... )
        >>> len(token) > 0
        True
    """
    data = {
        "sub": str(user_id),  # 用户 ID（标准 JWT 字段）
        "username": username,
        "tenant_id": tenant_id,  # ⭐ 关键：组织 ID，用于多组织隔离（平台管理可为 None）
        "is_infra_admin": is_infra_admin,
        "is_tenant_admin": is_tenant_admin,
    }
    
    return create_access_token(data, expires_delta)


def get_token_payload(token: str) -> Optional[Dict[str, Any]]:
    """
    获取 Token 载荷数据
    
    验证并返回 Token 中的载荷数据。
    
    Args:
        token: JWT Token 字符串
        
    Returns:
        Optional[Dict[str, Any]]: Token 载荷数据，包含：
            - sub: 用户 ID
            - username: 用户名
            - tenant_id: 组织 ID
            - is_infra_admin: 是否为平台管理
            - is_tenant_admin: 是否为组织管理员
            - exp: 过期时间
            - iat: 签发时间
        如果验证失败则返回 None
    """
    return verify_token(token)

