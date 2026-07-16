"""发票税额：后端统一按未税金额 × 税率计算。"""

from __future__ import annotations

from decimal import Decimal

_MONEY_SCALE = Decimal("0.01")


def compute_tax_from_excluding(
    amount_excl: Decimal,
    tax_rate_percent: Decimal,
) -> tuple[Decimal, Decimal, Decimal]:
    """
    按未税金额与税率（百分比 0–100）计算税额与价税合计。

    销项发票 API 入参 tax_rate 为百分比；进项发票 PurchaseInvoice.tax_rate 同为百分比。
    销项落库 Invoice.tax_rate 为小数（API 层除以 100），本函数仅处理百分比口径。
    """
    excl = Decimal(amount_excl).quantize(_MONEY_SCALE)
    rate = Decimal(tax_rate_percent) / Decimal("100")
    tax = (excl * rate).quantize(_MONEY_SCALE)
    total = (excl + tax).quantize(_MONEY_SCALE)
    return excl, tax, total
