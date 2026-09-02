"""应用中心启用状态 — 运行时 ORM / 路由 / bootstrap 裁剪的唯一真源。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import FrozenSet

from loguru import logger

_APPS_ROOT = Path(__file__).resolve().parents[3] / "apps"
_CACHE: frozenset[str] | None = None


def clear_enabled_apps_cache() -> None:
    """进程内缓存失效（测试或热重载用）。"""
    global _CACHE
    _CACHE = None


def package_name_for_app_code(app_code: str) -> str:
    return app_code.replace("-", "_")


def app_code_for_package_name(package_name: str) -> str:
    return package_name.replace("_", "-")


def read_requires_apps_from_manifest(app_code: str) -> list[str]:
    """读取 manifest.json 的 requires_apps（应用间运行时依赖）。"""
    module = package_name_for_app_code(app_code)
    manifest_path = _APPS_ROOT / module / "manifest.json"
    if not manifest_path.is_file():
        return []
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw = data.get("requires_apps")
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def expand_requires_apps(codes: set[str]) -> set[str]:
    """按 manifest requires_apps 做依赖闭包展开。"""
    result = set(codes)
    changed = True
    while changed:
        changed = False
        for code in list(result):
            for req in read_requires_apps_from_manifest(code):
                if req not in result:
                    result.add(req)
                    changed = True
    return result


async def resolve_enabled_app_codes(*, tenant_id: int | None = None) -> frozenset[str]:
    """查询应用中心已安装且启用的应用（含 requires_apps 闭包）。失败抛错，不回落磁盘扫描。"""
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    from infra.infrastructure.database.database import get_db_connection

    conn = await get_db_connection()
    try:
        if tenant_id is None:
            tenant_row = await conn.fetchrow(
                "SELECT id FROM infra_tenants ORDER BY id ASC LIMIT 1"
            )
            tenant_id = tenant_row["id"] if tenant_row else 1

        rows = await conn.fetch(
            """
            SELECT DISTINCT code
            FROM core_applications
            WHERE is_installed = TRUE
              AND is_active = TRUE
              AND deleted_at IS NULL
              AND tenant_id = $1
            """,
            tenant_id,
        )
        codes = {str(row["code"]) for row in rows if row.get("code")}
    finally:
        await conn.close()

    if not codes:
        conn2 = await get_db_connection()
        try:
            total = await conn2.fetchval(
                "SELECT COUNT(*) FROM core_applications WHERE deleted_at IS NULL"
            )
        finally:
            await conn2.close()
        if int(total or 0) == 0:
            logger.warning("应用中心尚无记录（首次安装），运行时跳过应用 ORM / 路由")
            _CACHE = frozenset()
            return _CACHE
        raise RuntimeError(
            "应用中心无已启用应用，无法生成运行时配置。"
            "请先在应用中心安装并启用至少一个应用。"
        )

    expanded = expand_requires_apps(codes)
    _CACHE = frozenset(expanded)
    logger.info(
        "启用应用集（含 requires_apps 闭包）: {}",
        sorted(_CACHE),
    )
    return _CACHE


async def list_active_dependents(tenant_id: int, app_code: str) -> list[tuple[str, str]]:
    """返回仍启用且 manifest 声明依赖 app_code 的应用 (code, name)。"""
    from infra.infrastructure.database.database import get_db_connection

    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """
            SELECT code, name
            FROM core_applications
            WHERE tenant_id = $1
              AND is_installed = TRUE
              AND is_active = TRUE
              AND deleted_at IS NULL
              AND code <> $2
            """,
            tenant_id,
            app_code,
        )
    finally:
        await conn.close()

    dependents: list[tuple[str, str]] = []
    for row in rows:
        code = str(row["code"])
        reqs = expand_requires_apps({code})
        if app_code in reqs:
            dependents.append((code, str(row["name"] or code)))
    return dependents


def is_package_enabled(package_name: str, enabled_codes: FrozenSet[str]) -> bool:
    return app_code_for_package_name(package_name) in enabled_codes
