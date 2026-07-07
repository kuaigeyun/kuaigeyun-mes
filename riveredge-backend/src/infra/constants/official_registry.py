"""官方 SaaS 注册中心站点判定（构建来源汇总仅在此环境展示）。"""

from __future__ import annotations

from typing import FrozenSet

from infra.config.infra_config import infra_settings

OFFICIAL_REGISTRY_HOSTS: FrozenSet[str] = frozenset({"kuaigeyun.com", "www.kuaigeyun.com"})


def normalize_registry_host(host: str) -> str:
    return (host or "").strip().lower().split(":")[0]


def is_official_registry_host(host: str) -> bool:
    return normalize_registry_host(host) in OFFICIAL_REGISTRY_HOSTS


def is_registry_summary_admin_enabled() -> bool:
    """本部署是否为官方注册中心（非自托管 / 非 fork 部署应设为 false）。"""
    return bool(infra_settings.INSTALL_REPO_SUMMARY_ADMIN_ENABLED)
