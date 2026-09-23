"""业务数值 DECIMAL 上限（数量/单价/金额）统一口径。

与库存账面等宽字段对齐：DECIMAL(18,4)。
落库前用 assert_* 拦截，避免 PostgreSQL numeric overflow 变成 500。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional, Tuple

from infra.exceptions.exceptions import ValidationError

# (max_digits, decimal_places) — 与库存数量等宽
QUANTITY_DIGITS: Tuple[int, int] = (18, 4)
PRICE_DIGITS: Tuple[int, int] = (18, 4)
AMOUNT_DIGITS: Tuple[int, int] = (18, 4)

KindDigits = Tuple[int, int]

KIND_DIGITS = {
    "quantity": QUANTITY_DIGITS,
    "price": PRICE_DIGITS,
    "amount": AMOUNT_DIGITS,
}


def decimal_abs_limit(max_digits: int, decimal_places: int) -> Decimal:
    """NUMERIC(max_digits, decimal_places) 可存最大绝对值。"""
    return (Decimal(10) ** (max_digits - decimal_places)) - (Decimal(10) ** -decimal_places)


def assert_decimal_fits(
    value: Optional[Decimal],
    *,
    max_digits: int,
    decimal_places: int,
    field_label: str,
) -> None:
    if value is None:
        return
    d = value if isinstance(value, Decimal) else Decimal(str(value))
    if not d.is_finite():
        raise ValidationError(f"{field_label}无效")
    limit = decimal_abs_limit(max_digits, decimal_places)
    if d.copy_abs() > limit:
        int_digits = max_digits - decimal_places
        raise ValidationError(
            f"{field_label}过大（最多{int_digits}位整数、{decimal_places}位小数）"
        )


def assert_quantity(value: Optional[Decimal], field_label: str = "数量") -> None:
    md, dp = QUANTITY_DIGITS
    assert_decimal_fits(value, max_digits=md, decimal_places=dp, field_label=field_label)


def assert_price(value: Optional[Decimal], field_label: str = "单价") -> None:
    md, dp = PRICE_DIGITS
    assert_decimal_fits(value, max_digits=md, decimal_places=dp, field_label=field_label)


def assert_amount(value: Optional[Decimal], field_label: str = "金额") -> None:
    md, dp = AMOUNT_DIGITS
    assert_decimal_fits(value, max_digits=md, decimal_places=dp, field_label=field_label)


def is_numeric_overflow_error(exc: BaseException) -> bool:
    """识别驱动/数据库数值溢出，供中间件转友好校验错误。"""
    name = type(exc).__name__.lower()
    msg = str(exc).lower()
    if "numericvalueoutofrange" in name or "dataerror" in name:
        if "numeric" in msg or "out of range" in msg or "overflow" in msg:
            return True
    if "numeric field overflow" in msg or "value out of range for type numeric" in msg:
        return True
    cause = getattr(exc, "__cause__", None)
    if cause is not None and cause is not exc:
        return is_numeric_overflow_error(cause)
    return False


NUMERIC_OVERFLOW_USER_MESSAGE = "数量或金额过大，请缩小后再保存"
