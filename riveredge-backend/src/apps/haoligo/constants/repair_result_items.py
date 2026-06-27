"""维修完修结果：支持多项（标准选项 + 自定义文案），存储为「、」分隔字符串。"""

from __future__ import annotations

from fastapi import HTTPException, status

from apps.haoligo.constants.equipment_maintenance import (
    EQUIPMENT_MAINTENANCE_REPAIR_RESULT_SET,
    EQUIPMENT_MAINTENANCE_REPAIR_RESULTS,
    EQUIPMENT_MAINTENANCE_REPAIR_RESULT_TO_OPERATIONAL_STATUS,
)

REPAIR_RESULT_ITEM_SEPARATOR = "、"
REPAIR_RESULT_CUSTOM_ITEM_MAX_LEN = 200
REPAIR_RESULT_STORED_MAX_LEN = 2000

# operational_status 优先级：shutdown > repair > running
_OPERATIONAL_STATUS_RANK = {"shutdown": 3, "repair": 2, "running": 1}


def split_repair_result_items(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [p.strip() for p in str(raw).split(REPAIR_RESULT_ITEM_SEPARATOR) if p and str(p).strip()]


def join_repair_result_items(items: list[str]) -> str:
    seen: dict[str, None] = {}
    ordered: list[str] = []
    for item in items:
        t = (item or "").strip()
        if not t or t in seen:
            continue
        seen[t] = None
        ordered.append(t)
    return REPAIR_RESULT_ITEM_SEPARATOR.join(ordered)


def normalize_repair_result_storage(raw: str | None) -> str:
    items = split_repair_result_items(raw)
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请至少填写一项维修结果")
    normalized: list[str] = []
    for item in items:
        if item in EQUIPMENT_MAINTENANCE_REPAIR_RESULT_SET:
            normalized.append(item)
            continue
        if len(item) > REPAIR_RESULT_CUSTOM_ITEM_MAX_LEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"自定义维修结果不能超过 {REPAIR_RESULT_CUSTOM_ITEM_MAX_LEN} 字",
            )
        normalized.append(item)
    joined = join_repair_result_items(normalized)
    if len(joined) > REPAIR_RESULT_STORED_MAX_LEN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维修结果总长度超出限制")
    return joined


def operational_status_from_repair_results(raw: str | None) -> str | None:
    best: str | None = None
    best_rank = 0
    for item in split_repair_result_items(raw):
        mapped = EQUIPMENT_MAINTENANCE_REPAIR_RESULT_TO_OPERATIONAL_STATUS.get(item)
        if mapped is None:
            continue
        rank = _OPERATIONAL_STATUS_RANK.get(mapped, 0)
        if rank > best_rank:
            best_rank = rank
            best = mapped
    return best
