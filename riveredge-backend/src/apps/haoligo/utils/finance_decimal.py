"""好力 GO 财务 — 单价 Decimal 解析（保留导入原始精度，禁止截断/去尾零）。"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

from apps.haoligo.constants.finance_decimal import FINANCE_UNIT_PRICE_LITERAL_MAX_LEN

_UNIT_PRICE_LITERAL_RE = re.compile(r"^\d+(\.\d+)?$")


def normalize_unit_price_literal(value) -> str:
    """规范化单价原文：只去空白与千分位逗号，不改动小数位数与尾零。"""
    if value is None:
        raise ValueError("单价不能为空")
    text = str(value).strip().replace(",", "")
    if not text:
        raise ValueError("单价不能为空")
    if len(text) > FINANCE_UNIT_PRICE_LITERAL_MAX_LEN:
        raise ValueError(f"单价过长（最多 {FINANCE_UNIT_PRICE_LITERAL_MAX_LEN} 字符）")
    if not _UNIT_PRICE_LITERAL_RE.match(text):
        raise ValueError("单价格式无效")
    try:
        parsed = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError("单价格式无效") from exc
    if parsed < 0:
        raise ValueError("单价不能为负数")
    # 原样返回 text，禁止 format/normalize 改写位数
    return text


def parse_unit_price_decimal(value) -> Decimal:
    return Decimal(normalize_unit_price_literal(value))


def unit_price_to_api_str(value: Decimal | None, literal: str | None = None) -> str | None:
    if literal is not None and str(literal).strip():
        # 有原文：原样返回，禁止 normalize/去尾零
        return str(literal).strip()
    if value is None:
        return None
    # 无原文时只能从 Decimal 还原（可能已丢精度），去掉 NUMERIC 填充尾零
    return format(value.normalize(), "f")


def resolve_unit_price_literal(unit_price: Decimal, literal: str | None = None) -> str:
    if literal is not None and str(literal).strip():
        return normalize_unit_price_literal(literal)
    return unit_price_to_api_str(unit_price) or "0"
