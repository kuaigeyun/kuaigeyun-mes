"""好力 GO 财务 — 规格比对键（去空格与括号后匹配）。"""

from __future__ import annotations

import re

_SPEC_KEY_STRIP_RE = re.compile(r"[\s()（）\[\]【】{}｛｝]")


def normalize_finance_material_spec_key(spec: str | None) -> str:
    """供应商价格与发票明细规格比对：去掉空格与中英文括号。"""
    if spec is None:
        return ""
    return _SPEC_KEY_STRIP_RE.sub("", str(spec).strip())
