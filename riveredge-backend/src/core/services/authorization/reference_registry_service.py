"""引用资源注册表：manifest reference_resources + module_references 聚合。"""

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

HOST_DISPLAY_ACTIONS = ("read", "create", "update")


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
    resources: dict[str, ReferenceResourceDef] = field(default_factory=dict)
    """target resource_key → 可隐式授予 display 的宿主完整权限码"""
    implicit_display_by_target: dict[str, set[str]] = field(default_factory=dict)
    """宿主完整权限码 → 引用的 target resource_key 集合"""
    host_permissions_by_target: dict[str, set[str]] = field(default_factory=dict)


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

        cls._finalize_implicit_map(registry)
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
            host_codes = {f"system:{hm}:{action}" for action in HOST_DISPLAY_ACTIONS}
            for raw_target in targets:
                target_key = str(raw_target).strip().lower()
                if target_key:
                    registry.host_permissions_by_target.setdefault(target_key, set()).update(host_codes)

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
            host_codes: set[str] = set()
            for action in HOST_DISPLAY_ACTIONS:
                host_codes.add(f"{app_code}:{hm}:{action}")
            for raw_target in targets:
                target_key = str(raw_target).strip().lower()
                if not target_key:
                    continue
                registry.host_permissions_by_target.setdefault(target_key, set()).update(host_codes)

    @staticmethod
    def _finalize_implicit_map(registry: ReferenceRegistry) -> None:
        for target_key, host_codes in registry.host_permissions_by_target.items():
            defn = registry.resources.get(target_key)
            if defn is None or defn.sensitive:
                continue
            registry.implicit_display_by_target[target_key] = set(host_codes)

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
        """校验 module_references 目标均在 reference_resources 中且非 sensitive。"""
        registry = cls.build(enabled_apps=enabled_apps)
        errors: list[str] = []
        for target_key in registry.host_permissions_by_target:
            defn = registry.resources.get(target_key)
            if defn is None:
                errors.append(f"module_references 目标未注册为 reference_resources: {target_key}")
            elif defn.sensitive:
                errors.append(f"module_references 目标为敏感资源，禁止隐式引用: {target_key}")
        return errors
