"""单据推送：主数据编码解析（单位等），与具体业务单据解耦。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from loguru import logger

# 默认计量单位：金蝶 FNumber（常见账套「个」= 006）
DEFAULT_UNIT_NUMBER = "006"
BUILTIN_UNIT_ALIASES: Dict[str, str] = {
    "个": "006",
    "pcs": "006",
    "Pcs": "006",
    "PCS": "006",
    "kg": "004",
    "KG": "004",
}

# Save 接口 source_type_conversion_map 中视为「单位」的 field_name（大小写不敏感）
UNIT_CONVERSION_FIELD_NAMES = frozenset(
    {
        "unit",
        "unit_number",
        "funitid",
        "funitid.fnumber",
        "fbaseunitid",
        "fbaseunitid.fnumber",
    }
)


def extract_unit_code_map_from_conversion(conversion: Any) -> Dict[str, str]:
    """从 API.source_type_conversion_map 提取单位编码映射（纯函数）。

    认 field_name：unit / unit_number / FUnitId / FUnitId.FNumber /
    FBaseUnitId / FBaseUnitId.FNumber（大小写不敏感）。多条匹配时后写覆盖先写。
    """
    out: Dict[str, str] = {}
    if isinstance(conversion, dict) and conversion:
        # 扁平旧格式无 field_name，无法判定为单位，忽略
        return out
    if not isinstance(conversion, list):
        return out
    for entry in conversion:
        if not isinstance(entry, dict):
            continue
        field = str(entry.get("field_name") or "").strip().lower()
        if field not in UNIT_CONVERSION_FIELD_NAMES:
            continue
        mapping = entry.get("mapping")
        if not isinstance(mapping, dict):
            continue
        for raw_key, raw_val in mapping.items():
            key = str(raw_key).strip()
            val = str(raw_val or "").strip()
            if key and val:
                out[key] = val
    return out


async def load_save_api_unit_code_map(
    tenant_id: int, save_api_uuid: Optional[str]
) -> Dict[str, str]:
    """按 Save 接口 uuid 加载单位转换表；无接口或无映射时返回空 dict。"""
    api_uuid = str(save_api_uuid or "").strip()
    if not api_uuid:
        return {}
    try:
        from core.models.api import API

        api_obj = await API.filter(tenant_id=tenant_id, uuid=api_uuid).first()
        if not api_obj:
            return {}
        return extract_unit_code_map_from_conversion(
            getattr(api_obj, "source_type_conversion_map", None)
        )
    except Exception as exc:
        logger.warning(
            "load save api unit code map failed tenant_id={} api={} err={}",
            tenant_id,
            api_uuid,
            exc,
        )
        return {}


def apply_unit_code_map(
    unit: str, unit_code_map: Optional[Dict[str, Any]] = None
) -> str:
    """接口单位 map + 内置别名 → 目标系统单位编码。不再读取 BusinessConfig。"""
    raw = str(unit or "").strip()
    if not raw:
        return ""
    mapping: Dict[str, Any] = dict(BUILTIN_UNIT_ALIASES)
    if isinstance(unit_code_map, dict) and unit_code_map:
        mapping.update(unit_code_map)
    if raw in mapping:
        return str(mapping.get(raw) or "").strip() or raw
    lowered = {str(k).strip().lower(): v for k, v in mapping.items() if str(k).strip()}
    hit = lowered.get(raw.lower())
    if hit is not None:
        return str(hit or "").strip() or raw
    return raw


async def resolve_unit_catalog_code(tenant_id: int, unit_ref: str) -> Optional[str]:
    """单位编码或名称 → 单位目录 code（常作金蝶 FNumber）。"""
    raw = str(unit_ref or "").strip()
    if not raw:
        return None
    try:
        from apps.master_data.models.unit import MaterialUnit

        unit = await MaterialUnit.filter(
            tenant_id=tenant_id, code=raw, deleted_at__isnull=True
        ).first()
        if unit:
            return str(unit.code).strip()
        unit = await MaterialUnit.filter(
            tenant_id=tenant_id, name=raw, deleted_at__isnull=True
        ).first()
        if unit:
            return str(unit.code).strip()
    except Exception as exc:
        logger.warning("resolve unit catalog code failed ref={} err={}", raw, exc)
    return raw


async def resolve_material_base_unit(tenant_id: int, product_code: Optional[str]) -> Optional[str]:
    """物料基本单位 → 目录 code。"""
    code = str(product_code or "").strip()
    if not code:
        return None
    try:
        from apps.master_data.models.unit import MaterialUnit
        from apps.master_data.services.sync_association_service import find_material_by_code

        material = await find_material_by_code(tenant_id, code)
        if not material:
            return None
        base = str(getattr(material, "base_unit", None) or "").strip()
        if not base:
            return None
        unit = await MaterialUnit.filter(
            tenant_id=tenant_id, code=base, deleted_at__isnull=True
        ).first()
        if unit:
            return str(unit.code).strip()
        unit = await MaterialUnit.filter(
            tenant_id=tenant_id, name=base, deleted_at__isnull=True
        ).first()
        if unit:
            return str(unit.code).strip()
        return base
    except Exception as exc:
        logger.warning("resolve material unit failed code={} err={}", code, exc)
    return None


async def resolve_unit_for_push(
    tenant_id: int,
    *,
    product_code: Optional[str] = None,
    unit_hint: Optional[str] = None,
    base_unit_hint: Optional[str] = None,
    unit_code_map: Optional[Dict[str, Any]] = None,
) -> Dict[str, str]:
    """解析推送用单位编码。

    真相链（禁止读 BusinessConfig 单位键）：
    业务单据 unit_hint / 物料主数据 MaterialUnit.code
    → Save 接口 source_type_conversion_map 单位条目
    → BUILTIN_UNIT_ALIASES
    → DEFAULT_UNIT_NUMBER
    """
    unit = str(unit_hint or "").strip()
    if not unit:
        unit = await resolve_material_base_unit(tenant_id, product_code) or ""
    if unit:
        unit = await resolve_unit_catalog_code(tenant_id, unit) or unit
    unit = apply_unit_code_map(unit, unit_code_map) if unit else ""
    if not unit:
        unit = DEFAULT_UNIT_NUMBER

    base_raw = str(base_unit_hint or "").strip()
    if not base_raw:
        base = unit
    else:
        base = await resolve_unit_catalog_code(tenant_id, base_raw) or base_raw
        base = apply_unit_code_map(base, unit_code_map) or unit
        if not base:
            base = unit

    return {"unit_number": unit, "base_unit_number": base}
