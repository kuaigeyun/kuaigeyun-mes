"""好力 GO — 厂内维保/维修单消息提醒。"""

from __future__ import annotations

from apps.haoligo.models.mold_maintenance_sheet import HaoligoMoldMaintenanceSheet
from apps.haoligo.services.collaborative_notification_context import (
    maintenance_sheet_approved_context,
    maintenance_sheet_revoked_context,
    maintenance_sheet_submitted_context,
)
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_APPROVED,
    ACTION_REJECTED,
    ACTION_REVOKED,
    ACTION_SUBMITTED,
    DOC_MOLD_MAINTENANCE,
    dispatch_haoligo_notification,
)
from apps.haoligo.services.mold_maintenance_message_templates import (
    MOLD_MAINTENANCE_DETAIL_PATH,
    ensure_haoligo_mold_maintenance_message_templates,
)


def _message_variables(row: HaoligoMoldMaintenanceSheet) -> dict[str, str]:
    svc = (row.service_type or "").strip()
    path = MOLD_MAINTENANCE_DETAIL_PATH
    if svc == "维修":
        path = "/apps/haoligo/molds/documents/repair"
    return {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "service_type": svc or "—",
        "applicant_name": (row.applicant_name or "").strip() or "—",
        "department_name": (row.department_name or "").strip() or "—",
        "mold_maintenance_sheet_id": str(row.id),
        "detail_path": path,
    }


async def send_mold_maintenance_submitted_messages(
    tenant_id: int,
    row: HaoligoMoldMaintenanceSheet,
) -> None:
    await ensure_haoligo_mold_maintenance_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_MAINTENANCE,
        trigger_action=ACTION_SUBMITTED,
        variables=_message_variables(row),
        context=maintenance_sheet_submitted_context(row),
    )


async def send_mold_maintenance_approved_messages(
    tenant_id: int,
    row: HaoligoMoldMaintenanceSheet,
) -> None:
    await ensure_haoligo_mold_maintenance_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_MAINTENANCE,
        trigger_action=ACTION_APPROVED,
        variables=_message_variables(row),
        context=maintenance_sheet_approved_context(row),
    )


async def send_mold_maintenance_rejected_messages(
    tenant_id: int,
    row: HaoligoMoldMaintenanceSheet,
) -> None:
    await ensure_haoligo_mold_maintenance_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_MAINTENANCE,
        trigger_action=ACTION_REJECTED,
        variables=_message_variables(row),
        context=maintenance_sheet_submitted_context(row),
    )


async def send_mold_maintenance_revoked_messages(
    tenant_id: int,
    row: HaoligoMoldMaintenanceSheet,
) -> None:
    await ensure_haoligo_mold_maintenance_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_MAINTENANCE,
        trigger_action=ACTION_REVOKED,
        variables=_message_variables(row),
        context=maintenance_sheet_revoked_context(row),
    )
