"""模具维修单 / 外协维修单 — 紧急程度（内置选项，非数据字典）。"""

MOLD_REPAIR_URGENCY_GENERAL = "一般"
MOLD_REPAIR_URGENCY_URGENT = "紧急"
MOLD_REPAIR_URGENCY_LEVELS = (MOLD_REPAIR_URGENCY_GENERAL, MOLD_REPAIR_URGENCY_URGENT)
MOLD_REPAIR_URGENCY_DEFAULT = MOLD_REPAIR_URGENCY_GENERAL
MOLD_REPAIR_URGENCY_SET = frozenset(MOLD_REPAIR_URGENCY_LEVELS)


def normalize_mold_repair_urgency_level(value: str | None) -> str:
    s = (value or "").strip() or MOLD_REPAIR_URGENCY_DEFAULT
    if s not in MOLD_REPAIR_URGENCY_SET:
        raise ValueError(f"紧急程度无效，须为：{'、'.join(MOLD_REPAIR_URGENCY_LEVELS)}")
    return s
