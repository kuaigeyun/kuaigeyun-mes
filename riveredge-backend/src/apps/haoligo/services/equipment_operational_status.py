"""好力 GO — 设备运行状态（数据字典 HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS）校验。"""

from typing import FrozenSet, Optional

from fastapi import HTTPException, status

from core.services.data.data_dictionary_service import DataDictionaryService

HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT = "HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS"

_LEGACY_ALLOWED: FrozenSet[str] = frozenset({"running", "repair", "shutdown", "standby"})

_LEGACY_LABELS: dict[str, str] = {
    "running": "运行",
    "repair": "维修",
    "shutdown": "停机",
    "standby": "待机",
}


async def allowed_operational_status_values(tenant_id: int) -> FrozenSet[str]:
    """当前租户可用的运行状态取值（字典项 value，小写）。"""
    dictionary = await DataDictionaryService.get_dictionary_by_code(
        tenant_id, HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT, use_cache=True
    )
    if not dictionary:
        return _LEGACY_ALLOWED
    items = await DataDictionaryService.get_items_by_dictionary(
        tenant_id, str(dictionary.uuid), is_active=True
    )
    vals = {str(it.value).strip().lower() for it in items if it.value and str(it.value).strip()}
    return frozenset(vals) if vals else _LEGACY_ALLOWED


async def normalize_operational_status(tenant_id: int, v: Optional[str]) -> Optional[str]:
    """运行状态：须在数据字典（或内置兜底集合）中；空表示未设置。"""
    if v is None or not str(v).strip():
        return None
    s = str(v).strip().lower()
    allowed = await allowed_operational_status_values(tenant_id)
    if s not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="运行状态不在数据字典「设备运行状态」允许范围内",
        )
    return s


async def operational_status_label_map(tenant_id: int) -> dict[str, str]:
    """运行状态 value（小写）→ 显示名。"""
    labels = dict(_LEGACY_LABELS)
    dictionary = await DataDictionaryService.get_dictionary_by_code(
        tenant_id, HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT, use_cache=True
    )
    if dictionary:
        items = await DataDictionaryService.get_items_by_dictionary(
            tenant_id, str(dictionary.uuid), is_active=True
        )
        for it in items:
            v = str(it.value or "").strip().lower()
            if not v:
                continue
            labels[v] = str(it.label or it.value or v).strip() or v
    return labels


async def format_operational_status_label(tenant_id: int, value: Optional[str], *, empty_label: str = "—") -> str:
    if value is None or not str(value).strip():
        return empty_label
    key = str(value).strip().lower()
    labels = await operational_status_label_map(tenant_id)
    return labels.get(key, str(value).strip())
