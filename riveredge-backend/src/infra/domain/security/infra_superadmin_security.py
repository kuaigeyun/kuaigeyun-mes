"""
平台超级管理员安全工具模块

提供平台超级管理员 JWT Token 生成、验证功能。
平台超级管理员使用独立的 Token 系统，不包含 tenant_id；默认短过期且可用独立签名密钥。
有操作时可滑动续签（未过期或宽限期内换新票）；空闲超时后须重新登录。
"""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from loguru import logger

from infra.config.infra_config import infra_settings as settings
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.domain.security.security import JWT_REFRESH_GRACE_SECONDS
from core.utils.timezone_utils import now_utc


def _infra_secret() -> str:
    return settings.resolved_infra_superadmin_jwt_secret


def _infra_expire_minutes() -> int:
    return max(5, int(settings.INFRA_SUPERADMIN_TOKEN_EXPIRE_MINUTES or 15))


def create_infra_superadmin_token(
    admin: InfraSuperAdmin,
    expires_delta: Optional[timedelta] = None
) -> str:
    """创建平台超级管理员 JWT（默认短过期，独立密钥）。"""
    to_encode: Dict[str, Any] = {
        "sub": str(admin.id),
        "username": admin.username,
        "is_infra_superadmin": True,
        "tenant_id": None,
        "typ": "infra_superadmin",
    }

    if expires_delta:
        expire = now_utc() + expires_delta
    else:
        expire = now_utc() + timedelta(minutes=_infra_expire_minutes())

    to_encode.update({"exp": expire, "iat": now_utc()})

    return jwt.encode(
        to_encode,
        _infra_secret(),
        algorithm=settings.JWT_ALGORITHM,
    )


def get_infra_superadmin_token_payload(token: str) -> Optional[Dict[str, Any]]:
    """验证并解码平台超级管理员 JWT（校验过期）。"""
    try:
        payload = jwt.decode(
            token,
            _infra_secret(),
            algorithms=[settings.JWT_ALGORITHM],
        )
        if not payload.get("is_infra_superadmin"):
            return None
        return payload
    except JWTError:
        return None
    except Exception:
        return None


def get_infra_superadmin_token_payload_for_refresh(token: str) -> Optional[Dict[str, Any]]:
    """
    活动续签用：校验签名；允许在 exp 后短宽限内换票（避免请求竞态）。
    超过宽限视为空闲超时，须重新登录（不做 7 天长链续期）。
    """
    try:
        payload = jwt.decode(
            token,
            _infra_secret(),
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False},
        )
    except JWTError:
        return None
    except Exception:
        return None

    if not payload.get("is_infra_superadmin") or not payload.get("sub"):
        return None

    now = time.time()
    exp = payload.get("exp")
    if exp is not None and now > float(exp) + JWT_REFRESH_GRACE_SECONDS:
        return None
    return payload


def create_token_for_infra_superadmin(admin: InfraSuperAdmin) -> Dict[str, Any]:
    """为平台超级管理员创建 Token 信息。"""
    minutes = _infra_expire_minutes()
    access_token = create_infra_superadmin_token(
        admin,
        expires_delta=timedelta(minutes=minutes),
    )
    logger.info(
        "infra_superadmin_token_issued admin_id={} expires_minutes={}",
        admin.id,
        minutes,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": minutes * 60,
        "refresh_supported": True,
    }
