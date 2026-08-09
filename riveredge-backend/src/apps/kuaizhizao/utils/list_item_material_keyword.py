"""列表 keyword 扩展：按明细行物料编码/名称/规格反查表头 ID。"""

from __future__ import annotations

from typing import Any, List, Type

from tortoise.expressions import Q
from tortoise.models import Model


async def header_ids_matching_item_material(
    tenant_id: int,
    item_model: Type[Model],
    header_fk_field: str,
    keyword: str,
    *,
    include_spec: bool = True,
) -> List[int]:
    """按物料 keyword 在明细表反查表头 ID 列表（去重）。"""
    kw = (keyword or "").strip()
    if not kw:
        return []
    filters: Any = Q(material_code__icontains=kw) | Q(material_name__icontains=kw)
    if include_spec:
        filters = filters | Q(material_spec__icontains=kw)
    ids = (
        await item_model.filter(tenant_id=tenant_id)
        .filter(filters)
        .distinct()
        .values_list(header_fk_field, flat=True)
    )
    return [int(x) for x in ids if x is not None]
