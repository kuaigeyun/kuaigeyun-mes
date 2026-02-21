"""
权限同步服务

将系统中的权限码来源同步到 core_permissions 表，供角色分配与菜单/接口校验使用。

权限来源（_collect_candidate_codes）：
- 核心接口：require_access 使用的 system.* 等（_core_permission_codes）
- 菜单表：core_menus 中已配置的 permission_code，以及未配置时的回填推导（_backfill_menu_permission_codes）
- 前端应用 manifest：各应用 manifest.json 的 permissions 与 menu_config 内 permission/permission_code
- 数据范围：由功能权限派生的 *:data:all/department/self（_derive_data_scope_permissions）

约定：菜单项应有 permission_code 与 core_permissions.code 一致；接口校验使用 require_access 或 UserPermissionService。
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from infra.infrastructure.database.database import get_db_connection


class PermissionSyncService:
    """按租户增量同步权限定义到 core_permissions。"""

    _last_sync_ts: dict[int, float] = {}
    _sync_interval_seconds = 300

    # 核心接口使用的权限点（require_access）
    _core_permission_codes: set[str] = {
        "system.user:create",
        "system.user:read",
        "system.user:update",
        "system.user:delete",
        "system.role:create",
        "system.role:read",
        "system.role:update",
        "system.role:delete",
        "system.role:assign",
        "system.permission:read",
        "system.menu:create",
        "system.menu:read",
        "system.menu:update",
        "system.menu:delete",
        "system.policy:create",
        "system.policy:read",
        "system.policy:update",
        "system.policy:delete",
    }

    @classmethod
    async def ensure_permissions(cls, tenant_id: int, force: bool = False) -> dict[str, int]:
        """
        同步当前租户的缺失权限到 core_permissions（来源：核心接口、core_menus、前端应用 manifest）。
        菜单同步后应调用本方法（force=True），保证角色权限页「全部权限」含应用级菜单权限。

        Returns:
            {"created": 新增数量, "scanned": 扫描到的权限码数量}
        """
        now = time.time()
        if not force:
            last_ts = cls._last_sync_ts.get(tenant_id, 0)
            if now - last_ts < cls._sync_interval_seconds:
                return {"created": 0, "scanned": 0}

        candidate_codes = await cls._collect_candidate_codes(tenant_id)
        if not candidate_codes:
            cls._last_sync_ts[tenant_id] = now
            return {"created": 0, "scanned": 0}

        conn = await get_db_connection()
        try:
            existing_rows = await conn.fetch(
                """
                SELECT code
                FROM core_permissions
                WHERE tenant_id = $1 AND deleted_at IS NULL
                """,
                tenant_id,
            )
            existing_codes = {str(r["code"]) for r in existing_rows}

            to_create = sorted(code for code in candidate_codes if code not in existing_codes)
            if not to_create:
                cls._last_sync_ts[tenant_id] = now
                return {"created": 0, "scanned": len(candidate_codes)}

            created_at = datetime.utcnow()
            rows: list[tuple[Any, ...]] = []
            for code in to_create:
                resource, action = cls._split_code(code)
                permission_type = cls._infer_permission_type(code)
                rows.append(
                    (
                        str(uuid4()),
                        tenant_id,
                        cls._build_permission_name(resource, action, permission_type),
                        code,
                        resource[:50],
                        action[:50],
                        f"自动同步权限: {code}",
                        permission_type,
                        created_at,
                        created_at,
                    )
                )

            await conn.executemany(
                """
                INSERT INTO core_permissions
                (uuid, tenant_id, name, code, resource, action, description, permission_type, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """,
                rows,
            )

            cls._last_sync_ts[tenant_id] = now
            return {"created": len(rows), "scanned": len(candidate_codes)}
        finally:
            await conn.close()

    @classmethod
    async def _collect_candidate_codes(cls, tenant_id: int) -> set[str]:
        codes: set[str] = set(cls._core_permission_codes)

        # 菜单里配置的权限码（并自动回填缺失的菜单 permission_code，保证“菜单-功能权限”可对应）
        backfilled_codes = await cls._backfill_menu_permission_codes(tenant_id)
        codes.update(backfilled_codes)

        conn = await get_db_connection()
        try:
            menu_rows = await conn.fetch(
                """
                SELECT DISTINCT permission_code
                FROM core_menus
                WHERE tenant_id = $1
                  AND deleted_at IS NULL
                  AND permission_code IS NOT NULL
                  AND permission_code <> ''
                """,
                tenant_id,
            )
            for row in menu_rows:
                code = str(row["permission_code"]).strip()
                if code:
                    codes.add(code)
        finally:
            await conn.close()

        # 前端应用 manifest 中声明的权限码
        codes.update(cls._load_manifest_permissions())
        codes.update(cls._derive_data_scope_permissions(codes))

        return {c for c in codes if c}

    @classmethod
    async def _backfill_menu_permission_codes(cls, tenant_id: int) -> set[str]:
        """
        为缺失 permission_code 的叶子菜单自动回填权限码。

        规则：
        1) 优先使用 meta.node 作为资源标识；
        2) 否则使用 path 最后一个片段；
        3) 统一生成 {app}:{resource}:view（app 从 /apps/{app}/... 提取）。
        """
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT
                    m.id,
                    m.path,
                    m.meta,
                    m.permission_code,
                    COUNT(c.id) AS child_count
                FROM core_menus m
                LEFT JOIN core_menus c
                  ON c.parent_id = m.id
                 AND c.deleted_at IS NULL
                WHERE m.tenant_id = $1
                  AND m.deleted_at IS NULL
                GROUP BY m.id, m.path, m.meta, m.permission_code
                """,
                tenant_id,
            )

            updates: list[tuple[str, datetime, int, int]] = []
            generated: set[str] = set()
            now = datetime.utcnow()

            for row in rows:
                permission_code = (row.get("permission_code") or "").strip()
                child_count = int(row.get("child_count") or 0)
                if permission_code or child_count > 0:
                    continue

                path = (row.get("path") or "").strip()
                if not path:
                    continue

                meta = row.get("meta")
                code = cls._derive_menu_permission_code(path=path, meta=meta)
                if not code:
                    continue

                generated.add(code)
                updates.append((code, now, int(row["id"]), tenant_id))

            if updates:
                await conn.executemany(
                    """
                    UPDATE core_menus
                    SET permission_code = $1, updated_at = $2
                    WHERE id = $3
                      AND tenant_id = $4
                      AND (permission_code IS NULL OR permission_code = '')
                    """,
                    updates,
                )

            return generated
        finally:
            await conn.close()

    @staticmethod
    def _derive_data_scope_permissions(function_codes: set[str]) -> set[str]:
        """
        从查看类功能权限派生数据范围权限，解决“数据权限列表为空”问题。
        例如：sales_order:view -> sales_order:data:all/department/self
        """
        data_codes: set[str] = set()
        read_actions = {"read", "view", "list", "query"}
        for code in function_codes:
            if ":" not in code:
                continue
            left, action = code.rsplit(":", 1)
            if action.lower() not in read_actions:
                continue
            data_codes.add(f"{left}:data:all")
            data_codes.add(f"{left}:data:department")
            data_codes.add(f"{left}:data:self")
        return data_codes

    @staticmethod
    def _load_manifest_permissions() -> set[str]:
        codes: set[str] = set()
        apps_dir = PermissionSyncService._get_apps_dir()
        if not apps_dir.exists():
            return codes

        for manifest_file in apps_dir.glob("*/manifest.json"):
            try:
                data = json.loads(manifest_file.read_text(encoding="utf-8"))
            except Exception:
                continue

            for code in data.get("permissions", []) or []:
                if isinstance(code, str) and code.strip():
                    codes.add(code.strip())

            # 兼容从 menu_config 递归提取 permission 字段
            menu_cfg = data.get("menu_config")
            if isinstance(menu_cfg, dict):
                PermissionSyncService._collect_menu_permissions(menu_cfg, codes)

        return codes

    @staticmethod
    def _collect_menu_permissions(node: dict[str, Any], out: set[str]) -> None:
        code = node.get("permission_code") or node.get("permission")
        if isinstance(code, str) and code.strip():
            out.add(code.strip())

        children = node.get("children") or []
        if isinstance(children, list):
            for child in children:
                if isinstance(child, dict):
                    PermissionSyncService._collect_menu_permissions(child, out)

    @staticmethod
    def _derive_menu_permission_code(path: str, meta: Any) -> str | None:
        app_code = PermissionSyncService._extract_app_code(path)
        if not app_code:
            return None

        node_code = PermissionSyncService._extract_node_code(meta)
        if node_code:
            return f"{app_code}:{node_code}:view"

        leaf = path.rstrip("/").split("/")[-1].strip().lower()
        if not leaf or leaf.startswith(":"):
            return None
        resource = re.sub(r"[^a-z0-9\\-]+", "-", leaf).strip("-")
        if not resource:
            return None
        return f"{app_code}:{resource}:view"

    @staticmethod
    def _extract_app_code(path: str) -> str | None:
        parts = [p for p in path.strip().split("/") if p]
        if len(parts) >= 2 and parts[0] == "apps":
            return parts[1]
        return None

    @staticmethod
    def _extract_node_code(meta: Any) -> str | None:
        meta_obj: dict[str, Any] | None = None
        if isinstance(meta, dict):
            meta_obj = meta
        elif isinstance(meta, str):
            try:
                parsed = json.loads(meta)
                if isinstance(parsed, dict):
                    meta_obj = parsed
            except Exception:
                return None
        if not meta_obj:
            return None
        node = meta_obj.get("node")
        if not isinstance(node, str):
            return None
        clean = re.sub(r"[^a-zA-Z0-9_\\-]+", "", node).strip("_-").lower()
        return clean or None

    @staticmethod
    def _get_apps_dir() -> Path:
        # riveredge-backend/src/core/services/authorization -> riveredge-backend -> project root
        backend_root = Path(__file__).resolve().parents[4]
        project_root = backend_root.parent
        return project_root / "riveredge-frontend" / "src" / "apps"

    @staticmethod
    def _split_code(code: str) -> tuple[str, str]:
        if ":" in code:
            left, action = code.rsplit(":", 1)
            resource = left.replace("-", "_").replace(":", "_")
            return resource, action.replace("-", "_")
        return code.replace("-", "_"), "read"

    @staticmethod
    def _infer_permission_type(code: str) -> str:
        lower = code.lower()
        if lower.endswith(":amount") or ":view:amount" in lower:
            return "field"
        if ":data:" in lower or ":scope:" in lower or lower.endswith(":scope"):
            return "data"
        return "function"

    @staticmethod
    def _build_permission_name(resource: str, action: str, permission_type: str) -> str:
        action_text = {
            "create": "创建",
            "read": "查看",
            "view": "查看",
            "update": "编辑",
            "delete": "删除",
            "assign": "分配",
            "approve": "审批",
            "export": "导出",
            "import": "导入",
        }.get(action.lower(), action)
        type_text = {"function": "功能", "data": "数据", "field": "字段"}.get(permission_type, "权限")
        return f"{action_text}{resource}（{type_text}）"
