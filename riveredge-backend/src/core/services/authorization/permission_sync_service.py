"""权限治理同步服务。"""

from __future__ import annotations

import time
from datetime import timedelta

import asyncpg

from core.timezone_utils import now_utc
from typing import Any
from uuid import uuid4

from loguru import logger
from infra.infrastructure.database.database import get_db_connection
from core.config.permission_action_spec import canonical_action, is_standard_action
from core.services.authorization.permission_registry_service import PermissionRegistryService


class PermissionSyncService:
    """按租户执行收敛式权限同步（新增、更新、废弃、归并、清理）。"""

    _last_sync_ts: dict[int, float] = {}
    _last_run_stats: dict[int, dict[str, int]] = {}
    _sync_interval_seconds = 300

    _UPSERT_PERMISSION_SQL = """
                        INSERT INTO core_permissions
                        (uuid, tenant_id, name, code, resource, action, description, permission_type,
                         is_managed, source_type, source_app, source_path, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                        ON CONFLICT (tenant_id, code)
                        DO UPDATE SET
                            name = EXCLUDED.name,
                            resource = EXCLUDED.resource,
                            action = EXCLUDED.action,
                            description = EXCLUDED.description,
                            permission_type = EXCLUDED.permission_type,
                            is_managed = TRUE,
                            source_type = EXCLUDED.source_type,
                            source_app = EXCLUDED.source_app,
                            source_path = EXCLUDED.source_path,
                            deleted_at = NULL,
                            deprecated_at = NULL,
                            updated_at = EXCLUDED.updated_at
                        """

    @staticmethod
    def _dedupe_create_rows_by_code(create_rows: list[tuple[Any, ...]]) -> list[tuple[Any, ...]]:
        """同一批 upsert 中若出现重复 code，PostgreSQL 会报 unique violation，按 code 保留最后一行。"""
        by_code: dict[str, tuple[Any, ...]] = {}
        for row in create_rows:
            if len(row) < 4:
                continue
            by_code[str(row[3])] = row
        return [by_code[k] for k in sorted(by_code.keys())]

    @classmethod
    async def _upsert_create_rows(
        cls,
        conn: Any,
        create_rows: list[tuple[Any, ...]],
        *,
        tenant_id: int | None = None,
        desired_codes: set[str] | None = None,
    ) -> None:
        if not create_rows:
            return
        rows = cls._dedupe_create_rows_by_code(create_rows)
        try:
            await conn.executemany(cls._UPSERT_PERMISSION_SQL, rows)
        except asyncpg.exceptions.UniqueViolationError as e:
            logger.warning(
                "core_permissions 批量 upsert 触发唯一冲突，将逐行重试: {}",
                e,
            )
            for row in rows:
                try:
                    await conn.execute(cls._UPSERT_PERMISSION_SQL, *row)
                except asyncpg.exceptions.UniqueViolationError as row_exc:
                    code_hint = row[3] if len(row) > 3 else "?"
                    logger.warning(
                        "单条 upsert 仍冲突 code={}，尝试合并同租户重复权限行后再写入一次",
                        code_hint,
                    )
                    if tenant_id is not None and desired_codes is not None:
                        merged = await cls._merge_duplicate_permissions(
                            conn=conn,
                            tenant_id=tenant_id,
                            desired_codes=desired_codes,
                        )
                        if merged > 0:
                            try:
                                await conn.execute(cls._UPSERT_PERMISSION_SQL, *row)
                                continue
                            except asyncpg.exceptions.UniqueViolationError:
                                pass
                    logger.exception(
                        "core_permissions 单条 upsert 最终失败 code={} detail={}",
                        code_hint,
                        row_exc,
                    )
                    raise row_exc

    @classmethod
    async def ensure_permissions(
        cls,
        tenant_id: int,
        force: bool = False,
        dry_run: bool = False,
        prune: bool = True,
    ) -> dict[str, int]:
        now = time.time()
        dry_run = dry_run or cls._is_dry_run_forced()

        conn_repair = await get_db_connection()
        try:
            type_repaired = await cls._repair_permission_types(conn_repair, tenant_id=tenant_id)
        finally:
            await conn_repair.close()

        if not force and not dry_run:
            last_ts = cls._last_sync_ts.get(tenant_id, 0)
            if now - last_ts < cls._sync_interval_seconds:
                return {
                    "created": 0,
                    "updated": 0,
                    "deprecated": 0,
                    "purged": 0,
                    "merged": 0,
                    "orphaned": 0,
                    "scanned": 0,
                    "type_repaired": type_repaired,
                    "dry_run": 1 if dry_run else 0,
                }

        desired_definitions = await PermissionRegistryService.collect_definitions(tenant_id=tenant_id)
        desired_codes = set(desired_definitions.keys())
        if not desired_codes:
            cls._last_sync_ts[tenant_id] = now
            return {
                "created": 0,
                "updated": 0,
                "deprecated": 0,
                "purged": 0,
                "merged": 0,
                "orphaned": 0,
                "scanned": 0,
                "type_repaired": type_repaired,
                "dry_run": 1 if dry_run else 0,
            }

        conn = await get_db_connection()
        try:
            app_rows = await conn.fetch(
                """
                SELECT code, is_installed, is_active
                FROM core_applications
                WHERE tenant_id = $1
                  AND deleted_at IS NULL
                """,
                tenant_id,
            )
            all_app_codes = {str(r["code"]).strip() for r in app_rows if str(r["code"]).strip()}
            enabled_app_codes = {
                str(r["code"]).strip()
                for r in app_rows
                if str(r["code"]).strip() and bool(r["is_installed"]) and bool(r["is_active"])
            }

            # 先合并同租户下「规范化后相同」的重复权限行，再拉取 existing；避免后续 INSERT 与脏数据竞态
            merged_count = 0
            if not dry_run:
                merged_count = await cls._merge_duplicate_permissions(
                    conn=conn,
                    tenant_id=tenant_id,
                    desired_codes=desired_codes,
                )

            existing_rows = await conn.fetch(
                """
                SELECT id, code, name, permission_type, is_managed, deprecated_at, source_type, source_app, source_path
                FROM core_permissions
                WHERE tenant_id = $1 AND deleted_at IS NULL
                """,
                tenant_id,
            )
            existing_by_code = {str(r["code"]): r for r in existing_rows}

            create_rows: list[tuple[Any, ...]] = []
            update_rows: list[tuple[Any, ...]] = []
            orphaned_codes: set[str] = set()
            now_dt = now_utc()

            for code in sorted(desired_codes):
                spec = desired_definitions[code]
                resource, action = cls._split_code(code)
                permission_type = cls._infer_permission_type(code)
                desired_name = cls._build_permission_name(resource, action, permission_type)
                existing = existing_by_code.get(code)
                if not existing:
                    create_rows.append(
                        (
                            str(uuid4()),
                            tenant_id,
                            desired_name,
                            code,
                            resource[:50],
                            action[:50],
                            f"自动同步权限: {code}",
                            permission_type,
                            True,
                            spec.source_type,
                            spec.source_app,
                            spec.source_path,
                            now_dt,
                            now_dt,
                        )
                    )
                    continue
                if (
                    str(existing["name"]) != desired_name
                    or str(existing["permission_type"]) != permission_type
                    or existing.get("deprecated_at") is not None
                    or str(existing.get("source_type") or "") != str(spec.source_type or "")
                    or str(existing.get("source_app") or "") != str(spec.source_app or "")
                    or str(existing.get("source_path") or "") != str(spec.source_path or "")
                ):
                    update_rows.append(
                        (
                            desired_name,
                            permission_type,
                            spec.source_type,
                            spec.source_app,
                            spec.source_path,
                            now_dt,
                            int(existing["id"]),
                            tenant_id,
                        )
                    )

            deprecated_rows: list[tuple[Any, ...]] = []
            for row in existing_rows:
                code = str(row["code"])
                if code in desired_codes:
                    continue
                if cls._is_dormant_app_permission(
                    code=code,
                    all_app_codes=all_app_codes,
                    enabled_app_codes=enabled_app_codes,
                ):
                    # 未启用应用的权限属于休眠数据，不视为脏数据，不进入废弃/清理。
                    continue
                # 历史遗留的非托管权限（is_managed=false）若属于已安装应用且不在真源定义中，
                # 同样纳入治理，避免长期残留为“未挂载权限”。
                if row.get("is_managed") is False:
                    prefix = code.split(":", 1)[0] if ":" in code else ""
                    if prefix not in all_app_codes:
                        # 非应用前缀的人工权限暂不自动处置，避免误伤系统外接场景。
                        continue
                orphaned_codes.add(code)
                if row.get("deprecated_at") is None:
                    deprecated_rows.append((now_dt, now_dt, int(row["id"]), tenant_id))

            if not dry_run:
                if create_rows:
                    await cls._upsert_create_rows(
                        conn,
                        create_rows,
                        tenant_id=tenant_id,
                        desired_codes=desired_codes,
                    )
                if update_rows:
                    await conn.executemany(
                        """
                        UPDATE core_permissions
                        SET name = $1,
                            permission_type = $2,
                            source_type = $3,
                            source_app = $4,
                            source_path = $5,
                            deprecated_at = NULL,
                            updated_at = $6
                        WHERE id = $7 AND tenant_id = $8
                        """,
                        update_rows,
                    )
                if deprecated_rows:
                    await conn.executemany(
                        """
                        UPDATE core_permissions
                        SET deprecated_at = $1,
                            updated_at = $2
                        WHERE id = $3
                          AND tenant_id = $4
                          AND deleted_at IS NULL
                        """,
                        deprecated_rows,
                    )

            purged = 0
            if prune:
                purge_days = cls._get_auto_purge_days()
                purge_before = now_dt - timedelta(days=purge_days)
                purge_count_row = await conn.fetchrow(
                    """
                    SELECT COUNT(*) AS c
                    FROM core_permissions p
                    WHERE p.tenant_id = $1
                      AND p.deleted_at IS NULL
                      AND p.deprecated_at IS NOT NULL
                      AND p.deprecated_at < $2
                      AND NOT EXISTS (
                        SELECT 1
                        FROM core_role_permissions rp
                        WHERE rp.permission_id = p.id
                      )
                    """,
                    tenant_id,
                    purge_before,
                )
                purged = int((purge_count_row or {}).get("c") or 0)
                if purged and not dry_run:
                    await conn.execute(
                        """
                        UPDATE core_permissions
                        SET deleted_at = $2, updated_at = $2
                        WHERE tenant_id = $1
                          AND deleted_at IS NULL
                          AND deprecated_at IS NOT NULL
                          AND deprecated_at < $3
                          AND NOT EXISTS (
                            SELECT 1
                            FROM core_role_permissions rp
                            WHERE rp.permission_id = core_permissions.id
                          )
                        """,
                        tenant_id,
                        now_dt,
                        purge_before,
                    )

            cls._last_sync_ts[tenant_id] = now
            result = {
                "created": len(create_rows),
                "updated": len(update_rows),
                "deprecated": len(deprecated_rows),
                "purged": purged,
                "merged": merged_count,
                "orphaned": len(orphaned_codes),
                "scanned": len(desired_codes),
                "type_repaired": type_repaired,
                "dry_run": 1 if dry_run else 0,
            }
            cls._last_run_stats[tenant_id] = result
            logger.info(
                "权限治理同步完成 tenant_id={} result={}",
                tenant_id,
                result,
            )
            return result
        finally:
            await conn.close()

    @classmethod
    async def _merge_duplicate_permissions(
        cls,
        conn,
        tenant_id: int,
        desired_codes: set[str],
    ) -> int:
        rows = await conn.fetch(
            """
            SELECT id, code
            FROM core_permissions
            WHERE tenant_id = $1 AND deleted_at IS NULL
            """,
            tenant_id,
        )
        groups: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            canonical = cls.normalize_code(str(row["code"]))
            groups.setdefault(canonical, []).append(dict(row))

        merged = 0
        now = now_utc()
        for canonical, entries in groups.items():
            if len(entries) <= 1:
                continue
            keep = cls._pick_keeper(entries, desired_codes)
            for entry in entries:
                if entry["id"] == keep["id"]:
                    continue
                old_code = str(entry["code"])
                await cls._migrate_role_permissions(
                    conn=conn,
                    tenant_id=tenant_id,
                    from_permission_id=int(entry["id"]),
                    to_permission_id=int(keep["id"]),
                )
                await conn.execute(
                    """
                    INSERT INTO core_permission_aliases
                    (uuid, tenant_id, old_code, canonical_code, reason, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $6)
                    ON CONFLICT (tenant_id, old_code)
                    DO UPDATE SET
                        canonical_code = EXCLUDED.canonical_code,
                        reason = EXCLUDED.reason,
                        deleted_at = NULL,
                        updated_at = EXCLUDED.updated_at
                    """,
                    str(uuid4()),
                    tenant_id,
                    old_code,
                    str(keep["code"]),
                    "duplicate-merge",
                    now,
                )
                await conn.execute(
                    """
                    UPDATE core_permissions
                    SET deprecated_at = $1, deleted_at = $1, updated_at = $1
                    WHERE id = $2 AND tenant_id = $3
                    """,
                    now,
                    int(entry["id"]),
                    tenant_id,
                )
                merged += 1
        return merged

    @staticmethod
    async def _migrate_role_permissions(conn, tenant_id: int, from_permission_id: int, to_permission_id: int) -> None:
        await conn.execute(
            """
            INSERT INTO core_role_permissions (role_id, permission_id, created_at)
            SELECT rp.role_id, $2, rp.created_at
            FROM core_role_permissions rp
            WHERE rp.permission_id = $1
              AND NOT EXISTS (
                SELECT 1
                FROM core_role_permissions rp2
                WHERE rp2.role_id = rp.role_id
                  AND rp2.permission_id = $2
              )
            """,
            from_permission_id,
            to_permission_id,
        )
        await conn.execute(
            "DELETE FROM core_role_permissions WHERE permission_id = $1",
            from_permission_id,
        )

    @staticmethod
    def _pick_keeper(entries: list[dict[str, Any]], desired_codes: set[str]) -> dict[str, Any]:
        preferred = [e for e in entries if str(e["code"]) in desired_codes]
        candidates = preferred or entries
        return sorted(candidates, key=lambda x: int(x["id"]))[0]

    @staticmethod
    def normalize_code(code: str) -> str:
        cleaned = code.strip().lower().replace("_", "-")
        parts = [p for p in cleaned.split(":") if p]
        if len(parts) < 2:
            return cleaned
        parts[-1] = canonical_action(parts[-1])
        return ":".join(parts)

    @staticmethod
    def _get_auto_purge_days() -> int:
        import os

        raw = os.getenv("PERMISSION_AUTO_PURGE_DAYS", "14").strip()
        try:
            days = int(raw)
        except ValueError:
            return 14
        return max(days, 1)

    @staticmethod
    def _is_dry_run_forced() -> bool:
        import os

        return os.getenv("PERMISSION_GOVERNANCE_DRY_RUN", "false").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

    @staticmethod
    def _is_dormant_app_permission(code: str, all_app_codes: set[str], enabled_app_codes: set[str]) -> bool:
        prefix = code.split(":", 1)[0] if ":" in code else code
        return prefix in all_app_codes and prefix not in enabled_app_codes

    @staticmethod
    def _split_code(code: str) -> tuple[str, str]:
        if ":" in code:
            left, action = code.rsplit(":", 1)
            resource = left.replace("-", "_").replace(":", "_")
            return resource, canonical_action(action).replace("-", "_")
        return code.replace("-", "_"), "read"

    @staticmethod
    def _infer_permission_type(code: str) -> str:
        lower = code.lower()
        # 金额/单价类字段权限（含快制造统一价格可见）
        if lower.endswith(":pricing:view") or lower.endswith(":amount") or ":view:amount" in lower:
            return "field"
        if ":data:" in lower or ":scope:" in lower or lower.endswith(":scope"):
            return "data"
        return "function"

    @classmethod
    async def _repair_permission_types(cls, conn, tenant_id: int) -> int:
        """将已有 core_permissions 行的 permission_type 与 _infer 对齐（修复历史错标）。"""
        rows = await conn.fetch(
            """
            SELECT id, code, permission_type
            FROM core_permissions
            WHERE tenant_id = $1 AND deleted_at IS NULL
            """,
            tenant_id,
        )
        if not rows:
            return 0
        now = now_utc()
        fixed = 0
        for r in rows:
            code = str(r["code"])
            inferred = cls._infer_permission_type(code)
            if inferred == str(r["permission_type"]):
                continue
            await conn.execute(
                """
                UPDATE core_permissions
                SET permission_type = $1, updated_at = $2
                WHERE id = $3 AND tenant_id = $4
                """,
                inferred,
                now,
                int(r["id"]),
                tenant_id,
            )
            fixed += 1
        return fixed

    @classmethod
    async def get_governance_report(cls, tenant_id: int) -> dict[str, Any]:
        desired = await PermissionRegistryService.collect_definitions(tenant_id=tenant_id)
        desired_codes = set(desired.keys())
        purge_days = cls._get_auto_purge_days()
        purge_before = now_utc() - timedelta(days=purge_days)
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT id, code, deprecated_at
                FROM core_permissions
                WHERE tenant_id = $1
                  AND deleted_at IS NULL
                """,
                tenant_id,
            )
            active_codes = {str(r["code"]) for r in rows}
            orphaned = sorted(code for code in active_codes if code not in desired_codes)

            groups: dict[str, list[str]] = {}
            for row in rows:
                code = str(row["code"])
                groups.setdefault(cls.normalize_code(code), []).append(code)
            duplicate_groups = [sorted(v) for v in groups.values() if len(v) > 1]
            duplicate_merge_plan = await cls.get_duplicate_merge_plan(tenant_id=tenant_id, limit=200)

            deprecated_count = sum(1 for r in rows if r.get("deprecated_at") is not None)
            purge_rows = await conn.fetch(
                """
                SELECT code
                FROM core_permissions p
                WHERE p.tenant_id = $1
                  AND p.deleted_at IS NULL
                  AND p.deprecated_at IS NOT NULL
                  AND p.deprecated_at < $2
                  AND NOT EXISTS (
                    SELECT 1
                    FROM core_role_permissions rp
                    WHERE rp.permission_id = p.id
                  )
                ORDER BY code ASC
                LIMIT 200
                """,
                tenant_id,
                purge_before,
            )
            purge_count_row = await conn.fetchrow(
                """
                SELECT COUNT(*) AS c
                FROM core_permissions p
                WHERE p.tenant_id = $1
                  AND p.deleted_at IS NULL
                  AND p.deprecated_at IS NOT NULL
                  AND p.deprecated_at < $2
                  AND NOT EXISTS (
                    SELECT 1
                    FROM core_role_permissions rp
                    WHERE rp.permission_id = p.id
                  )
                """,
                tenant_id,
                purge_before,
            )
            purge_candidates = [str(r["code"]) for r in purge_rows]
            return {
                "desired_total": len(desired_codes),
                "active_total": len(rows),
                "orphaned_total": len(orphaned),
                "deprecated_total": deprecated_count,
                "pending_purge_total": int((purge_count_row or {}).get("c") or 0),
                "pending_purge_codes": purge_candidates,
                "auto_purge_days": purge_days,
                "duplicate_group_total": len(duplicate_groups),
                "orphaned_codes": orphaned[:200],
                "duplicate_groups": duplicate_groups[:100],
                "duplicate_merge_plan": duplicate_merge_plan,
                "last_sync": cls._last_run_stats.get(tenant_id, {}),
            }
        finally:
            await conn.close()

    @classmethod
    async def get_duplicate_merge_plan(cls, tenant_id: int, limit: int = 200) -> list[dict[str, Any]]:
        desired = await PermissionRegistryService.collect_definitions(tenant_id=tenant_id)
        desired_codes = set(desired.keys())
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT id, code
                FROM core_permissions
                WHERE tenant_id = $1
                  AND deleted_at IS NULL
                ORDER BY id ASC
                """,
                tenant_id,
            )
            groups: dict[str, list[dict[str, Any]]] = {}
            for row in rows:
                code = str(row["code"])
                canonical = cls.normalize_code(code)
                groups.setdefault(canonical, []).append(
                    {
                        "id": int(row["id"]),
                        "code": code,
                    }
                )

            plans: list[dict[str, Any]] = []
            for canonical, entries in groups.items():
                if len(entries) <= 1:
                    continue
                keeper = cls._pick_keeper(entries, desired_codes)
                merge_items = []
                for entry in entries:
                    if entry["id"] == keeper["id"]:
                        continue
                    merge_items.append(
                        {
                            "from_permission_id": int(entry["id"]),
                            "from_code": str(entry["code"]),
                            "to_permission_id": int(keeper["id"]),
                            "to_code": str(keeper["code"]),
                        }
                    )
                if merge_items:
                    plans.append(
                        {
                            "canonical_code": canonical,
                            "keeper_permission_id": int(keeper["id"]),
                            "keeper_code": str(keeper["code"]),
                            "merge_count": len(merge_items),
                            "items": merge_items,
                        }
                    )
            plans.sort(key=lambda x: int(x["merge_count"]), reverse=True)
            return plans[: max(limit, 1)]
        finally:
            await conn.close()

    @classmethod
    async def sync_all_active_tenants(
        cls,
        dry_run: bool = False,
        prune: bool = True,
    ) -> dict[str, Any]:
        conn = await get_db_connection()
        try:
            tenant_rows = await conn.fetch(
                """
                SELECT id
                FROM infra_tenants
                WHERE status = 'active'
                ORDER BY id ASC
                """
            )
        finally:
            await conn.close()

        results: list[dict[str, Any]] = []
        total = {
            "tenant_count": len(tenant_rows),
            "created": 0,
            "updated": 0,
            "deprecated": 0,
            "purged": 0,
            "merged": 0,
            "orphaned": 0,
            "scanned": 0,
            "type_repaired": 0,
            "failed": 0,
            "dry_run": 1 if dry_run else 0,
        }
        for row in tenant_rows:
            tenant_id = int(row["id"])
            try:
                result = await cls.ensure_permissions(
                    tenant_id=tenant_id,
                    force=True,
                    dry_run=dry_run,
                    prune=prune,
                )
                for k in ("created", "updated", "deprecated", "purged", "merged", "orphaned", "scanned", "type_repaired"):
                    total[k] += int(result.get(k, 0))
                results.append({"tenant_id": tenant_id, "ok": True, "result": result})
            except Exception as exc:
                total["failed"] += 1
                logger.exception("租户权限治理失败 tenant_id={}", tenant_id)
                results.append({"tenant_id": tenant_id, "ok": False, "error": str(exc)})

        summary = {"summary": total, "tenants": results}
        logger.info("全租户权限治理完成 summary={}", total)
        return summary

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
            "audit": "审核",
            "submit": "提交",
            "export": "导出",
            "import": "导入",
            "print": "打印",
            "execute": "执行",
            "reject": "驳回",
            "revoke": "撤销",
        }.get(action.lower(), action)
        type_text = {"function": "功能", "data": "数据", "field": "字段"}.get(permission_type, "权限")
        return f"{action_text}{resource}（{type_text}）"

    @staticmethod
    def is_standard_function_permission_code(code: str) -> bool:
        normalized = PermissionSyncService.normalize_code(code)
        if ":" not in normalized:
            return False
        action = normalized.rsplit(":", 1)[-1]
        return is_standard_action(action)
