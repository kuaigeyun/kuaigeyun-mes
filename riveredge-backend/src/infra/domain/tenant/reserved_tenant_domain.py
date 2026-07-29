"""组织域名保留字（与前端 utils/reservedTenantDomain.ts 保持一致）。"""

from __future__ import annotations

import re

from fastapi import HTTPException, status

# 与路由/平台入口冲突，禁止作为租户 domain（精确匹配）
RESERVED_TENANT_DOMAINS: frozenset[str] = frozenset(
    {
        "admin",
        "login",
        "infra",
        "system",
        "apps",
        "api",
        "docs",
        "debug",
        "qrcode",
        "init",
        "personal",
        "lock",
    }
)

_TENANT_DOMAIN_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{2,11}$")


def is_reserved_tenant_domain(domain: str | None) -> bool:
    normalized = (domain or "").strip().lower()
    return bool(normalized) and normalized in RESERVED_TENANT_DOMAINS


def assert_tenant_domain_not_reserved(domain: str) -> str:
    """校验并返回规范化域名；保留字抛出 400。"""
    normalized = (domain or "").strip().lower()
    if is_reserved_tenant_domain(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"组织域名不能使用保留关键词：{normalized}",
        )
    return normalized


def normalize_tenant_domain(domain: str) -> str:
    """站点设置/组织创建用：格式 + 保留字校验。"""
    normalized = (domain or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="组织域名不能为空")
    if len(normalized) < 3 or len(normalized) > 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="组织域名长度需为3-12位")
    if not _TENANT_DOMAIN_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="组织域名必须以小写字母开头，仅支持小写字母、数字、下划线和中划线，且不允许中文",
        )
    assert_tenant_domain_not_reserved(normalized)
    return normalized
