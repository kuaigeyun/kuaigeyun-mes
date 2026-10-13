"""列表/详情记录批量嵌入 ``record.audit``。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from core.services.approval.audit_binding_service import AuditBindingService
from core.services.approval.audit_capability_gate import gate_audit_allowed_actions
from core.services.approval.audit_flow_viewer_gate import (
    apply_viewer_actions_to_audit_and_capabilities,
)
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


def _read_capabilities(item: RecordLike) -> Any:
    if isinstance(item, dict):
        return item.get("capabilities")
    return getattr(item, "capabilities", None)


def _read_record_id(item: RecordLike, id_field: str = "id") -> Optional[int]:
    raw = item.get(id_field) if isinstance(item, dict) else getattr(item, id_field, None)
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return None
    return val if val > 0 else None


def _update_record_fields(item: RecordLike, updates: Dict[str, Any]) -> RecordLike:
    if isinstance(item, dict):
        item.update(updates)
        return item
    if hasattr(item, "model_copy"):
        return item.model_copy(update=updates)
    for key, value in updates.items():
        setattr(item, key, value)
    return item


async def _attach_batch_viewer_actions(
    tenant_id: int,
    entity_type: str,
    items: Sequence[RecordLike],
    viewer_id: int,
) -> List[RecordLike]:
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    pending_ids: List[int] = []
    for item in items:
        audit = item.get("audit") if isinstance(item, dict) else getattr(item, "audit", None)
        if not isinstance(audit, dict):
            continue
        if audit.get("phase") != "pending" or not audit.get("enabled"):
            continue
        rid = _read_record_id(item)
        if rid is not None:
            pending_ids.append(rid)

    if not pending_ids:
        return list(items)

    viewer_map = await ApprovalInstanceService.batch_flow_viewer_actions_for_entities(
        tenant_id,
        entity_type,
        pending_ids,
        viewer_id,
    )
    if not viewer_map:
        return list(items)

    out: List[RecordLike] = []
    for item in items:
        rid = _read_record_id(item)
        if rid is None or rid not in viewer_map:
            out.append(item)
            continue
        audit = item.get("audit") if isinstance(item, dict) else getattr(item, "audit", None)
        caps = _read_capabilities(item)
        if not isinstance(audit, dict):
            out.append(item)
            continue
        gated_audit, gated_caps = apply_viewer_actions_to_audit_and_capabilities(
            audit,
            caps,
            viewer_map[rid],
        )
        updates: Dict[str, Any] = {"audit": gated_audit}
        if gated_caps is not None:
            updates["capabilities"] = gated_caps
        out.append(_update_record_fields(item, updates))
    return out


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
    # capabilities 先于 audit 写入时须再裁剪，避免按钮门禁被冲掉
    caps = _read_capabilities(item)
    if caps is not None:
        gated = gate_audit_allowed_actions(audit, caps)
        if gated is not None:
            audit = gated
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
    viewer_id: Optional[int] = None,
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
    if viewer_id is not None:
        out = await _attach_batch_viewer_actions(
            tenant_id, entity_type, out, int(viewer_id)
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
    viewer_id: Optional[int] = None,
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
        viewer_id=viewer_id,
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
    viewer_id: Optional[int] = None,
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
        viewer_id=viewer_id,
    )


async def enrich_record(
    tenant_id: int,
    entity_type: str,
    record: RecordLike,
    *,
    status_field: str = "status",
    review_status_field: str = "review_status",
    audit_enabled: Optional[bool] = None,
    viewer_id: Optional[int] = None,
) -> RecordLike:
    """单条详情/响应嵌入 audit。"""
    enriched = await enrich_items(
        tenant_id,
        entity_type,
        [record],
        status_field=status_field,
        review_status_field=review_status_field,
        audit_enabled=audit_enabled,
        viewer_id=viewer_id,
    )
    return enriched[0]


async def apply_viewer_flow_gate_after_capabilities(
    tenant_id: int,
    entity_type: str,
    items: Sequence[RecordLike],
    viewer_id: Optional[int],
) -> List[RecordLike]:
    """capabilities 写入后再次按流程待办裁剪（列表 enrich 第二段调用）。"""
    if viewer_id is None or not items:
        return list(items)
    return await _attach_batch_viewer_actions(
        tenant_id, entity_type, items, int(viewer_id)
    )
