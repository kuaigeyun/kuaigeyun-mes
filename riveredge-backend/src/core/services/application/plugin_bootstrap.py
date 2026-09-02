"""应用 bootstrap 钩子（按应用中心启用状态执行）。"""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import FrozenSet, Optional

from loguru import logger

_APPS_ROOT = Path(__file__).resolve().parents[3] / "apps"


def register_plugin_bootstraps(enabled_app_codes: Optional[FrozenSet[str]] = None) -> None:
    """对每个已启用且带 bootstrap.py 的应用调用 register()。"""
    if not _APPS_ROOT.is_dir():
        return
    for bootstrap_path in sorted(_APPS_ROOT.glob("*/bootstrap.py")):
        package_name = bootstrap_path.parent.name
        if enabled_app_codes is not None:
            app_code = package_name.replace("_", "-")
            if app_code not in enabled_app_codes:
                continue
        module_name = f"apps.{package_name}.bootstrap"
        mod = importlib.import_module(module_name)
        register = getattr(mod, "register", None)
        if not callable(register):
            raise RuntimeError(f"{module_name} 必须定义 register()")
        register()
        logger.debug(f"bootstrap 已执行: {package_name}")
