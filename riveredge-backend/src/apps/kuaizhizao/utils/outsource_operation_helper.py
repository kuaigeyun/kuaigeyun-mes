"""委外工序展示：物料 source_config 存工序 UUID，工单/列表需解析为工序名称。"""

from __future__ import annotations

import re
from typing import Dict, Iterable, Optional

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def is_operation_uuid(value: Optional[str]) -> bool:
    return bool(value and _UUID_RE.match(str(value).strip()))


async def build_outsource_operation_label_map(
    tenant_id: int,
    values: Iterable[Optional[str]],
) -> Dict[str, str]:
    uuids = sorted({str(v).strip() for v in values if is_operation_uuid(v)})
    if not uuids:
        return {}
    from apps.master_data.models.process import Operation

    rows = await Operation.filter(
        tenant_id=tenant_id,
        uuid__in=uuids,
        deleted_at__isnull=True,
    ).all()
    return {str(op.uuid): str(op.name) for op in rows}


def display_outsource_operation(
    value: Optional[str],
    label_map: Optional[Dict[str, str]] = None,
) -> Optional[str]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if label_map and is_operation_uuid(raw):
        return label_map.get(raw) or raw
    return raw


async def normalize_outsource_operation_value(
    tenant_id: int,
    value: Optional[str],
) -> Optional[str]:
    """创建/保存委外工单时，将工序 UUID 转为工序名称写入 outsource_operation。"""
    if not value:
        return value
    raw = str(value).strip()
    if not is_operation_uuid(raw):
        return raw
    label_map = await build_outsource_operation_label_map(tenant_id, [raw])
    return label_map.get(raw) or raw
