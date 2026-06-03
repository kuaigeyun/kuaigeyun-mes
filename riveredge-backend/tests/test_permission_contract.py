"""系统权限契约：manifest 权限码须符合 app:module:action 且 action 标准化。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from core.config.permission_contract import validate_permission_code

APPS_DIR = Path(__file__).resolve().parents[1] / "src" / "apps"


def _iter_manifest_permission_codes() -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for manifest_path in sorted(APPS_DIR.glob("*/manifest.json")):
        app_code = manifest_path.parent.name
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        for code in data.get("permissions") or []:
            if isinstance(code, str) and code.strip():
                out.append((app_code, code.strip()))
    return out


@pytest.mark.parametrize("app_code,code", _iter_manifest_permission_codes())
def test_manifest_permission_codes_match_contract(app_code: str, code: str) -> None:
    err = validate_permission_code(code)
    assert err is None, f"app={app_code} code={code!r}: {err}"


def test_manifest_permissions_discovered() -> None:
    codes = _iter_manifest_permission_codes()
    assert len(codes) >= 100, "应扫描到各应用 manifest 权限码"
