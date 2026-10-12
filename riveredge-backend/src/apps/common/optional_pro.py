"""可选专业包导入（开源主仓无 compose 时不得在宿主模块顶层硬 import pro 应用）。"""

from __future__ import annotations

import importlib
import importlib.util
from types import ModuleType
from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

_PRO_APPS = frozenset({"kuaicaiwu", "kuaiplm", "kuaioa", "kuaipd"})


def pro_app_available(app_code: str) -> bool:
    """专业包应用源码是否可导入（compose / 安装后为 True）。"""
    mod = (app_code or "").strip().replace("-", "_")
    if not mod:
        return False
    return importlib.util.find_spec(f"apps.{mod}") is not None


def import_pro_module(module_path: str) -> ModuleType:
    """
    导入专业包模块。
    缺失时抛 BusinessLogicError（明确能力缺口），禁止静默降级为假实现。
    """
    path = (module_path or "").strip()
    if not path.startswith("apps."):
        raise ValueError(f"invalid pro module path: {module_path!r}")
    parts = path.split(".")
    app = parts[1] if len(parts) > 1 else ""
    if app not in _PRO_APPS:
        raise ValueError(f"not a known pro app module: {module_path!r}")
    try:
        return importlib.import_module(path)
    except ImportError as exc:
        raise BusinessLogicError(
            f"当前环境未安装专业包应用「{app}」，无法使用该功能。请通过扩展应用/compose 安装后再试。"
        ) from exc


def import_pro_attr(module_path: str, attr: str) -> Any:
    mod = import_pro_module(module_path)
    try:
        return getattr(mod, attr)
    except AttributeError as exc:
        raise BusinessLogicError(
            f"专业包模块 {module_path} 缺少符号 {attr}"
        ) from exc


def try_import_pro_module(module_path: str) -> Optional[ModuleType]:
    """仅用于「无专业包则跳过该分支」的只读探测；不得用于掩盖业务错误。"""
    path = (module_path or "").strip()
    parts = path.split(".")
    app = parts[1] if len(parts) > 1 else ""
    if app not in _PRO_APPS or not pro_app_available(app):
        return None
    try:
        return importlib.import_module(path)
    except ImportError:
        return None
