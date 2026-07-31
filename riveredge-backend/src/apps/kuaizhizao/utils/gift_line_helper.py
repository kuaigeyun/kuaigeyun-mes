"""
销售赠品行校验与金额归一化。

赠品行：卖价与行金额强制为 0；可选 gift_ref_unit_price 供参考展示。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from infra.exceptions.exceptions import ValidationError


def assert_material_giftable(
    material_id: int,
    material_map: Dict[int, Any],
    *,
    material_code: str = "",
    material_name: str = "",
) -> None:
    """赠品行仅允许 is_giftable=true 的物料。"""
    mid = int(material_id or 0)
    if mid <= 0:
        raise ValidationError("赠品行须选择物料")
    material = material_map.get(mid)
    if material is None:
        raise ValidationError(f"物料不存在: {mid}")
    if not getattr(material, "is_giftable", False):
        label = material_code or material_name or getattr(material, "name", "") or str(mid)
        raise ValidationError(f"物料 {label} 未开启可赠送，不能作为赠品")


def normalize_gift_line_amounts(
    *,
    is_gift: bool,
    unit_price: Decimal,
    line_amount: Optional[Decimal] = None,
    gift_ref_unit_price: Optional[Decimal] = None,
) -> Tuple[Decimal, Decimal, Optional[Decimal]]:
    """
    归一化赠品行单价与金额。

    Returns:
        (unit_price, line_amount, gift_ref_unit_price)
    """
    ref = gift_ref_unit_price
    if ref is not None and ref < Decimal("0"):
        raise ValidationError("赠品参考单价不能为负数")

    if not is_gift:
        if unit_price < Decimal("0"):
            raise ValidationError("明细单价不能为负数")
        amt = line_amount if line_amount is not None else Decimal("0")
        if amt < Decimal("0"):
            raise ValidationError("明细金额不能为负数")
        return unit_price, amt, None

    if unit_price != Decimal("0"):
        if ref is None and unit_price > Decimal("0"):
            ref = unit_price
    return Decimal("0"), Decimal("0"), ref


def validate_gift_line_rules(
    *,
    is_gift: bool,
    unit_price: Decimal,
    material_id: int,
    material_map: Dict[int, Any],
    material_code: str = "",
    material_name: str = "",
    gift_ref_unit_price: Optional[Decimal] = None,
    line_amount: Optional[Decimal] = None,
) -> Tuple[Decimal, Decimal, Optional[Decimal]]:
    """校验赠品行规则并返回归一化后的单价、金额、参考价。"""
    if is_gift:
        assert_material_giftable(
            material_id,
            material_map,
            material_code=material_code,
            material_name=material_name,
        )
    return normalize_gift_line_amounts(
        is_gift=is_gift,
        unit_price=unit_price,
        line_amount=line_amount,
        gift_ref_unit_price=gift_ref_unit_price,
    )
