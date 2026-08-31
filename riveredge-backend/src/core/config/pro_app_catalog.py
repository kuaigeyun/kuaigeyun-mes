"""
PRO 应用清单（许可证适用范围唯一真源）。

与前端 proAppCatalog.ts 的 PRO_APP_CODES 保持一致。
"""

from __future__ import annotations

from typing import FrozenSet, Optional

from core.config.industry_app_catalog import PRO_INDUSTRY_APP_CODES

GLOBAL_LICENSE_SCOPE = "*"

PRO_APP_CODES: FrozenSet[str] = frozenset(
    {
        "kuaiai",
        "kuaireport",
        "kuaiiot",
    }
)

# 与 manifest / 前端 proAppCatalog.ts PRO_APP_SORT_ORDER 一致（3xx 段，位于行业包 290 之后）
PRO_APP_SORT_ORDER: dict[str, int] = {
    "kuaireport": 310,
    "kuaiiot": 320,
    "kuaiai": 350,
}


def resolve_application_sort_order(
    app_code: str | None,
    manifest_sort_order: int | None,
) -> int:
    """
    应用侧栏排序唯一真源：行业包 290、行业模块 manifest、专业 APP 310–350。

    manifest 与库内 sort_order 均须经此函数，避免历史 210–250 段再次写入。
    """
    from core.config.industry_pack import INDUSTRY_PACK_APP_CODE, INDUSTRY_PACK_SORT_ORDER

    code = str(app_code or "").strip()
    if code == INDUSTRY_PACK_APP_CODE:
        return INDUSTRY_PACK_SORT_ORDER
    if code in PRO_APP_SORT_ORDER:
        return PRO_APP_SORT_ORDER[code]
    return int(manifest_sort_order or 0)


def normalize_license_scope(app_code: Optional[str]) -> str:
    normalized = (app_code or GLOBAL_LICENSE_SCOPE).strip()
    return normalized or GLOBAL_LICENSE_SCOPE


def is_valid_license_scope(app_code: Optional[str]) -> bool:
    normalized = normalize_license_scope(app_code)
    if normalized == GLOBAL_LICENSE_SCOPE:
        return True
    return normalized in PRO_APP_CODES or normalized in PRO_INDUSTRY_APP_CODES
