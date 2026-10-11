"""引用资源注册表。

权限与矩阵「回显」的唯一真源：`reference_resources`（应用 manifest）
+ `CORE_REFERENCE_RESOURCES`（系统级）。

`module_references` 仅声明宿主「会引用哪些目标」，供完整性校验与文档；
不再参与鉴权，也不再构建宿主 create/update/read 隐式放行图。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from core.config.core_reference_resources import (
    CORE_MODULE_REFERENCES,
    CORE_REFERENCE_RESOURCES,
    normalize_reference_resource_spec,
)
from core.services.application.application_service import ApplicationService

HOST_WILDCARD_KEYS = {"*", "__all__", "__all_modules__"}
TARGET_WILDCARD_KEYS = {"*", "__all_targets__", "__all_reference_resources__"}


@dataclass(frozen=True)
class ReferenceResourceDef:
    resource_key: str
    permission_prefix: str
    display_fields: tuple[str, ...]
    data_scope_key: str | None
    sensitive: bool
    source_app: str | None = None
    source_path: str | None = None


@dataclass
class ReferenceRegistry:
    """resources：可被引用的目标（唯一权限真源）。"""

    resources: dict[str, ReferenceResourceDef] = field(default_factory=dict)
    """宿主完整模块键（{app}:{module} 或 system:{module}）→ 声明引用的 target resource_key。"""
    declared_targets_by_host: dict[str, set[str]] = field(default_factory=dict)


class ReferenceRegistryService:
    @staticmethod
    def _apps_dir() -> Path:
        return ApplicationService._get_plugins_directory()

    @classmethod
    def build(cls, *, enabled_apps: set[str] | None = None) -> ReferenceRegistry:
        registry = ReferenceRegistry()
        cls._load_core_resources(registry)
        cls._load_core_module_references(registry)

        apps_dir = cls._apps_dir()
        if not apps_dir.exists():
            return registry

        normalized_enabled: set[str] | None = None
        if enabled_apps is not None:
            normalized_enabled = {
                c.strip().lower().replace("_", "-")
                for c in enabled_apps
                if isinstance(c, str) and c.strip()
            }

        for manifest_file in sorted(apps_dir.glob("*/manifest.json")):
            try:
                data = json.loads(manifest_file.read_text(encoding="utf-8"))
            except Exception:
                continue
            app_code = str(data.get("code") or "").strip().lower()
            if not app_code:
                continue
            if normalized_enabled is not None and app_code not in normalized_enabled:
                continue
            cls._load_app_reference_resources(registry, app_code, data, str(manifest_file))
            cls._load_app_module_references(registry, app_code, data)

        return registry

    @classmethod
    @lru_cache(maxsize=4)
    def get_cached(cls, enabled_apps_key: str) -> ReferenceRegistry:
        apps = frozenset(enabled_apps_key.split(",")) if enabled_apps_key else frozenset()
        return cls.build(enabled_apps=set(apps) if apps else None)

    @classmethod
    def invalidate_cache(cls) -> None:
        cls.get_cached.cache_clear()

    @staticmethod
    def _load_core_resources(registry: ReferenceRegistry) -> None:
        for resource_key, spec in CORE_REFERENCE_RESOURCES.items():
            key = resource_key.strip().lower()
            registry.resources[key] = ReferenceResourceDef(
                resource_key=key,
                permission_prefix=str(spec["permission_prefix"]).strip().lower(),
                display_fields=tuple(spec.get("display_fields") or ("id", "uuid", "code", "name", "label")),
                data_scope_key=(str(spec["data_scope_key"]).strip().lower() if spec.get("data_scope_key") else None),
                sensitive=bool(spec.get("sensitive", False)),
                source_app="core",
                source_path="core_reference_resources",
            )

    @staticmethod
    def _load_core_module_references(registry: ReferenceRegistry) -> None:
        for host_module, targets in CORE_MODULE_REFERENCES.items():
            hm = str(host_module).strip().lower()
            if not hm or not isinstance(targets, list):
                continue
            host_key = f"system:{hm}"
            bucket = registry.declared_targets_by_host.setdefault(host_key, set())
            for raw_target in targets:
                target_key = str(raw_target).strip().lower()
                if target_key:
                    bucket.add(target_key)

    @staticmethod
    def _load_app_reference_resources(
        registry: ReferenceRegistry,
        app_code: str,
        data: dict[str, Any],
        manifest_path: str,
    ) -> None:
        ref_block = data.get("reference_resources")
        if not isinstance(ref_block, dict):
            return
        for local_key, raw in ref_block.items():
            lk = str(local_key).strip().lower()
            if not lk:
                continue
            spec = normalize_reference_resource_spec(raw, app_code=app_code, local_key=lk)
            if spec is None:
                continue
            resource_key = f"{app_code}:{lk}"
            registry.resources[resource_key] = ReferenceResourceDef(
                resource_key=resource_key,
                permission_prefix=spec["permission_prefix"],
                display_fields=tuple(spec["display_fields"]),
                data_scope_key=spec.get("data_scope_key"),
                sensitive=bool(spec.get("sensitive", False)),
                source_app=app_code,
                source_path=f"{manifest_path}:reference_resources.{lk}",
            )

    @staticmethod
    def _load_app_module_references(
        registry: ReferenceRegistry,
        app_code: str,
        data: dict[str, Any],
    ) -> None:
        refs = data.get("module_references")
        if not isinstance(refs, dict):
            return
        for host_module, targets in refs.items():
            hm = str(host_module).strip().lower()
            if not hm or not isinstance(targets, list):
                continue
            host_key = f"{app_code}:{'*' if hm in HOST_WILDCARD_KEYS else hm}"
            bucket = registry.declared_targets_by_host.setdefault(host_key, set())
            for raw_target in targets:
                target_key = str(raw_target).strip().lower()
                if target_key:
                    bucket.add(target_key)

    @classmethod
    def collect_display_permission_codes(cls, *, enabled_apps: set[str] | None = None) -> list[tuple[str, str | None]]:
        """返回 (display_code, source_path) 列表，供权限注册。"""
        registry = cls.build(enabled_apps=enabled_apps)
        out: list[tuple[str, str | None]] = []
        for defn in registry.resources.values():
            if defn.sensitive:
                continue
            out.append((f"{defn.permission_prefix}:display", defn.source_path))
        return out

    @classmethod
    def validate_module_references(cls, *, enabled_apps: set[str] | None = None) -> list[str]:
        """校验 module_references 目标均已登记在 reference_resources（或核心表）且非 sensitive。"""
        registry = cls.build(enabled_apps=enabled_apps)
        errors: list[str] = []
        seen_targets: set[str] = set()
        for targets in registry.declared_targets_by_host.values():
            for target_key in targets:
                if target_key in TARGET_WILDCARD_KEYS or target_key in seen_targets:
                    continue
                seen_targets.add(target_key)
                defn = registry.resources.get(target_key)
                if defn is None:
                    errors.append(f"module_references 目标未注册为 reference_resources: {target_key}")
                elif defn.sensitive:
                    errors.append(f"module_references 目标为敏感资源，禁止声明引用: {target_key}")
        return errors
