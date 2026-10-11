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
