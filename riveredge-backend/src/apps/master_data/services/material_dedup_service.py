"""物料防重助手：按可配置字段做精确一致比对（含自定义字段）"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from tortoise.expressions import Q, F

from apps.master_data.models.material import Material
from apps.master_data.schemas.material_dedup_schemas import (
    MaterialDedupCheckResponse,
    MaterialDedupMatchItem,
)
from core.models.custom_field import CustomField
from core.models.custom_field_value import CustomFieldValue

MATERIAL_CUSTOM_FIELD_TABLE = "master_data_materials"

# 内置可配置防重字段 → Material 模型属性
BUILTIN_DEDUP_FIELDS: Dict[str, str] = {
    "name": "name",
    "specification": "specification",
    "model": "model",
    "brand": "brand",
    "base_unit": "base_unit",
    "main_code": "main_code",
}

DEFAULT_DEDUP_FIELDS = ("name", "specification", "model")


def _normalize_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        text = str(value).strip()
        return text if text else None
    text = str(value).strip()
    return text if text else None


def _is_custom_field_key(key: str) -> bool:
    return key.startswith("cf:")


def _custom_field_code(key: str) -> str:
    return key[3:].strip()


def _normalize_match_fields(match_fields: List[str]) -> List[str]:
    seen: Set[str] = set()
    ordered: List[str] = []
    for raw in match_fields:
        key = str(raw or "").strip()
        if not key or key in seen:
            continue
        if key in BUILTIN_DEDUP_FIELDS or _is_custom_field_key(key):
            seen.add(key)
            ordered.append(key)
    return ordered


class MaterialDedupService:
    @staticmethod
    async def check_exact_duplicates(
        tenant_id: int,
        match_fields: List[str],
        values: Dict[str, Any],
        *,
        exclude_uuid: Optional[str] = None,
        masters_only: bool = True,
        limit: int = 20,
    ) -> MaterialDedupCheckResponse:
        fields = _normalize_match_fields(match_fields)
        if not fields:
            return MaterialDedupCheckResponse(
                matched=False,
                matches=[],
                skipped=True,
                skip_reason="未配置有效防重字段",
            )

        normalized_values: Dict[str, str] = {}
        for key in fields:
            # 空值参与比对：两边皆空视为一致（避免型号未填时永远不触发）
            normalized_values[key] = _normalize_text(values.get(key)) or ""

        builtin_keys = [k for k in fields if k in BUILTIN_DEDUP_FIELDS]
        custom_keys = [k for k in fields if _is_custom_field_key(k)]

        # 至少要有一个非空字段，避免全空条件扫出大量物料
        if not any(normalized_values[k] for k in fields):
            return MaterialDedupCheckResponse(
                matched=False,
                matches=[],
                skipped=True,
                skip_reason="比对字段尚未填写",
            )

        q = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if masters_only:
            q &= Q(variant_managed=False) | Q(code=F("main_code"))

        for key in builtin_keys:
            attr = BUILTIN_DEDUP_FIELDS[key]
            want = normalized_values[key]
            if want == "":
                q &= Q(**{f"{attr}__isnull": True}) | Q(**{attr: ""})
            else:
                q &= Q(**{attr: want})

        if exclude_uuid:
            q &= ~Q(uuid=exclude_uuid)

        candidates = await Material.filter(q).order_by("id").limit(500)
        if not candidates:
            return MaterialDedupCheckResponse(matched=False, matches=[])

        if not custom_keys:
            return MaterialDedupCheckResponse(
                matched=True,
                matches=[_to_match_item(m) for m in candidates[:limit]],
            )

        matched_ids = await MaterialDedupService._filter_by_custom_fields(
            tenant_id=tenant_id,
            material_ids=[m.id for m in candidates],
            custom_keys=custom_keys,
            normalized_values=normalized_values,
        )
        if not matched_ids:
            return MaterialDedupCheckResponse(matched=False, matches=[])

        id_set = set(matched_ids)
        matches = [_to_match_item(m) for m in candidates if m.id in id_set][:limit]
        return MaterialDedupCheckResponse(matched=bool(matches), matches=matches)

    @staticmethod
    async def _filter_by_custom_fields(
        *,
        tenant_id: int,
        material_ids: List[int],
        custom_keys: List[str],
        normalized_values: Dict[str, str],
    ) -> List[int]:
        codes = [_custom_field_code(k) for k in custom_keys]
        fields = await CustomField.filter(
            tenant_id=tenant_id,
            table_name=MATERIAL_CUSTOM_FIELD_TABLE,
            code__in=codes,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        code_to_field = {f.code: f for f in fields}
        for key in custom_keys:
            code = _custom_field_code(key)
            if code not in code_to_field:
                return []

        surviving: Optional[Set[int]] = set(material_ids)
        for key in custom_keys:
            if surviving is not None and not surviving:
                return []
            code = _custom_field_code(key)
            field = code_to_field[code]
            want = normalized_values[key]
            values = await CustomFieldValue.filter(
                tenant_id=tenant_id,
                custom_field_id=field.id,
                record_table=MATERIAL_CUSTOM_FIELD_TABLE,
                record_id__in=list(surviving or material_ids),
                deleted_at__isnull=True,
            ).all()
            hit_ids: Set[int] = set()
            if want == "":
                # 无值记录也视为空：先记下有值的 id，再取补集
                valued_ids = {
                    row.record_id
                    for row in values
                    if _normalize_text(row.get_value()) is not None
                }
                hit_ids = set(surviving or material_ids) - valued_ids
                # 显式存空串的也算命中
                for row in values:
                    actual = _normalize_text(row.get_value())
                    if actual == "":
                        hit_ids.add(row.record_id)
            else:
                for row in values:
                    actual = _normalize_text(row.get_value())
                    if actual is not None and actual == want:
                        hit_ids.add(row.record_id)
            surviving = hit_ids if surviving is None else (surviving & hit_ids)

        return list(surviving or [])


def _to_match_item(material: Material) -> MaterialDedupMatchItem:
    return MaterialDedupMatchItem(
        uuid=str(material.uuid),
        main_code=str(material.main_code or material.code or ""),
        name=str(material.name or ""),
        specification=material.specification,
        model=getattr(material, "model", None),
    )
