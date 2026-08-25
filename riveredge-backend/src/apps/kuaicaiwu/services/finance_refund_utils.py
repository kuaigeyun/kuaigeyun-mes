"""收/付款退款执行态计算（写路径唯一真源）。"""

from __future__ import annotations

from decimal import Decimal

REFUND_STATUS_NONE = "未退款"
REFUND_STATUS_PARTIAL = "部分退款"
REFUND_STATUS_FULL = "全部退款"

_MONEY = Decimal("0.01")


def quantize_money(value: Decimal | float | str) -> Decimal:
    return Decimal(str(value or 0)).quantize(_MONEY)


def compute_refund_execution_status(total_amount: Decimal, refunded_amount: Decimal) -> str:
    total = quantize_money(total_amount)
    refunded = quantize_money(refunded_amount)
    if refunded <= Decimal("0"):
        return REFUND_STATUS_NONE
    if refunded >= total:
        return REFUND_STATUS_FULL
    return REFUND_STATUS_PARTIAL


def compute_refundable_balance(
    total_amount: Decimal,
    refunded_amount: Decimal,
    reserved_refund_amount: Decimal = Decimal("0"),
) -> Decimal:
    total = quantize_money(total_amount)
    refunded = quantize_money(refunded_amount)
    reserved = quantize_money(reserved_refund_amount)
    return max(Decimal("0"), total - refunded - reserved)
