"""审核动作成功后的无感外推（读绑定 push_targets + trigger_actions）。"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_ENTITY_SOURCE_TYPE: Dict[str, str] = {
    "sales_order": "sales_order",
    "purchase_order": "purchase_order",
    "work_order": "work_order",
    "reporting_record": "reporting_record",
    "material_batch": "material_batch",
}


async def _load_binding_row(entity_type: str, tenant_id: int) -> Optional[Any]:
    source_type = _ENTITY_SOURCE_TYPE.get(entity_type)
    if not source_type:
        return None
    if source_type == "sales_order":
        from apps.kuaizhizao.models.sales_order_sync_binding import SalesOrderSyncBinding

        return await SalesOrderSyncBinding.filter(tenant_id=tenant_id).first()
    if source_type == "purchase_order":
        from apps.kuaizhizao.models.purchase_order_sync_binding import PurchaseOrderSyncBinding

        return await PurchaseOrderSyncBinding.filter(tenant_id=tenant_id).first()
    if source_type == "work_order":
        from apps.kuaizhizao.models.work_order_sync_binding import WorkOrderSyncBinding

        return await WorkOrderSyncBinding.filter(tenant_id=tenant_id).first()
    if source_type == "reporting_record":
        from apps.kuaizhizao.models.reporting_sync_binding import ReportingSyncBinding

        return await ReportingSyncBinding.filter(tenant_id=tenant_id).first()
    if source_type == "material_batch":
        from apps.kuaizhizao.models.inventory_sync_binding import InventorySyncBinding

        return await InventorySyncBinding.filter(tenant_id=tenant_id).first()
    return None


async def maybe_silent_push_after_audit(
    *,
    tenant_id: int,
    user_id: int,
    entity_type: str,
    entity_id: int,
    action: str,
) -> None:
    act = str(action or "").strip().lower()
    source_type = _ENTITY_SOURCE_TYPE.get(entity_type)
    if not source_type or int(entity_id or 0) <= 0:
        return

    from core.services.data.sync_binding_sources import (
        push_targets_from_row,
        trigger_actions_from_row,
    )

    row = await _load_binding_row(entity_type, tenant_id)
    if not row:
        return
    triggers = trigger_actions_from_row(row)
    if act not in triggers:
        return
    raw_targets = getattr(row, "push_targets", None)
    if entity_type == "purchase_order" and isinstance(raw_targets, list):
        kept = [item for item in raw_targets if isinstance(item, dict) and item.get("user_saved") is True]
        if len(kept) != len(raw_targets):
            from apps.kuaizhizao.models.purchase_order_sync_binding import PurchaseOrderSyncBinding

            await PurchaseOrderSyncBinding.filter(id=row.id).update(
                push_targets=kept,
                trigger_actions=triggers if kept else [],
            )
        from core.services.data.sync_binding_sources import normalize_push_targets_json

        targets = normalize_push_targets_json(kept)
    else:
        targets = push_targets_from_row(row)
    if not targets:
        return

    from apps.kuaizhizao.services.document_push_service import DocumentPushService

    svc = DocumentPushService()
    for target in targets:
        profile = str(target.get("target_profile") or "").strip()
        if not profile:
            continue
        mode = str(target.get("push_mode") or "auto").strip()
        if mode == "manual":
            continue
        owned = target.get("trigger_actions")
        if isinstance(owned, list):
            owned_actions = [str(item).strip().lower() for item in owned if str(item or "").strip()]
            if act not in owned_actions:
                continue
        elif act not in triggers:
            continue
        try:
            await svc.push(
                tenant_id=tenant_id,
                acting_user_id=int(user_id),
                source_type=source_type,
                source_id=int(entity_id),
                targets=[target],
                dry_run=False,
            )
        except Exception as exc:
            logger.warning(
                "无感外推失败 tenant_id={} entity_type={} entity_id={} profile={} err={}",
                tenant_id,
                entity_type,
                entity_id,
                profile,
                exc,
            )
