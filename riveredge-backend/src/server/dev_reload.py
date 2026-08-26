"""开发热重载配置（run_dev_server / main 唯一入口）。

uvicorn 0.30 的 WatchFilesReload 会把 cwd 整棵目录（含 migrations、scripts）
并进监视；Windows 上启动后立刻误报几十个未改动文件并杀掉 worker，前端 502。
因此 Windows 默认关闭热重载。需要时设 RIVEREDGE_DEV_RELOAD=1。
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any, Iterator

_LOG = logging.getLogger("uvicorn.error")
_SRC_DIR = Path(__file__).resolve().parents[1]
_PATCHED = False
_BURST_SKIP = 16


def _reload_enabled() -> bool:
    raw = os.environ.get("RIVEREDGE_DEV_RELOAD", "").strip().lower()
    if raw in ("1", "true", "yes"):
        return True
    if raw in ("0", "false", "no"):
        return False
    return sys.platform != "win32"


def _is_reloadable_py(path: str) -> bool:
    try:
        p = Path(path)
        if p.suffix != ".py":
            return False
        if "__pycache__" in p.parts or "tests" in p.parts:
            return False
        p.resolve().relative_to(_SRC_DIR)
        return True
    except (ValueError, OSError):
        return False


def _watch_filter(_change: object, path: str) -> bool:
    return _is_reloadable_py(path)


def _install_watchfiles_src_only() -> None:
    """同时替换 watchfiles.watch 与 uvicorn 已 import 的同名绑定。"""
    global _PATCHED
    if _PATCHED:
        return
    import watchfiles

    original_watch = watchfiles.watch
    watch_root = str(_SRC_DIR)

    def _watch(*_args: Any, **kwargs: Any) -> Iterator[Any]:
        kwargs.pop("watch_filter", None)

        def _gen() -> Iterator[Any]:
            for changes in original_watch(
                watch_root,
                watch_filter=_watch_filter,
                **kwargs,
            ):
                if changes and len(changes) > _BURST_SKIP:
                    _LOG.warning(
                        "WatchFiles 一次收到 %s 个变更（超过 %s），视为误报，不重启 worker",
                        len(changes),
                        _BURST_SKIP,
                    )
                    yield set()
                    continue
                yield changes

        return _gen()

    watchfiles.watch = _watch  # type: ignore[method-assign]
    try:
        import uvicorn.supervisors.watchfilesreload as wfr

        wfr.watch = _watch  # type: ignore[method-assign]
    except ImportError:
        pass
    _PATCHED = True
    _LOG.info("热重载实际监视: %s", watch_root)


def uvicorn_dev_reload_kwargs() -> dict[str, Any]:
    if not _reload_enabled():
        _LOG.warning(
            "开发热重载已关闭（Windows 默认，避免 WatchFiles 误杀进程）。"
            "改后端代码后请重启服务；若要打开热重载：RIVEREDGE_DEV_RELOAD=1"
        )
        return {"reload": False}
    _install_watchfiles_src_only()
    return {
        "reload": True,
        "reload_dirs": [str(_SRC_DIR)],
        "reload_includes": ["*.py"],
        "reload_excludes": [
            "**/__pycache__/**",
            "**/*.pyc",
            "**/*.pyo",
            "**/migrations/**",
            "**/tests/**",
            "**/test_*.py",
            "**/.venv/**",
        ],
        "reload_delay": 1.5,
    }
