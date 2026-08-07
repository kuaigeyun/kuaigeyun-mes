"""
PRO 应用清单（许可证适用范围唯一真源）。

与前端 proAppCatalog.ts 的 PRO_APP_CODES 保持一致。
"""

from __future__ import annotations

from typing import FrozenSet, Optional

GLOBAL_LICENSE_SCOPE = "*"

PRO_APP_CODES: FrozenSet[str] = frozenset(
    {
        "kuaiai",
        "kuaireport",
        "kuaiiot",
        "kuaiems",
        "kuaisrm",
    }
)


def normalize_license_scope(app_code: Optional[str]) -> str:
    normalized = (app_code or GLOBAL_LICENSE_SCOPE).strip()
    return normalized or GLOBAL_LICENSE_SCOPE


def is_valid_license_scope(app_code: Optional[str]) -> bool:
    normalized = normalize_license_scope(app_code)
    if normalized == GLOBAL_LICENSE_SCOPE:
        return True
    return normalized in PRO_APP_CODES
