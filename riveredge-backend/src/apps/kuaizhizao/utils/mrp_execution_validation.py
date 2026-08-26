"""MRP 执行前 scope 校验：需求种子 + BOM 展开树内物料来源配置 fail-closed。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

from apps.kuaizhizao.utils.material_source_helper import (
    MANUFACTURING_MODE_ASSEMBLY,
    MANUFACTURING_MODE_FABRICATION,
    SOURCE_TYPE_CONFIGURE,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_PHANTOM,
    get_material_source_type,
    validate_material_source_config,
)
from apps.master_data.models.material import Material
from apps.master_data.services.material_service import MaterialService
from infra.exceptions.exceptions import BusinessLogicError


def _material_bom_overridden(
    material_id: int,
    params: Dict[str, Any],
    *,
    is_seed: bool,
) -> bool:
    mbv = params.get("material_bom_versions") or {}
    v = mbv.get(material_id) or mbv.get(str(material_id))
    if v:
        return True
    return bool(is_seed and params.get("bom_version"))


def _make_needs_bom_in_tree(manufacturing_mode: Optional[str]) -> bool:
    if not manufacturing_mode:
        return True
    if manufacturing_mode == MANUFACTURING_MODE_ASSEMBLY:
        return True
    if manufacturing_mode == MANUFACTURING_MODE_FABRICATION:
        return False
    return True


def _append_scope_issue(
    bucket: List[Dict[str, Any]],
    seen: Set[Tuple[int, str]],
    *,
    material_id: int,
    material_code: str,
    material_name: str,
    message: str,
) -> None:
    key = (material_id, message)
    if key in seen:
        return
    seen.add(key)
    bucket.append(
        {
            "material_id": material_id,
            "material_code": material_code,
            "material_name": material_name,
            "messages": [message],
        }
    )


def _merge_scope_issue_messages(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: Dict[int, Dict[str, Any]] = {}
    for item in items:
        mid = int(item["material_id"])
        if mid not in merged:
            merged[mid] = {
                "material_id": mid,
                "material_code": item.get("material_code") or "",
                "material_name": item.get("material_name") or "",
                "messages": [],
            }
        for msg in item.get("messages") or []:
            if msg and msg not in merged[mid]["messages"]:
                merged[mid]["messages"].append(msg)
    return list(merged.values())


async def validate_mrp_scope_materials(
    tenant_id: int,
    material_ids: List[int],
    params: Dict[str, Any],
    seed_id_set: Set[int],
) -> Dict[str, Any]:
    """校验 BOM 展开范围内物料来源配置；返回 blocking / warning 结构化结果。"""
    bom_map = await MaterialService.batch_check_has_bom(tenant_id, material_ids)
    blocking_raw: List[Dict[str, Any]] = []
    warnings_raw: List[Dict[str, Any]] = []
    blocking_seen: Set[Tuple[int, str]] = set()
    warning_seen: Set[Tuple[int, str]] = set()

    for mid in material_ids:
        material = await Material.get_or_none(tenant_id=tenant_id, id=mid, deleted_at__isnull=True)
        if not material:
            _append_scope_issue(
                blocking_raw,
                blocking_seen,
                material_id=mid,
                material_code=str(mid),
                material_name="",
                message=f"物料不存在: {mid}",
            )
            continue

        source_type = material.source_type or await get_material_source_type(tenant_id, mid)
        if not source_type:
            continue

        source_config = material.source_config or {}
        manufacturing_mode = source_config.get("manufacturing_mode")
        bom_overridden = _material_bom_overridden(mid, params, is_seed=mid in seed_id_set)
        bom_ok = bool(bom_map.get(mid)) or bom_overridden

        passed, errors = await validate_material_source_config(
            tenant_id=tenant_id,
            material_id=mid,
            source_type=source_type,
        )
        if not passed:
            for msg in errors:
                _append_scope_issue(
                    blocking_raw,
                    blocking_seen,
                    material_id=mid,
                    material_code=material.main_code or "",
                    material_name=material.name or "",
                    message=msg,
                )

        needs_bom = source_type in (SOURCE_TYPE_PHANTOM, SOURCE_TYPE_CONFIGURE) or (
            source_type == SOURCE_TYPE_MAKE and _make_needs_bom_in_tree(manufacturing_mode)
        )
        if needs_bom and not bom_ok:
            msg = f"物料在 BOM 展开树中缺少已审核 BOM，物料: {material.main_code} ({material.name})"
            _append_scope_issue(
                blocking_raw,
                blocking_seen,
                material_id=mid,
                material_code=material.main_code or "",
                material_name=material.name or "",
                message=msg,
            )

        if (
            source_type == SOURCE_TYPE_MAKE
            and manufacturing_mode == MANUFACTURING_MODE_ASSEMBLY
            and bom_ok
            and not material.process_route_id
        ):
            msg = f"组合型自制件建议配置工艺路线（装配工序），物料: {material.main_code} ({material.name})"
            _append_scope_issue(
                warnings_raw,
                warning_seen,
                material_id=mid,
                material_code=material.main_code or "",
                material_name=material.name or "",
                message=msg,
            )

    blocking_errors = _merge_scope_issue_messages(blocking_raw)
    warnings = _merge_scope_issue_messages(warnings_raw)
    return {
        "blocking_errors": blocking_errors,
        "warnings": warnings,
        "blocking_count": len(blocking_errors),
        "warning_count": len(warnings),
    }


def format_mrp_scope_blocking_message(result: Dict[str, Any], *, max_items: int = 5) -> str:
    items = result.get("blocking_errors") or []
    total = len(items)
    if total == 0:
        return ""
    codes = [str(item.get("material_code") or item.get("material_id") or "") for item in items[:max_items]]
    codes = [c for c in codes if c]
    prefix = "、".join(codes)
    if total > max_items:
        return f"MRP 执行前校验失败：{prefix} 等共 {total} 个物料来源/BOM 配置不完整，请先在主数据维护"
    return f"MRP 执行前校验失败：{prefix} 共 {total} 个物料来源/BOM 配置不完整，请先在主数据维护"


def raise_if_mrp_scope_blocking(result: Dict[str, Any]) -> None:
    if int(result.get("blocking_count") or 0) <= 0:
        return
    raise BusinessLogicError(format_mrp_scope_blocking_message(result))


def _readiness_gap_base_from_material(
    item: Dict[str, Any],
    material: Optional[Material],
    source_config: Dict[str, Any],
) -> Dict[str, Any]:
    mid = int(item.get("material_id") or 0)
    return {
        "material_id": mid,
        "material_uuid": str(getattr(material, "uuid", "") or ""),
        "material_code": item.get("material_code") or getattr(material, "main_code", "") or "",
        "material_name": item.get("material_name") or getattr(material, "name", "") or "",
        "material_spec": getattr(material, "specification", None),
        "material_unit": getattr(material, "base_unit", None),
        "source_type": getattr(material, "source_type", None),
        "manufacturing_mode": source_config.get("manufacturing_mode"),
    }


def _scope_blocking_message_to_readiness_gap(
    message: str,
    *,
    base: Dict[str, Any],
) -> Dict[str, Any]:
    """将 scope 校验文案映射为可补齐项；无法映射时仅展示说明（info）。"""
    msg = (message or "").strip()
    if "工艺路线" in msg:
        return {
            **base,
            "field": "process_route_id",
            "label": "工艺路线",
            "current": msg or None,
            "suggested": None,
            "value_type": "process_route_id",
            "blocking": True,
        }
    if "BOM" in msg:
        return {
            **base,
            "field": "_bom",
            "label": "BOM配置",
            "current": msg or None,
            "suggested": None,
            "value_type": "info",
            "blocking": True,
        }
    if "委外供应商" in msg:
        return {
            **base,
            "field": "source_config.outsource_supplier_id",
            "label": "委外供应商",
            "current": msg or None,
            "suggested": None,
            "value_type": "supplier_id",
            "blocking": True,
        }
    if "委外工序" in msg:
        return {
            **base,
            "field": "source_config.outsource_operation",
            "label": "委外工序",
            "current": msg or None,
            "suggested": None,
            "value_type": "text",
            "blocking": True,
        }
    if "属性配置" in msg or "BOM属性" in msg:
        return {
            **base,
            "field": "_source_validation",
            "label": "来源配置",
            "current": msg or None,
            "suggested": None,
            "value_type": "info",
            "blocking": True,
        }
    return {
        **base,
        "field": "_source_validation",
        "label": "来源配置",
        "current": msg or None,
        "suggested": None,
        "value_type": "info",
        "blocking": True,
    }


def scope_blocking_to_readiness_gaps(
    result: Dict[str, Any],
    *,
    material_by_id: Optional[Dict[int, Material]] = None,
) -> List[Dict[str, Any]]:
    """将 scope blocking 映射为 readiness gaps（与结构缺失展示一致）。"""
    gaps: List[Dict[str, Any]] = []
    material_by_id = material_by_id or {}
    for item in result.get("blocking_errors") or []:
        mid = int(item.get("material_id") or 0)
        material = material_by_id.get(mid)
        source_config = (getattr(material, "source_config", None) or {}) if material else {}
        if not isinstance(source_config, dict):
            source_config = {}
        base = _readiness_gap_base_from_material(item, material, source_config)
        messages = [str(m).strip() for m in (item.get("messages") or []) if str(m).strip()]
        if not messages:
            gaps.append(
                _scope_blocking_message_to_readiness_gap("", base=base),
            )
            continue
        for message in messages:
            gaps.append(_scope_blocking_message_to_readiness_gap(message, base=base))
    return gaps
