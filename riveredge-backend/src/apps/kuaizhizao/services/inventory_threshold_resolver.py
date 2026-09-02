"""
库存阈值唯一解析：预警规则（作用域覆盖）→ 物料 defaults → 无阈值。

供即时库存角标与预警引擎共用，禁止平行维护两套绝对数量真源。
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Tuple


@dataclass(frozen=True)
class EffectiveThreshold:
    source: str  # rule | material | none
    alert_type: str
    rule_id: Optional[int]
    rule_code: Optional[str]
    threshold_type: str
    threshold_value: Optional[Decimal]
    effective_quantity: Optional[Decimal]
    inherit_from_material: bool

    @property
    def has_threshold(self) -> bool:
        return self.effective_quantity is not None


def _to_decimal(raw: Any) -> Optional[Decimal]:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        return Decimal(text)
    except Exception:
        return None


def material_stock_thresholds(material: Any) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """物料最低/最高库存：defaults.safetyStock / maxStock（兼容 nested inventory 与 snake_case）。"""
    defaults = getattr(material, "defaults", None) if material else None
    if not isinstance(defaults, dict):
        return None, None
    inv = defaults.get("inventory") if isinstance(defaults.get("inventory"), dict) else defaults
    if not isinstance(inv, dict):
        return None, None
    safety = _to_decimal(
        inv.get("safetyStock")
        if inv.get("safetyStock") is not None
        else inv.get("safety_stock")
        if inv.get("safety_stock") is not None
        else inv.get("safety_stock_level")
    )
    max_stock = _to_decimal(
        inv.get("maxStock") if inv.get("maxStock") is not None else inv.get("max_stock")
    )
    return safety, max_stock


def _normalize_rule_material_ids(rule: Any) -> List[int]:
    """规则绑定的物料 ID 列表（material_ids 优先，兼容单 material_id）。"""
    raw = getattr(rule, "material_ids", None)
    ids: List[int] = []
    if isinstance(raw, list):
        for item in raw:
            try:
                mid = int(item)
            except (TypeError, ValueError):
                continue
            if mid > 0:
                ids.append(mid)
    rule_mid = getattr(rule, "material_id", None)
    if not ids and rule_mid is not None:
        try:
            ids = [int(rule_mid)]
        except (TypeError, ValueError):
            ids = []
    return ids


def _rule_specificity(
    rule: Any,
    *,
    material_id: int,
    warehouse_id: Optional[int],
    material_group_id: Optional[int],
) -> Optional[int]:
    """不匹配返回 None；匹配返回特异度（越大越优先）。"""
    rule_mids = _normalize_rule_material_ids(rule)
    rule_gid = getattr(rule, "material_group_id", None)
    rule_wid = getattr(rule, "warehouse_id", None)

    if rule_mids and int(material_id) not in rule_mids:
        return None
    if rule_gid is not None:
        if material_group_id is None or int(rule_gid) != int(material_group_id):
            return None
    if rule_wid is not None:
        if warehouse_id is None or int(rule_wid) != int(warehouse_id):
            return None

    score = 0
    if rule_mids:
        score += 4
    elif rule_gid is not None:
        score += 2
    if rule_wid is not None:
        score += 1
    return score


def pick_matching_rule(
    rules: Sequence[Any],
    *,
    alert_type: str,
    material_id: int,
    warehouse_id: Optional[int],
    material_group_id: Optional[int],
) -> Optional[Any]:
    candidates: List[Tuple[int, Any]] = []
    for rule in rules:
        if str(getattr(rule, "alert_type", "") or "") != alert_type:
            continue
        if not bool(getattr(rule, "is_enabled", True)):
            continue
        score = _rule_specificity(
            rule,
            material_id=material_id,
            warehouse_id=warehouse_id,
            material_group_id=material_group_id,
        )
        if score is None:
            continue
        candidates.append((score, rule))
    if not candidates:
        return None
    candidates.sort(
        key=lambda item: (
            item[0],
            str(getattr(item[1], "updated_at", "") or ""),
            int(getattr(item[1], "id", 0) or 0),
        ),
        reverse=True,
    )
    return candidates[0][1]


def resolve_effective_threshold(
    *,
    alert_type: str,
    material: Any,
    warehouse_id: Optional[int],
    rules: Sequence[Any],
) -> EffectiveThreshold:
    """同步解析生效阈值（规则列表需已加载）。"""
    material_id = int(getattr(material, "id", 0) or 0)
    group_id = getattr(material, "group_id", None)
    material_group_id = int(group_id) if group_id is not None else None
    safety, max_stock = material_stock_thresholds(material)

    rule = pick_matching_rule(
        rules,
        alert_type=alert_type,
        material_id=material_id,
        warehouse_id=warehouse_id,
        material_group_id=material_group_id,
    )

    if rule is not None:
        inherit = bool(getattr(rule, "inherit_material_threshold", False))
        threshold_type = str(getattr(rule, "threshold_type", "") or "quantity")
        raw_value = _to_decimal(getattr(rule, "threshold_value", None))
        effective: Optional[Decimal] = None

        if alert_type == "expired":
            effective = raw_value
        elif inherit:
            if alert_type == "low_stock":
                effective = safety
            elif alert_type == "high_stock":
                effective = max_stock
            threshold_type = "quantity"
        elif threshold_type == "percentage":
            if max_stock is not None and raw_value is not None:
                effective = (max_stock * raw_value) / Decimal("100")
        else:
            effective = raw_value

        return EffectiveThreshold(
            source="rule",
            alert_type=alert_type,
            rule_id=int(getattr(rule, "id", 0) or 0) or None,
            rule_code=str(getattr(rule, "code", "") or "") or None,
            threshold_type=threshold_type,
            threshold_value=raw_value,
            effective_quantity=effective,
            inherit_from_material=inherit,
        )

    # 无规则：物料默认（仅数量型低/高库存）
    if alert_type == "low_stock" and safety is not None:
        return EffectiveThreshold(
            source="material",
            alert_type=alert_type,
            rule_id=None,
            rule_code=None,
            threshold_type="quantity",
            threshold_value=safety,
            effective_quantity=safety,
            inherit_from_material=False,
        )
    if alert_type == "high_stock" and max_stock is not None:
        return EffectiveThreshold(
            source="material",
            alert_type=alert_type,
            rule_id=None,
            rule_code=None,
            threshold_type="quantity",
            threshold_value=max_stock,
            effective_quantity=max_stock,
            inherit_from_material=False,
        )
    return EffectiveThreshold(
        source="none",
        alert_type=alert_type,
        rule_id=None,
        rule_code=None,
        threshold_type="quantity",
        threshold_value=None,
        effective_quantity=None,
        inherit_from_material=False,
    )


def is_threshold_breached(quantity: Decimal, threshold: EffectiveThreshold) -> bool:
    if not threshold.has_threshold or threshold.effective_quantity is None:
        return False
    qty = Decimal(quantity)
    eff = threshold.effective_quantity
    if threshold.alert_type == "low_stock":
        return qty <= eff
    if threshold.alert_type == "high_stock":
        return qty > eff
    return False


def alert_level_for(quantity: Decimal, alert_type: str) -> str:
    if alert_type == "low_stock":
        return "critical" if quantity <= 0 else "warning"
    if alert_type == "expired":
        return "critical"
    return "warning"


def build_alert_message(
    *,
    quantity: Decimal,
    threshold: EffectiveThreshold,
) -> str:
    qty = float(quantity)
    eff = float(threshold.effective_quantity) if threshold.effective_quantity is not None else 0.0
    source_hint = ""
    if threshold.source == "rule" and threshold.rule_code:
        source_hint = f"（规则 {threshold.rule_code}）"
    elif threshold.source == "material":
        source_hint = "（物料）"
    if threshold.alert_type == "low_stock":
        return f"当前 {qty:g}，低于安全库存 {eff:g}{source_hint}"
    if threshold.alert_type == "high_stock":
        return f"当前 {qty:g}，高于最高库存 {eff:g}{source_hint}"
    if threshold.alert_type == "expired":
        return f"存在批次将在 {eff:g} 天内过期或已过期{source_hint}"
    return f"库存预警{source_hint}"


def display_alert_from_threshold(
    quantity: float,
    threshold: EffectiveThreshold,
) -> Optional[Dict[str, Any]]:
    """供即时库存角标：若突破阈值则返回展示字段。"""
    if not is_threshold_breached(Decimal(str(quantity)), threshold):
        return None
    qty = Decimal(str(quantity))
    type_labels = {
        "low_stock": "低库存",
        "high_stock": "高库存",
        "expired": "过期",
    }
    return {
        "alert_status": threshold.alert_type,
        "alert_level": alert_level_for(qty, threshold.alert_type),
        "alert_label": type_labels.get(threshold.alert_type, "预警"),
        "alert_message": build_alert_message(quantity=qty, threshold=threshold),
    }
