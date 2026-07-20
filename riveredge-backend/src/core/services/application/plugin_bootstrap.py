"""可选应用（pro/custom 组装进 src/apps）的启动钩子。

约定：``apps/<code>/bootstrap.py`` 暴露 ``register()``。
ORM 发现见 ``infra.infrastructure.database.plugin_orm``（避免与 database 循环导入）。
"""

from __future__ import annotations

import importlib
from pathlib import Path

from loguru import logger

_APPS_ROOT = Path(__file__).resolve().parents[3] / "apps"


def register_plugin_bootstraps() -> None:
    """对每个已组装且带 bootstrap.py 的应用调用 register()。"""
    if not _APPS_ROOT.is_dir():
        return
    for bootstrap_path in sorted(_APPS_ROOT.glob("*/bootstrap.py")):
        code = bootstrap_path.parent.name
        module_name = f"apps.{code}.bootstrap"
        mod = importlib.import_module(module_name)
        register = getattr(mod, "register", None)
        if not callable(register):
            raise RuntimeError(f"{module_name} 必须定义 register()")
        register()
        logger.debug(f"bootstrap 已执行: {code}")
