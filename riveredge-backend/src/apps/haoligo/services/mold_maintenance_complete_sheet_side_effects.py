"""好力 GO — 厂内维保完修单消息提醒。"""

from __future__ import annotations

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_maintenance_sheet import HaoligoMoldMaintenanceSheet
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_CREATED,
    DOC_MOLD_MAINTENANCE_COMPLETE,
    dispatch_haoligo_notification,
)
from apps.haoligo.services.mold_maintenance_complete_message_templates import (
    ensure_haoligo_mold_maintenance_complete_message_templates,
)
from apps.haoligo.services.notification_context import with_form_notify_user_ids


def _message_variables(row: HaoligoMoldMaintenanceCompleteSheet) -> dict[str, str]:
    return {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "source_order_no": (row.source_order_no or "").strip() or "—",
        "service_type": (row.service_type or "").strip() or "—",
        "applicant_name": (row.applicant_name or "").strip() or "—",
        "mold_maintenance_complete_sheet_id": str(row.id),
    }


async def _notification_context(tenant_id: int, row: HaoligoMoldMaintenanceCompleteSheet) -> dict:
    ctx: dict = {"service_type": (row.service_type or "").strip()}
    if row.applicant_user_id and int(row.applicant_user_id) > 0:
        ctx["creator_user_id"] = int(row.applicant_user_id)
    src_id = row.source_maintenance_sheet_id
    if src_id:
        src = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=int(src_id)).first()
        if src:
            if src.applicant_user_id and int(src.applicant_user_id) > 0:
                ctx["source_applicant_user_id"] = int(src.applicant_user_id)
            if src.audited_by_user_id and int(src.audited_by_user_id) > 0:
                ctx["source_auditor_user_id"] = int(src.audited_by_user_id)
    return with_form_notify_user_ids(ctx, getattr(row, "complete_notify_user_ids", None))


async def send_mold_maintenance_complete_created_messages(
    tenant_id: int,
    row: HaoligoMoldMaintenanceCompleteSheet,
) -> None:
    await ensure_haoligo_mold_maintenance_complete_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_MAINTENANCE_COMPLETE,
        trigger_action=ACTION_CREATED,
        variables=_message_variables(row),
        context=await _notification_context(tenant_id, row),
    )
