"""好力 GO — 设备运行状态（数据字典 HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS）校验。"""

from typing import FrozenSet, Optional

from fastapi import HTTPException, status

from core.services.data.data_dictionary_service import DataDictionaryService

HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT = "HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS"

_LEGACY_ALLOWED: FrozenSet[str] = frozenset({"running", "repair", "shutdown", "standby"})


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
