"""项目建议书模板字段常量（对齐 FND/R-08-01-01 纸质表单结构，标签走 i18n）。"""

from __future__ import annotations

from typing import FrozenSet, Tuple

PRODUCT_LINES = frozenset({"rf", "ir", "remote"})
PROPOSING_DEPTS = frozenset({"domestic_sales", "export_sales"})
CUSTOMER_MATERIAL_TYPES = frozenset({"id", "3d2d", "ai", "spec", "email"})
DEV_REQ_TYPES = frozenset({"A", "B", "C", "D", "E", "F"})
DEV_REQ_TYPES_NEED_SUPPLIER: FrozenSet[str] = frozenset({"D", "E", "F"})

SUPPLIER_ASSESSMENT_MATERIALS: Tuple[Tuple[str, str], ...] = (
    ("plastic_shell", "塑壳"),
    ("conductive_adhesive", "导电胶"),
    ("metal_dome", "Metal-dome"),
    ("facing", "贴面"),
    ("pcb", "PCB"),
    ("chip", "芯片"),
    ("packaging", "包装箱/袋"),
)

SUPPLIER_ASSESSMENT_MATERIAL_KEYS = frozenset(k for k, _ in SUPPLIER_ASSESSMENT_MATERIALS)
