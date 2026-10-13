"""
物料多单位：场景单位解析与基础单位换算。

约定：业务单据数量落库仍使用基础单位；生产/报工展示与录入使用 scenarios.production（缺省回退基础单位）。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

MaterialScenario = str  # purchase | sale | production | inventory


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def _parse_material_units_cfg(units_cfg: Any) -> Optional[Dict[str, Any]]:
    """规范化物料 units（dict / JSON 字符串）；非法则 None。"""
    if isinstance(units_cfg, str):
        text = units_cfg.strip()
        if not text:
            return None
        try:
            import json

            units_cfg = json.loads(text)
        except Exception:
            return None
    if isinstance(units_cfg, dict):
        return units_cfg
    return None


def resolve_material_scenario_unit(material: Any, scenario: MaterialScenario) -> str:
    """解析物料在指定场景下的单位；未配置或映射已失效时回退基础单位。"""
    base_unit = str(getattr(material, "base_unit", None) or "").strip()
    if scenario == "inventory":
        return base_unit

    units_cfg = _parse_material_units_cfg(getattr(material, "units", None))
    if not units_cfg:
        return base_unit

    aux_units = units_cfg.get("units") or []
    # 无辅助单位时场景映射 UI 不可见，残留 production 不得覆盖基础单位
    if not isinstance(aux_units, list) or len(aux_units) == 0:
        return base_unit

    scenarios = units_cfg.get("scenarios") or {}
    if not isinstance(scenarios, dict):
        return base_unit
    mapped = scenarios.get(scenario)
    if mapped is None or not str(mapped).strip():
        return base_unit
    unit = str(mapped).strip()
    allowed = {base_unit} if base_unit else set()
    for row in aux_units:
        if isinstance(row, dict):
            name = str(row.get("unit") or "").strip()
            if name:
                allowed.add(name)
    if unit in allowed:
        return unit
    return base_unit


def resolve_unit_to_base_factor(material: Any, unit_name: Optional[str]) -> Decimal:
    """
    业务单位 -> 基础单位换算因子。

    1 个业务单位 = factor × 1 个基础单位（与物料表单分子/分母一致）。
    """
    if not unit_name:
        return Decimal("1")
    base_unit = str(getattr(material, "base_unit", None) or "").strip()
    target = str(unit_name).strip()
    if not target or not base_unit or target == base_unit:
        return Decimal("1")

    units_cfg = getattr(material, "units", None)
    if not isinstance(units_cfg, dict):
        return Decimal("1")
    units = units_cfg.get("units")
    if not isinstance(units, list):
        return Decimal("1")

    for unit_cfg in units:
        if not isinstance(unit_cfg, dict):
            continue
        if str(unit_cfg.get("unit", "")).strip() != target:
            continue
        try:
            numerator = _decimal(unit_cfg.get("numerator", 1) or 1)
            denominator = _decimal(unit_cfg.get("denominator", 1) or 1)
            if numerator <= 0 or denominator <= 0:
                return Decimal("1")
            return numerator / denominator
        except Exception:
            return Decimal("1")
    return Decimal("1")


def convert_to_base_quantity(
    material: Any,
    quantity: Any,
    *,
    from_unit: Optional[str] = None,
) -> Decimal:
    qty = _decimal(quantity)
    if qty <= 0:
        return qty
    unit_name = from_unit or resolve_material_scenario_unit(material, "production")
    factor = resolve_unit_to_base_factor(material, unit_name)
    if factor <= 0:
        factor = Decimal("1")
    return qty * factor


def convert_unit_price_to_base(
    material: Any,
    price: Any,
    *,
    from_unit: Optional[str] = None,
) -> Decimal:
    """
    业务单位单价 → 基础单位单价。

    库存数量与批次余额按基础单位汇总；defaults / 采购价 / 入库行单价常按采购或行单位维护。
    """
    unit_price = _decimal(price)
    if unit_price <= 0:
        return Decimal("0")
    unit_name = from_unit or resolve_material_scenario_unit(material, "purchase")
    factor = resolve_unit_to_base_factor(material, unit_name)
    if factor <= 0 or factor == Decimal("1"):
        return unit_price
    return unit_price / factor


def convert_purchase_unit_price_to_base(material: Any, price: Any) -> Decimal:
    """物料 defaults / source_config 采购价换算为基础单位单价。"""
    return convert_unit_price_to_base(material, price)


def convert_from_base_quantity(
    material: Any,
    base_quantity: Any,
    *,
    to_unit: Optional[str] = None,
) -> Decimal:
    qty = _decimal(base_quantity)
    if qty <= 0:
        return qty
    unit_name = to_unit or resolve_material_scenario_unit(material, "production")
    base_unit = str(getattr(material, "base_unit", None) or "").strip()
    if not unit_name or unit_name == base_unit:
        return qty
    factor = resolve_unit_to_base_factor(material, unit_name)
    if factor <= 0:
        return qty
    return qty / factor


def build_work_order_unit_fields(material: Any, wo: Any) -> Dict[str, Any]:
    """为工单响应补充单位与按生产单位换算后的展示数量。"""
    if not material:
        return {}

    base_unit = str(getattr(material, "base_unit", None) or "").strip()
    product_unit = resolve_material_scenario_unit(material, "production")
    factor = resolve_unit_to_base_factor(material, product_unit)

    def _display(field: str) -> Optional[Decimal]:
        raw = getattr(wo, field, None)
        if raw is None:
            return None
        val = _decimal(raw)
        if val <= 0 and field not in ("quantity",):
            return val
        return convert_from_base_quantity(material, val, to_unit=product_unit)

    out: Dict[str, Any] = {
        "base_unit": base_unit or None,
        "product_unit": product_unit or None,
        "unit_to_base_factor": float(factor) if factor else 1.0,
    }
    for src, dst in (
        ("quantity", "display_quantity"),
        ("split_remaining_quantity", "display_split_remaining_quantity"),
        ("completed_quantity", "display_completed_quantity"),
        ("qualified_quantity", "display_qualified_quantity"),
        ("unqualified_quantity", "display_unqualified_quantity"),
    ):
        disp = _display(src)
        if disp is not None:
            out[dst] = disp
    return out
