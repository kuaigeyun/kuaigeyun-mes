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


def read_manifest_data(app_code: str) -> dict | None:
    """读取应用 manifest.json；文件不存在则返回 None。"""
    module = package_name_for_app_code(app_code)
    manifest_path = _APPS_ROOT / module / "manifest.json"
    if not manifest_path.is_file():
        return None
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return None
    return data


def read_requires_apps_from_manifest(app_code: str) -> list[str]:
    """读取 manifest.json 的 requires_apps（应用间运行时依赖）。"""
    data = read_manifest_data(app_code)
    if not data:
        return []
    raw = data.get("requires_apps")
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def manifest_hides_required_app_menus(app_code: str) -> bool:
    """定制壳声明 hide_required_app_menus 时，启用后抑制依赖应用整棵侧栏。"""
    data = read_manifest_data(app_code)
    return bool(data and data.get("hide_required_app_menus") is True)


def manifest_is_dedicated_app(app_code: str) -> bool:
    """定制应用（整合层）：requires_apps 为宿主 API/表，不阻塞宿主在应用中心单独停用。"""
    data = read_manifest_data(app_code)
    if not data:
        return False
    if data.get("is_dedicated") is True:
        return True
    return str(data.get("market_category") or "").strip().lower() == "dedicated"


def hidden_app_codes_for_dedicated_shell(
    *,
    hide: bool,
    requires: list[str],
    consumer_code: str,
) -> list[str]:
    """计算定制壳应隐藏的应用编码（含依赖闭包；行业模块时含 industry-pack）。"""
    if not hide:
        return []
    hidden = expand_requires_apps(set(requires))
    hidden.discard(consumer_code)
    from core.config.industry_pack import INDUSTRY_PACK_APP_CODE, is_industry_module_app_code

    if any(is_industry_module_app_code(code) for code in hidden):
        hidden.add(INDUSTRY_PACK_APP_CODE)
    return sorted(hidden)


def dedicated_shell_hidden_app_codes(consumer_code: str) -> list[str]:
    """读取 consumer manifest，得到应整棵隐藏的应用编码。"""
    return hidden_app_codes_for_dedicated_shell(
        hide=manifest_hides_required_app_menus(consumer_code),
        requires=read_requires_apps_from_manifest(consumer_code),
        consumer_code=consumer_code,
    )


def union_dedicated_shell_hide_codes(
    *,
    required_hidden: list[str],
    installed_codes: list[str],
    consumer_code: str,
    system_codes: set[str] | None = None,
) -> list[str]:
    """依赖闭包 ∪ 已安装非系统业务应用，不含定制壳自身。"""
    hidden = set(required_hidden)
    skip = {consumer_code, *(system_codes or set())}
    for code in installed_codes:
        if code and code not in skip:
            hidden.add(code)
    return sorted(hidden)


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
    """查询应用中心已安装且启用的应用（含 requires_apps 闭包）。失败抛错，不回落磁盘扫描。

    tenant_id 为 None（进程 ORM / 路由启动）：合并**全部租户**已启用应用，避免仅按
    第一个租户裁剪导致其它租户已启用的应用模型未注册（如 navigation-tree 查 KuaioaFormTemplate）。
    传入 tenant_id 时仅解析该租户启用集。
    """
    global _CACHE
    if tenant_id is None and _CACHE is not None:
        return _CACHE

    from infra.infrastructure.database.database import get_db_connection

    conn = await get_db_connection()
    try:
        if tenant_id is None:
            rows = await conn.fetch(
                """
                SELECT DISTINCT code
                FROM core_applications
                WHERE is_installed = TRUE
                  AND is_active = TRUE
                  AND deleted_at IS NULL
                """
            )
        else:
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
            if tenant_id is None:
                _CACHE = frozenset()
                return _CACHE
            return frozenset()
        raise RuntimeError(
            "应用中心无已启用应用，无法生成运行时配置。"
            "请先在应用中心安装并启用至少一个应用。"
        )

    expanded = expand_requires_apps(codes)
    if tenant_id is None:
        _CACHE = frozenset(expanded)
        logger.info(
            "启用应用集（全租户并集，含 requires_apps 闭包）: {}",
            sorted(_CACHE),
        )
        return _CACHE

    logger.info(
        "启用应用集（租户 {}，含 requires_apps 闭包）: {}",
        tenant_id,
        sorted(expanded),
    )
    return frozenset(expanded)


async def list_active_dependents(tenant_id: int, app_code: str) -> list[tuple[str, str]]:
    """返回仍启用且 manifest 声明依赖 app_code 的应用 (code, name)。

    定制应用（is_dedicated / market_category=dedicated）不计入：宿主可在应用中心停用，
    运行时仍由 resolve_enabled_app_codes 的 requires_apps 闭包拉起已安装宿主包。
    """
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
        if manifest_is_dedicated_app(code):
            continue
        reqs = expand_requires_apps({code})
        if app_code in reqs:
            dependents.append((code, str(row["name"] or code)))
    return dependents


def is_package_enabled(package_name: str, enabled_codes: FrozenSet[str]) -> bool:
    return app_code_for_package_name(package_name) in enabled_codes
