"""可选应用 ORM 发现（仅依赖 apps/*/orm_models.py，禁止依赖 core）。

放在 infra 层，避免 database 冷启动时经 core.services 形成循环导入。
"""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import FrozenSet, List, Optional

from loguru import logger

_APPS_ROOT = Path(__file__).resolve().parents[3] / "apps"


def discover_plugin_orm_modules(
    enabled_app_codes: Optional[FrozenSet[str]] = None,
) -> List[str]:
    """扫描 orm_models.py，返回 Tortoise 模型模块路径。

    enabled_app_codes 为 None 时加载全部（aerich 静态 TORTOISE_ORM 合并用）；
    否则仅加载启用集对应的应用包。
    """
    found: List[str] = []
    if not _APPS_ROOT.is_dir():
        return found
    for orm_path in sorted(_APPS_ROOT.glob("*/orm_models.py")):
        package_name = orm_path.parent.name
        if enabled_app_codes is not None:
            app_code = package_name.replace("_", "-")
            if app_code not in enabled_app_codes:
                continue
        module_name = f"apps.{package_name}.orm_models"
        try:
            mod = importlib.import_module(module_name)
        except Exception as exc:
            logger.error(f"加载 {module_name} 失败: {exc}")
            raise
        modules = getattr(mod, "ORM_MODEL_MODULES", None)
        if not isinstance(modules, list):
            raise RuntimeError(f"{module_name} 必须定义 ORM_MODEL_MODULES: list[str]")
        for item in modules:
            if not isinstance(item, str) or not item.strip():
                raise RuntimeError(f"{module_name}.ORM_MODEL_MODULES 含非法项: {item!r}")
            found.append(item.strip())
    return found
