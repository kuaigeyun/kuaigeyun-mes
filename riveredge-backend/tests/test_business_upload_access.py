"""业务附件 category 与 manifest 模块权限对齐（勿依赖 system:file）。"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from core.services.file.business_upload_access import (
    BUSINESS_FILE_UPLOAD_PERMISSIONS,
    business_upload_permission_codes,
)

REPO = Path(__file__).resolve().parents[2]
HAOLIGO_FRONTEND = REPO / "riveredge-frontend" / "src" / "apps" / "haoligo"
CATEGORY_IN_UPLOAD = re.compile(r"category:\s*['\"]([a-z0-9_]+)['\"]")


def _haoligo_upload_categories() -> set[str]:
    found: set[str] = set()
    for path in HAOLIGO_FRONTEND.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        found.update(CATEGORY_IN_UPLOAD.findall(text))
    return found


def test_haoligo_upload_categories_registered() -> None:
    used = _haoligo_upload_categories()
    assert used, "应扫描到 haoligo 上传 category"
    missing = sorted(used - set(BUSINESS_FILE_UPLOAD_PERMISSIONS.keys()))
    assert not missing, f"未在 business_upload_access 登记: {missing}"


@pytest.mark.parametrize("category", sorted(BUSINESS_FILE_UPLOAD_PERMISSIONS.keys()))
def test_business_upload_maps_to_manifest_actions(category: str) -> None:
    codes = business_upload_permission_codes(category)
    assert codes
    for code in codes:
        assert code.count(":") >= 2, f"须为 app:module:action: {code!r}"
        assert not code.startswith("system:file"), "业务上传不得映射 system:file"
