"""官方 SaaS 注册中心站点判定（构建来源汇总仅在此环境展示）。"""

from __future__ import annotations

from typing import FrozenSet

from infra.config.infra_config import infra_settings
from infra.constants.official_provenance import OFFICIAL_SITE

OFFICIAL_REGISTRY_HOSTS: FrozenSet[str] = frozenset({"kuaigeyun.com", "www.kuaigeyun.com"})

# 官方接口库固定站点（私有部署拉取/提交均指向此处，禁止配置旁路）
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
    - 开发环境：本机作为官方库真源，便于提交/浏览（私有生产部署仍走 kuaigeyun.com）
    """
    if is_registry_summary_admin_enabled():
        return True
    env = (infra_settings.ENVIRONMENT or "").strip().lower()
    return env in {"development", "dev", "local"}
