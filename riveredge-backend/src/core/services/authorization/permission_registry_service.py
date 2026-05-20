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


class PermissionRegistryService:
    """统一聚合权限定义真源（核心常量 + 应用 manifest）。"""

    CORE_PERMISSION_CODES: set[str] = {
        "system:application:read",
        "system:application:update",
        "system:application:delete",
        "system:user:create",
        "system:user:read",
        "system:user:update",
        "system:user:delete",
        "system:department:create",
        "system:department:read",
        "system:department:update",
        "system:department:delete",
        "system:position:create",
        "system:position:read",
        "system:position:update",
        "system:position:delete",
        "system:role:create",
        "system:role:read",
        "system:role:update",
        "system:role:delete",
        "system:role:assign",
        "system:permission:read",
        "system:permission:update",
        "system:menu:create",
        "system:menu:read",
        "system:menu:update",
        "system:menu:delete",
        "system:policy:create",
        "system:policy:read",
        "system:policy:update",
        "system:policy:delete",
        "system:user:import",
        "system:user:export",
        "system:file:create",
        "system:file:read",
        "system:file:update",
        "system:file:delete",
        "system:file:export",
        "system:site-setting:read",
        "system:site-setting:update",
        "system:config-center:read",
        "system:config-center:update",
        "system:data-dictionary:create",
        "system:data-dictionary:read",
        "system:data-dictionary:update",
        "system:data-dictionary:delete",
        "system:language:create",
        "system:language:read",
        "system:language:update",
        "system:language:delete",
        "system:code-rule:create",
        "system:code-rule:read",
        "system:code-rule:update",
        "system:code-rule:delete",
        "system:custom-field:create",
        "system:custom-field:read",
        "system:custom-field:update",
        "system:custom-field:delete",
        "system:api:create",
        "system:api:read",
        "system:api:update",
        "system:api:delete",
        "system:data-source:create",
        "system:data-source:read",
        "system:data-source:update",
        "system:data-source:delete",
        "system:application-connection:create",
        "system:application-connection:read",
        "system:application-connection:update",
        "system:application-connection:delete",
        "system:dataset:create",
        "system:dataset:read",
        "system:dataset:update",
        "system:dataset:delete",
        "system:approval-process:create",
        "system:approval-process:read",
        "system:approval-process:update",
        "system:approval-process:delete",
        "system:approval-instance:read",
        "system:approval-instance:update",
        "system:message-template:create",
        "system:message-template:read",
        "system:message-template:update",
        "system:message-template:delete",
        "system:message-config:create",
        "system:message-config:read",
        "system:message-config:update",
        "system:message-config:delete",
        "system:print-device:create",
        "system:print-device:read",
        "system:print-device:update",
        "system:print-device:delete",
        "system:print-template:create",
        "system:print-template:read",
        "system:print-template:update",
        "system:print-template:delete",
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
    }

    @classmethod
    async def collect_definitions(cls, tenant_id: int) -> dict[str, PermissionDefinition]:
        definitions: dict[str, PermissionDefinition] = {}
        for code in cls.CORE_PERMISSION_CODES:
            definitions[code] = PermissionDefinition(code=code, source_type="core", source_path="builtin")

        enabled_apps = await cls._get_enabled_app_codes(tenant_id=tenant_id)
        for item in cls._load_manifest_permissions(enabled_apps=enabled_apps):
            definitions[item.code] = item

        return definitions

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

            for raw_code in data.get("permissions", []) or []:
                code = PermissionRegistryService._clean_code(raw_code)
                if not code:
                    continue
                out[code] = PermissionDefinition(
                    code=code,
                    source_type="manifest",
                    source_app=app_code,
                    source_path=f"{app_code}/manifest.json:permissions",
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
    def _collect_menu_permissions(
        node: dict[str, Any],
        out: dict[str, PermissionDefinition],
        app_code: str,
        node_path: str,
    ) -> None:
        code = PermissionRegistryService._clean_code(node.get("permission"))
        if code:
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
