"""应用 code 重命名：激活别名与规范化。"""

from __future__ import annotations

from core.config.app_code_renames import (
    app_code_activation_aliases,
    canonicalize_app_code,
)


def test_canonicalize_pro_data_center_to_kuaiconnect():
    assert canonicalize_app_code("pro-data-center") == "kuaiconnect"
    assert canonicalize_app_code("kuaiconnect") == "kuaiconnect"


def test_kuaiconnect_activation_aliases_include_legacy():
    aliases = app_code_activation_aliases("kuaiconnect")
    assert aliases[0] == "kuaiconnect"
    assert "pro-data-center" in aliases
