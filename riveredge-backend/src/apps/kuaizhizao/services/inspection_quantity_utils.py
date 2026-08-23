"""检验数量口径：开展检验时合格+不合格须等于检验数量。"""

from decimal import Decimal
from typing import Any, Tuple

from infra.exceptions import ValidationError

_INSPECTION_QTY_QUANT = Decimal("0.01")


def to_inspection_quantity(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value)).quantize(_INSPECTION_QTY_QUANT)


def assert_inspection_quantities_balanced(
    qualified_quantity: Any,
    unqualified_quantity: Any,
    inspection_quantity: Any,
) -> Tuple[Decimal, Decimal]:
    """合格+不合格须等于检验数量；统一 Decimal 两位小数，避免 float 与 Decimal 直接比较误报。"""
    qualified = to_inspection_quantity(qualified_quantity)
    unqualified = to_inspection_quantity(unqualified_quantity)
    inspection = to_inspection_quantity(inspection_quantity)
    if qualified + unqualified != inspection:
        raise ValidationError("合格数量和不合格数量之和必须等于检验数量")
    return qualified, unqualified
