"""审批待办人对业务单据的数据可见性（与 ApprovalTask 同源，非 RBAC 旁路）。"""

from __future__ import annotations

from typing import Set

from core.models.approval_task import ApprovalTask


async def list_pending_approver_entity_ids(
    tenant_id: int,
    user_id: int,
    entity_type: str,
) -> Set[int]:
    """当前用户作为待办审批人、且流程仍 pending 的业务实体 id 集合。"""
    et = str(entity_type or "").strip()
    if not et or user_id is None or int(user_id) <= 0:
        return set()

    tasks = (
        await ApprovalTask.filter(
            tenant_id=tenant_id,
            approver_id=int(user_id),
            status="pending",
            approval_instance__status="pending",
            approval_instance__deleted_at__isnull=True,
        )
        .prefetch_related("approval_instance")
        .all()
    )
    out: set[int] = set()
    for task in tasks:
        inst = task.approval_instance
        if not inst:
            continue
        data = inst.data or {}
        if str(data.get("entity_type") or "").strip() != et:
            continue
        raw_id = data.get("entity_id")
        try:
            eid = int(raw_id)
        except (TypeError, ValueError):
            continue
        if eid > 0:
            out.add(eid)
    return out


async def user_is_pending_approver_for_entity(
    tenant_id: int,
    user_id: int,
    entity_type: str,
    entity_id: int,
) -> bool:
    if int(entity_id) <= 0:
        return False
    pending = await list_pending_approver_entity_ids(tenant_id, user_id, entity_type)
    return int(entity_id) in pending
