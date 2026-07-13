"""
物料来源类型常量。

Configure（配置件）已废弃：可配置能力由 variant_managed / BOM 配置位表达，来源类型归并为 Buy。
"""

from typing import Optional

from infra.exceptions.exceptions import ValidationError

SOURCE_TYPE_MAKE = "Make"
SOURCE_TYPE_BUY = "Buy"
SOURCE_TYPE_PHANTOM = "Phantom"
SOURCE_TYPE_OUTSOURCE = "Outsource"
SOURCE_TYPE_SERVICE = "Service"

LEGACY_SOURCE_TYPE_CONFIGURE = "Configure"

CANONICAL_SOURCE_TYPES = [
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_PHANTOM,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_SERVICE,
]


def normalize_material_source_type(source_type: Optional[str]) -> Optional[str]:
    if source_type is None:
        return None
    st = source_type.strip()
    if not st:
        return source_type
    if st == LEGACY_SOURCE_TYPE_CONFIGURE:
        return SOURCE_TYPE_BUY
    return st


def is_canonical_material_source_type(source_type: Optional[str]) -> bool:
    if not source_type:
        return False
    return normalize_material_source_type(source_type) in CANONICAL_SOURCE_TYPES


def require_canonical_material_source_type(
    source_type: Optional[str],
    *,
    material_id: Optional[int] = None,
    material_code: Optional[str] = None,
    material_name: Optional[str] = None,
) -> str:
    """物料来源类型唯一校验入口；缺失或非法时抛 ValidationError，禁止业务层静默兜底。"""
    normalized = normalize_material_source_type(source_type)
    if normalized and is_canonical_material_source_type(normalized):
        return normalized

    identity = material_code or (str(material_id) if material_id is not None else None)
    name_part = f" {material_name}" if material_name else ""
    id_part = f"物料 {identity}" if identity else "物料"
    raise ValidationError(
        f"{id_part}{name_part} 未配置有效的物料来源类型（Make/Buy/Phantom/Outsource/Service），"
        "请在物料主数据中维护 source_type 后再操作"
    )
