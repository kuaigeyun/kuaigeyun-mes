"""
应用 code 重命名登记表（一次性迁移 + 扫描应用时合并，非运行时 alias）。

manifest code 变更时：须在本表登记 old→new，由迁移与 scan 合并行，禁止产生双份应用。
"""

from __future__ import annotations

from typing import Dict, FrozenSet

# old_code -> new_code（行业免费包编码规范化）
APPLICATION_CODE_RENAMES: Dict[str, str] = {
    "kuaielectronics": "ind-electronics",
    "industry-mold": "ind-mold",
    "pro-data-center": "kuaiconnect",
}

LEGACY_INDUSTRY_RENAME_SOURCE_CODES: FrozenSet[str] = frozenset(APPLICATION_CODE_RENAMES.keys())


def canonicalize_app_code(app_code: str | None) -> str:
    """将历史 app code 规范为当前 manifest code（无登记则原样返回）。"""
    code = (app_code or "").strip()
    if not code:
        return ""
    return APPLICATION_CODE_RENAMES.get(code, code)


def app_code_activation_aliases(app_code: str | None) -> tuple[str, ...]:
    """当前 code 及其历史旧码，用于 License / 激活登记查询。"""
    code = canonicalize_app_code(app_code)
    if not code:
        return ()
    legacy = tuple(sorted(old for old, new in APPLICATION_CODE_RENAMES.items() if new == code))
    return (code, *legacy)
