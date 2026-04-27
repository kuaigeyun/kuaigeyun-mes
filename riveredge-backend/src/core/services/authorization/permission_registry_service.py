from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from core.config.permission_action_spec import canonical_action
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
        "system:user:create",
        "system:user:read",
        "system:user:update",
        "system:user:delete",
        "system:role:create",
        "system:role:read",
        "system:role:update",
        "system:role:delete",
        "system:permission:read",
        "system:menu:create",
        "system:menu:read",
        "system:menu:update",
        "system:menu:delete",
        "system:policy:create",
        "system:policy:read",
        "system:policy:update",
        "system:policy:delete",
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
            c.strip().lower().replace("_", "-")
            for c in enabled_apps
            if isinstance(c, str) and c.strip()
        }

        for manifest_file in apps_dir.glob("*/manifest.json"):
            try:
                data = json.loads(manifest_file.read_text(encoding="utf-8"))
            except Exception:
                continue

            # 以 manifest 中声明的 code 为准，避免目录名(master_data)与应用码(master-data)不一致导致漏加载
            manifest_code = str(data.get("code") or "").strip().lower().replace("_", "-")
            folder_code = manifest_file.parent.name.strip().lower().replace("_", "-")
            app_code = manifest_code or folder_code
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
        code = PermissionRegistryService._clean_code(node.get("permission_code") or node.get("permission"))
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
        code = raw.strip().lower().replace("_", "-")
        if not code:
            return None
        if ":" not in code:
            return code
        left, action = code.rsplit(":", 1)
        return f"{left}:{canonical_action(action)}"

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
            return {str(r["code"]).strip() for r in rows if str(r["code"]).strip()}
        finally:
            await conn.close()
