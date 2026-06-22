"""好力 GO — 业务配置消息提醒（单据类型、动作、收件范围）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from core.services.business.business_notification_service import (
    BusinessNotificationService,
    register_notification_scope_resolver,
)

# ---------- 单据类型（与配置中心 trigger_document 一致） ----------
DOC_MOLD_TRIAL = "haoligo_mold_trial"
DOC_OUTSOURCE_MAINTENANCE = "haoligo_outsource_maintenance"
DOC_EQUIPMENT_SPOT_CHECK = "haoligo_equipment_spot_check"
DOC_EQUIPMENT_ROUTE_PATROL = "haoligo_equipment_route_patrol"
DOC_PATROL_ISSUE_REGISTER = "haoligo_patrol_issue_register"
DOC_MOLD_MAINTENANCE = "haoligo_mold_maintenance"
DOC_MOLD_MAINTENANCE_COMPLETE = "haoligo_mold_maintenance_complete"
DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE = "haoligo_mold_outsource_maintenance_complete"
DOC_EQUIPMENT_UPKEEP_SHEET = "haoligo_equipment_upkeep_sheet"
DOC_EQUIPMENT_UPKEEP_COMPLETE = "haoligo_equipment_upkeep_complete"
DOC_EQUIPMENT_OUTPUT_RECORD = "haoligo_equipment_output_record"

# ---------- 触发动作 ----------
ACTION_SUBMITTED = "submitted"
ACTION_APPROVED = "approved"
ACTION_REJECTED = "rejected"
ACTION_REPORTED = "reported"
ACTION_CREATED = "created"
ACTION_REMEDIATED = "remediated"
ACTION_TRIAL_FAILURE_PENDING = "trial_failure_pending"
ACTION_TRIAL_FAILURE_REPAIR = "trial_failure_repair"
ACTION_TRIAL_ADJUSTMENT_COMPLETE = "trial_adjustment_complete"
ACTION_REVOKED = "revoked"
ACTION_TRIAL_PRODUCTION_PENDING = "trial_production_pending"
ACTION_TRIAL_RECALLED = "trial_recalled"


async def _scope_supplier_bound(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    from apps.haoligo.services.trial_sheet_side_effects import list_supplier_bound_user_ids
    from apps.master_data.models.supplier import Supplier as MasterSupplier

    name = (
        (context.get("supplier_name") or "")
        or (context.get("outsourced_unit_name") or "")
    ).strip()
    if name:
        ids = await list_supplier_bound_user_ids(tenant_id, name)
        if ids:
            return ids
    code = (
        (context.get("supplier_code") or "")
        or (context.get("outsourced_unit_code") or "")
    ).strip()
    if not code:
        return []
    sup = await MasterSupplier.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        code=code,
    ).first()
    if not sup:
        return []
    return await list_supplier_bound_user_ids(tenant_id, (sup.name or "").strip() or name)


async def _scope_trial_operator(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    uid = context.get("trial_user_id")
    if uid is None:
        return []
    try:
        i = int(uid)
    except (TypeError, ValueError):
        return []
    return [i] if i > 0 else []


async def _scope_reporter(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    uid = context.get("reporter_user_id")
    if uid is None:
        return []
    try:
        i = int(uid)
    except (TypeError, ValueError):
        return []
    return [i] if i > 0 else []


from apps.haoligo.services.haoligo_notification_scopes import (  # noqa: F401 — register extended scopes
    ensure_haoligo_extended_notification_scope_resolvers,
)


def ensure_haoligo_notification_scope_resolvers() -> None:
    """注册好力 GO 专用收件范围（幂等）。"""
    register_notification_scope_resolver("supplier_bound", _scope_supplier_bound)
    register_notification_scope_resolver("trial_operator", _scope_trial_operator)
    register_notification_scope_resolver("reporter", _scope_reporter)


ensure_haoligo_notification_scope_resolvers()


async def dispatch_haoligo_notification(
    tenant_id: int,
    *,
    trigger_document: str,
    trigger_action: str,
    variables: Optional[Dict[str, Any]] = None,
    context: Optional[Dict[str, Any]] = None,
) -> int:
    ctx = dict(context or {})
    ctx.setdefault("trigger_document", trigger_document)
    return await BusinessNotificationService.dispatch(
        tenant_id,
        trigger_document=trigger_document,
        trigger_action=trigger_action,
        variables=variables,
        context=ctx,
    )
