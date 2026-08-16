from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from core.services.application.application_service import ApplicationService
from infra.infrastructure.database.database import get_db_connection


@dataclass(frozen=True)
class PermissionDefinition:
    code: str
    source_type: str
    source_app: str | None = None
    source_path: str | None = None
    """在 manifest.permissions 数组中的下标；角色矩阵按此排序（越小越靠前）。"""
    manifest_index: int | None = None


class PermissionRegistryService:
    """统一聚合权限定义真源（核心常量 + 应用 manifest）。"""

    # 登录用户基线：默认授予且不可撤销（个人中心自助能力）
    BASELINE_PERMISSION_CODES: frozenset[str] = frozenset(
        {
            "system:user-profile:read",
            "system:user-profile:update",
            "system:user-preference:read",
            "system:user-preference:update",
            "system:user-message:read",
            "system:user-message:update",
            "system:user-task:read",
            "system:user-task:update",
        }
    )

    # 顺序即角色矩阵 manifest_index（与 MANIFEST_ACTION_ORDER 一致；调整请用 scripts/reorder_manifest_permissions.py 或手工）
    CORE_PERMISSION_CODES: tuple[str, ...] = (
        "system:entry:read",
        "system:application:read",
        "system:application:delete",
        "system:application:update",
        "system:user:read",
        "system:user:create",
        "system:user:delete",
        "system:user:update",
        "system:user:display",
        "system:user:import",
        "system:user:export",
        "system:department:read",
        "system:department:create",
        "system:department:delete",
        "system:department:update",
        "system:department:display",
        "system:department:import",
        "system:department:export",
        "system:position:read",
        "system:position:create",
        "system:position:delete",
        "system:position:update",
        "system:position:display",
        "system:position:import",
        "system:position:export",
        "system:role:read",
        "system:role:create",
        "system:role:delete",
        "system:role:update",
        "system:role:import",
        "system:role:export",
        "system:role:assign",
        "system:permission:read",
        "system:permission:update",
        "system:menu:read",
        "system:menu:create",
        "system:menu:delete",
        "system:menu:update",
        "system:policy:read",
        "system:policy:create",
        "system:policy:delete",
        "system:policy:update",
        "system:file:read",
        "system:file:create",
        "system:file:delete",
        "system:file:update",
        "system:file:display",
        "system:file:export",
        "system:site-setting:read",
        "system:site-setting:update",
        "system:config-center:read",
        "system:config-center:create",
        "system:config-center:delete",
        "system:config-center:update",
        "system:data-dictionary:read",
        "system:data-dictionary:create",
        "system:data-dictionary:delete",
        "system:data-dictionary:update",
        "system:data-dictionary:display",
        "system:language:read",
        "system:language:create",
        "system:language:delete",
        "system:language:update",
        "system:code-rule:read",
        "system:code-rule:create",
        "system:code-rule:delete",
        "system:code-rule:update",
        "system:custom-field:read",
        "system:custom-field:create",
        "system:custom-field:delete",
        "system:custom-field:update",
        "system:api:read",
        "system:api:create",
        "system:api:delete",
        "system:api:update",
        "system:data-source:read",
        "system:data-source:create",
        "system:data-source:delete",
        "system:data-source:update",
        "system:application-connection:read",
        "system:application-connection:create",
        "system:application-connection:delete",
        "system:application-connection:update",
        "system:application-connection:execute",
        "system:dataset:read",
        "system:dataset:create",
        "system:dataset:delete",
        "system:dataset:update",
        "system:approval-process:read",
        "system:approval-process:create",
        "system:approval-process:delete",
        "system:approval-process:update",
        "system:approval-instance:read",
        "system:approval-instance:update",
        "system:message-template:read",
        "system:message-template:create",
        "system:message-template:delete",
        "system:message-template:update",
        "system:message-config:read",
        "system:message-config:create",
        "system:message-config:delete",
        "system:message-config:update",
        "system:print-device:read",
        "system:print-device:create",
        "system:print-device:delete",
        "system:print-device:update",
        "system:print-template:read",
        "system:print-template:create",
        "system:print-template:delete",
        "system:print-template:update",
        "system:operation-log:read",
        "system:login-log:read",
        "system:online-user:read",
        "system:data-backup:read",
        "system:onboarding-wizard:read",
        "system:onboarding-wizard:update",
        "system:plugin-manager:read",
        "system:report-template:read",
        "system:role-scenario:read",
        "system:data-quality:read",
        "system:operation-guide:read",
        "system:launch-progress:read",
        "system:usage-analysis:read",
        "system:user-profile:read",
        "system:user-profile:update",
        "system:user-preference:read",
        "system:user-preference:update",
        "system:user-message:read",
        "system:user-message:update",
        "system:user-task:read",
        "system:user-task:update",
    )

    @classmethod
    def is_baseline_permission_code(cls, code: str | None) -> bool:
        from core.services.authorization.menu_resource_resolver import normalize_permission_code

        norm = normalize_permission_code(code or "")
        return bool(norm) and norm in cls.BASELINE_PERMISSION_CODES

    @classmethod
    def merge_baseline_permission_codes(cls, codes: set[str] | None) -> set[str]:
        """将基线权限并入授权集合（服务端强制，前端不可剥离）。"""
        from core.services.authorization.menu_resource_resolver import normalize_permission_code

        merged: set[str] = set()
        for raw in codes or set():
            norm = normalize_permission_code(raw)
            if norm:
                merged.add(norm)
        merged.update(cls.BASELINE_PERMISSION_CODES)
        return merged

    @classmethod
    async def collect_definitions(cls, tenant_id: int) -> dict[str, PermissionDefinition]:
        definitions: dict[str, PermissionDefinition] = {}
        for idx, code in enumerate(cls.CORE_PERMISSION_CODES):
            definitions[code] = PermissionDefinition(
                code=code,
                source_type="core",
                source_path="builtin",
                manifest_index=idx,
            )

        enabled_apps = await cls._get_enabled_app_codes(tenant_id=tenant_id)
        for item in cls._load_manifest_permissions(enabled_apps=enabled_apps):
            definitions[item.code] = item

        for item in cls._load_reference_display_permissions(enabled_apps=enabled_apps):
            if item.code not in definitions:
                definitions[item.code] = item

        return definitions

    @classmethod
    async def manifest_permission_order(cls, tenant_id: int) -> dict[str, int]:
        """权限码 → manifest.permissions 数组下标（角色功能矩阵展示顺序唯一真源）。"""
        definitions = await cls.collect_definitions(tenant_id=tenant_id)
        order: dict[str, int] = {}
        for code, spec in definitions.items():
            if spec.manifest_index is None:
                continue
            norm = (code or "").strip().lower()
            if norm:
                order[norm] = spec.manifest_index
        return order

    @staticmethod
    def _load_manifest_permissions(enabled_apps: set[str]) -> list[PermissionDefinition]:
        out: dict[str, PermissionDefinition] = {}
        apps_dir = PermissionRegistryService._get_apps_dir()
        if not apps_dir.exists():
            return []

        normalized_enabled = {
            c.strip().lower()
            for c in enabled_apps
            if isinstance(c, str) and c.strip()
        }

        for manifest_file in apps_dir.glob("*/manifest.json"):
            try:
                data = json.loads(manifest_file.read_text(encoding="utf-8"))
            except Exception:
                continue

            manifest_code = str(data.get("code") or "").strip().lower()
            app_code = manifest_code
            if not app_code:
                continue
            if app_code not in normalized_enabled:
                continue

            for idx, raw_code in enumerate(data.get("permissions", []) or []):
                code = PermissionRegistryService._clean_code(raw_code)
                if not code:
                    continue
                prev = out.get(code)
                if prev is not None and prev.manifest_index is not None:
                    continue
                out[code] = PermissionDefinition(
                    code=code,
                    source_type="manifest",
                    source_app=app_code,
                    source_path=f"{app_code}/manifest.json:permissions",
                    manifest_index=idx,
                )

            menu_cfg = data.get("menu_config")
            if isinstance(menu_cfg, dict):
                PermissionRegistryService._collect_menu_permissions(
                    node=menu_cfg,
                    out=out,
                    app_code=app_code,
                    node_path=f"{app_code}/manifest.json:menu_config",
                )

        return list(out.values())

    @staticmethod
    def _load_reference_display_permissions(enabled_apps: set[str]) -> list[PermissionDefinition]:
        from core.services.authorization.reference_registry_service import ReferenceRegistryService

        out: list[PermissionDefinition] = []
        for display_code, source_path in ReferenceRegistryService.collect_display_permission_codes(
            enabled_apps=enabled_apps,
        ):
            code = PermissionRegistryService._clean_code(display_code)
            if not code:
                continue
            out.append(
                PermissionDefinition(
                    code=code,
                    source_type="reference",
                    source_path=source_path or "reference_resources",
                )
            )
        return out

    @staticmethod
    def _collect_menu_permissions(
        node: dict[str, Any],
        out: dict[str, PermissionDefinition],
        app_code: str,
        node_path: str,
    ) -> None:
        code = PermissionRegistryService._clean_code(node.get("permission"))
        if code and code not in out:
            out[code] = PermissionDefinition(
                code=code,
                source_type="manifest",
                source_app=app_code,
                source_path=node_path,
            )

        children = node.get("children") or []
        if isinstance(children, list):
            for idx, child in enumerate(children):
                if isinstance(child, dict):
                    PermissionRegistryService._collect_menu_permissions(
                        node=child,
                        out=out,
                        app_code=app_code,
                        node_path=f"{node_path}.children[{idx}]",
                    )

    @staticmethod
    def _clean_code(raw: Any) -> str | None:
        if not isinstance(raw, str):
            return None
        code = raw.strip().lower()
        if not code:
            return None
        return code

    @staticmethod
    def _get_apps_dir() -> Path:
        return ApplicationService._get_plugins_directory()

    @staticmethod
    async def _get_enabled_app_codes(tenant_id: int) -> set[str]:
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT code
                FROM core_applications
                WHERE tenant_id = $1
                  AND deleted_at IS NULL
                  AND is_installed = TRUE
                  AND is_active = TRUE
                """,
                tenant_id,
            )
            return {
                str(r["code"]).strip().lower().replace("_", "-")
                for r in rows
                if str(r["code"]).strip()
            }
        finally:
            await conn.close()
