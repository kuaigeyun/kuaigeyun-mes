"""从 ERP 数据集单元格解析模具代号（去掉「,数量」或末尾「 数量」后缀）。"""

from __future__ import annotations

import re

_TRAILING_QTY_SPACE = re.compile(r"^(.+?)\s+\d+$")


def parse_erp_mold_code(raw: str) -> str:
    """ERP 制令单等场景：模具列常为「代号,数量」或「代号 数量」，本系统只保留代号。"""
    s = (raw or "").strip()
    if not s:
        return ""
    if "," in s:
        s = s.split(",", 1)[0].strip()
    else:
        m = _TRAILING_QTY_SPACE.match(s)
        if m:
            s = m.group(1).strip()
    return s
