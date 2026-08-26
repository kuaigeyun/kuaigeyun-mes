#!/usr/bin/env python3
"""开发环境 API：带安全 reload exclude 的 uvicorn 入口（Windows / Bash 通用）。"""

from __future__ import annotations

import os
import sys

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SRC = os.path.join(_BACKEND_ROOT, "src")
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

import uvicorn

from infra.config.infra_config import infra_settings
from server.dev_reload import uvicorn_dev_reload_kwargs


def _resolve_host() -> str:
    return (os.environ.get("HOST") or infra_settings.HOST or "0.0.0.0").strip()


def _resolve_port() -> int:
    raw = os.environ.get("PORT") or infra_settings.PORT or 8200
    return int(raw)


if __name__ == "__main__":
    uvicorn.run(
        "server.main:app",
        host=_resolve_host(),
        port=_resolve_port(),
        **uvicorn_dev_reload_kwargs(),
    )
