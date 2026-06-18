"""
Taskiq Worker 侧事件处理器注册（按数据库已安装应用懒加载）。

API 进程不导入应用 workflow，避免与 Uvicorn 重复占用内存；
Worker 在 Tortoise 初始化后调用 ``bootstrap_worker_event_handlers``。
"""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import Iterable, List, Set

from loguru import logger

_BOOTSTRAPPED = False

_PLACEHOLDER_APP_CODES: Set[str] = {"kuaicrm", "kuaipdm", "kuaichain", "kuaiiot"}

# 已知 workflow 包（其余应用按约定路径探测）
_KNOWN_WORKFLOW_PACKAGES: dict[str, str] = {
    "kuaizhizao": "apps.kuaizhizao.workflows.functions",
}


def _src_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _workflow_package_exists(package: str) -> bool:
    rel = package.replace(".", "/")
    init_py = _src_root() / rel / "__init__.py"
    return init_py.is_file()


async def _installed_active_app_codes() -> List[str]:
    from infra.infrastructure.database.database import get_db_connection

    conn = await get_db_connection()
    try:
        tenant_row = await conn.fetchrow(
            "SELECT id FROM infra_tenants WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1"
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
            ORDER BY code
            """,
            tenant_id,
        )
        return [
            row["code"]
            for row in rows
            if row["code"] and row["code"] not in _PLACEHOLDER_APP_CODES
        ]
    finally:
        await conn.close()


def _workflow_package_for_app(app_code: str) -> str:
    if app_code in _KNOWN_WORKFLOW_PACKAGES:
        return _KNOWN_WORKFLOW_PACKAGES[app_code]
    module_code = app_code.replace("-", "_")
    return f"apps.{module_code}.workflows.functions"


def import_workflow_handlers_for_apps(app_codes: Iterable[str]) -> List[str]:
    """按应用 code 导入 workflow 包（注册 Inngest/dispatcher 处理器）。返回已成功加载的包路径。"""
    loaded: List[str] = []
    for app_code in app_codes:
        if not app_code or app_code in _PLACEHOLDER_APP_CODES:
            continue
        package = _workflow_package_for_app(app_code)
        if not _workflow_package_exists(package):
            continue
        try:
            importlib.import_module(package)
            loaded.append(package)
            logger.info("已加载应用 workflow 事件处理器: {} ({})", package, app_code)
        except Exception as e:
            logger.error("加载应用 workflow 失败 {} ({}): {}", package, app_code, e)
    return loaded


async def bootstrap_worker_event_handlers() -> None:
    """Worker 启动时注册核心与应用事件处理器（幂等）。"""
    global _BOOTSTRAPPED
    if _BOOTSTRAPPED:
        return

    import core.workflows.functions  # noqa: F401 — 核心 workflow（消息、审批、定时任务等）

    from core.tasks.data_backup_handlers import register_data_backup_handlers

    register_data_backup_handlers()

    try:
        app_codes = await _installed_active_app_codes()
    except Exception as e:
        logger.warning("查询已安装应用失败，仅加载核心 workflow: {}", e)
        app_codes = []

    import_workflow_handlers_for_apps(app_codes)
    _BOOTSTRAPPED = True
    logger.info(
        "Worker 事件处理器注册完成（核心 + {} 个应用 workflow）",
        len(app_codes),
    )
