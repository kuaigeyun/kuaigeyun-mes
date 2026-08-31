"""
官方接口库域名可配置（默认 kuaigeyun.com）。

- 缺省值只在本模块定义：DEFAULT_OFFICIAL_API_LIBRARY_HOST
- 平台设置 official_api_library_host 非空时覆盖缺省
- 私有部署拉取/提交指向解析后的 https://{host}
- 管理 UniTable / 写入：本机官方库真源，或请求 Host 命中配置域名
"""

from __future__ import annotations

from typing import FrozenSet, Optional
from urllib.parse import urlparse

from infra.config.infra_config import infra_settings
from infra.constants.official_provenance import OFFICIAL_SITE
from infra.exceptions.exceptions import ValidationError

OFFICIAL_REGISTRY_HOSTS: FrozenSet[str] = frozenset({"kuaigeyun.com", "www.kuaigeyun.com"})

DEFAULT_OFFICIAL_API_LIBRARY_HOST = "kuaigeyun.com"
# 兼容旧引用：缺省 base URL（未读库时的常量默认）
OFFICIAL_API_LIBRARY_BASE_URL = OFFICIAL_SITE.rstrip("/")
OFFICIAL_API_LIBRARY_API_PREFIX = "/api/v1/infra/official-api-library"


def normalize_registry_host(host: str) -> str:
    return (host or "").strip().lower().split(":")[0]


def is_official_registry_host(host: str) -> bool:
    return normalize_registry_host(host) in OFFICIAL_REGISTRY_HOSTS


def is_registry_summary_admin_enabled() -> bool:
    """本部署是否为官方注册中心（非自托管 / 非 fork 部署应设为 false）。"""
    return bool(infra_settings.INSTALL_REPO_SUMMARY_ADMIN_ENABLED)


def is_local_official_api_library_host() -> bool:
    """本部署是否直接读写官方接口库本地表。

    - 官方 SaaS：INSTALL_REPO_SUMMARY_ADMIN_ENABLED=true
    - 开发环境：本机作为官方库真源，便于提交/浏览
    """
    if is_registry_summary_admin_enabled():
        return True
    env = (infra_settings.ENVIRONMENT or "").strip().lower()
    return env in {"development", "dev", "local"}


def normalize_official_api_library_host_input(raw: Optional[str]) -> str:
    """将用户输入规范为纯域名（无协议/路径）。空则回缺省。"""
    text = (raw or "").strip()
    if not text:
        return DEFAULT_OFFICIAL_API_LIBRARY_HOST
    if "://" not in text:
        text = f"https://{text}"
    parsed = urlparse(text)
    host = normalize_registry_host(parsed.netloc or parsed.path.split("/")[0])
    if not host or "." not in host:
        raise ValidationError("官方接口库域名无效")
    if host.startswith("www."):
        host = host[4:]
    return host


def official_api_library_host_candidates(configured_host: str) -> FrozenSet[str]:
    host = normalize_registry_host(configured_host) or DEFAULT_OFFICIAL_API_LIBRARY_HOST
    if host.startswith("www."):
        bare = host[4:]
        www = host
    else:
        bare = host
        www = f"www.{host}"
    candidates = {bare, www}
    if bare == DEFAULT_OFFICIAL_API_LIBRARY_HOST:
        candidates |= set(OFFICIAL_REGISTRY_HOSTS)
    return frozenset(candidates)


def is_request_on_official_api_library_host(request_host: str, configured_host: str) -> bool:
    current = normalize_registry_host(request_host)
    if not current:
        return False
    return current in official_api_library_host_candidates(configured_host)


def base_url_for_official_api_library_host(host: str) -> str:
    normalized = normalize_registry_host(host) or DEFAULT_OFFICIAL_API_LIBRARY_HOST
    if normalized.startswith("www."):
        normalized = normalized[4:]
    return f"https://{normalized}"


async def resolve_official_api_library_host() -> str:
    from infra.models.platform_settings import PlatformSettings

    settings = await PlatformSettings.first()
    raw = (getattr(settings, "official_api_library_host", None) or "").strip() if settings else ""
    if not raw:
        return DEFAULT_OFFICIAL_API_LIBRARY_HOST
    try:
        return normalize_official_api_library_host_input(raw)
    except ValidationError:
        return DEFAULT_OFFICIAL_API_LIBRARY_HOST


async def resolve_official_api_library_base_url() -> str:
    return base_url_for_official_api_library_host(await resolve_official_api_library_host())


async def can_manage_official_api_library(*, request_host: str = "") -> bool:
    """是否可展示管理表并写入本地官方库。"""
    if is_local_official_api_library_host():
        return True
    configured = await resolve_official_api_library_host()
    return is_request_on_official_api_library_host(request_host, configured)
