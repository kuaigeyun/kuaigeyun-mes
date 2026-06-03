"""好力 GO — 外协维保完修单消息提醒。"""

from __future__ import annotations

from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_APPROVED,
    ACTION_REJECTED,
    ACTION_SUBMITTED,
    DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
    dispatch_haoligo_notification,
)
from apps.haoligo.services.mold_outsource_complete_message_templates import (
    OUTSOURCE_COMPLETE_DETAIL_PATH,
    ensure_haoligo_mold_outsource_complete_message_templates,
)


def _message_variables(row: HaoligoMoldOutsourceMaintenanceCompleteSheet) -> dict[str, str]:
    return {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "source_order_no": (row.source_order_no or "").strip() or "—",
        "outsourced_unit_name": (row.outsourced_unit_name or "").strip() or "—",
        "applicant_name": (row.applicant_name or "").strip() or "—",
        "service_type": (row.service_type or "").strip() or "—",
        "outsource_complete_sheet_id": str(row.id),
        "detail_path": OUTSOURCE_COMPLETE_DETAIL_PATH,
    }


def _notification_context(row: HaoligoMoldOutsourceMaintenanceCompleteSheet) -> dict:
    ctx: dict = {
        "outsourced_unit_name": (row.outsourced_unit_name or "").strip(),
        "supplier_name": (row.outsourced_unit_name or "").strip(),
    }
    if row.applicant_user_id and int(row.applicant_user_id) > 0:
        ctx["creator_user_id"] = int(row.applicant_user_id)
    return ctx


async def send_outsource_complete_submitted_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceCompleteSheet,
) -> None:
    await ensure_haoligo_mold_outsource_complete_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
        trigger_action=ACTION_SUBMITTED,
        variables=_message_variables(row),
        context=_notification_context(row),
    )


async def send_outsource_complete_approved_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceCompleteSheet,
) -> None:
    await ensure_haoligo_mold_outsource_complete_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
        trigger_action=ACTION_APPROVED,
        variables=_message_variables(row),
        context=_notification_context(row),
    )


async def send_outsource_complete_rejected_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceCompleteSheet,
) -> None:
    await ensure_haoligo_mold_outsource_complete_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
        trigger_action=ACTION_REJECTED,
        variables=_message_variables(row),
        context=_notification_context(row),
    )
