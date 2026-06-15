"""列表/详情记录批量嵌入 ``record.audit``。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from core.services.approval.audit_binding_service import AuditBindingService
from core.services.approval.audit_phase import derive_audit_phase

RecordLike = Union[Dict[str, Any], Any]


def _read_status(
    item: RecordLike,
    status_field: str,
    review_status_field: str,
) -> Tuple[Any, Any]:
    if isinstance(item, dict):
        return item.get(status_field), item.get(review_status_field)
    return getattr(item, status_field, None), getattr(item, review_status_field, None)


def _apply_audit(
    item: RecordLike,
    *,
    entity_type: str,
    enabled: bool,
    status_field: str,
    review_status_field: str,
) -> RecordLike:
    status, review_status = _read_status(item, status_field, review_status_field)
    audit = derive_audit_phase(
        entity_type,
        status,
        review_status,
        enabled=enabled,
    )
    if isinstance(item, dict):
        item["audit"] = audit
        return item
    if hasattr(item, "model_copy"):
        return item.model_copy(update={"audit": audit})
    setattr(item, "audit", audit)
    return item


async def audit_enabled_for(tenant_id: int, entity_type: str) -> bool:
    return await AuditBindingService.is_audit_enabled(tenant_id, entity_type)


async def enrich_items(
    tenant_id: int,
    entity_type: str,
    items: Sequence[RecordLike],
    *,
    status_field: str = "status",
    review_status_field: str = "review_status",
    audit_enabled: Optional[bool] = None,
) -> List[RecordLike]:
    """为每条记录写入 ``audit`` 字段（原地修改 dict，Pydantic 返回 model_copy）。"""
    if not items:
        return list(items)
    enabled = (
        audit_enabled
        if audit_enabled is not None
        else await audit_enabled_for(tenant_id, entity_type)
    )
    out: List[RecordLike] = []
    for item in items:
        out.append(
            _apply_audit(
                item,
                entity_type=entity_type,
                enabled=enabled,
                status_field=status_field,
                review_status_field=review_status_field,
            )
        )
    return out


async def enrich_data_payload(
    tenant_id: int,
    entity_type: str,
    payload: Dict[str, Any],
    *,
    items_key: str = "data",
    status_field: str = "status",
    review_status_field: str = "review_status",
    audit_enabled: Optional[bool] = None,
) -> Dict[str, Any]:
    """``{ data: [...], total, success }`` 列表响应嵌入 audit。"""
    rows = payload.get(items_key)
    if not isinstance(rows, list):
        return payload
    payload[items_key] = await enrich_items(
        tenant_id,
        entity_type,
        rows,
        status_field=status_field,
        review_status_field=review_status_field,
        audit_enabled=audit_enabled,
    )
    return payload


async def enrich_items_payload(
    tenant_id: int,
    entity_type: str,
    payload: Dict[str, Any],
    *,
    items_key: str = "items",
    status_field: str = "status",
    review_status_field: str = "review_status",
    audit_enabled: Optional[bool] = None,
) -> Dict[str, Any]:
    """``{ items: [...], total }`` 列表响应嵌入 audit。"""
    return await enrich_data_payload(
        tenant_id,
        entity_type,
        payload,
        items_key=items_key,
        status_field=status_field,
        review_status_field=review_status_field,
        audit_enabled=audit_enabled,
    )


async def enrich_record(
    tenant_id: int,
    entity_type: str,
    record: RecordLike,
    *,
    status_field: str = "status",
    review_status_field: str = "review_status",
    audit_enabled: Optional[bool] = None,
) -> RecordLike:
    """单条详情/响应嵌入 audit。"""
    enriched = await enrich_items(
        tenant_id,
        entity_type,
        [record],
        status_field=status_field,
        review_status_field=review_status_field,
        audit_enabled=audit_enabled,
    )
    return enriched[0]
