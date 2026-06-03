"""好力 GO — 外协维保单消息提醒（业务配置 rules）。"""

from __future__ import annotations

from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_APPROVED,
    ACTION_REJECTED,
    ACTION_SUBMITTED,
    DOC_OUTSOURCE_MAINTENANCE,
    dispatch_haoligo_notification,
)
from apps.haoligo.services.outsource_maintenance_message_templates import (
    OUTSOURCE_MAINTENANCE_DETAIL_PATH,
    ensure_haoligo_outsource_maintenance_message_templates,
)


def _message_variables(row: HaoligoMoldOutsourceMaintenanceSheet) -> dict[str, str]:
    return {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "outsourced_unit_name": (row.outsourced_unit_name or "").strip() or "—",
        "applicant_name": (row.applicant_name or "").strip() or "—",
        "service_type": (row.service_type or "").strip() or "—",
        "outsource_maintenance_sheet_id": str(row.id),
        "detail_path": OUTSOURCE_MAINTENANCE_DETAIL_PATH,
    }


def _notification_context(row: HaoligoMoldOutsourceMaintenanceSheet) -> dict:
    ctx: dict = {
        "outsourced_unit_name": (row.outsourced_unit_name or "").strip(),
        "supplier_name": (row.outsourced_unit_name or "").strip(),
    }
    if row.applicant_user_id and int(row.applicant_user_id) > 0:
        ctx["creator_user_id"] = int(row.applicant_user_id)
    return ctx


async def send_outsource_maintenance_pending_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceSheet,
) -> None:
    await ensure_haoligo_outsource_maintenance_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_OUTSOURCE_MAINTENANCE,
        trigger_action=ACTION_SUBMITTED,
        variables=_message_variables(row),
        context=_notification_context(row),
    )


async def send_outsource_maintenance_approved_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceSheet,
) -> None:
    await ensure_haoligo_outsource_maintenance_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_OUTSOURCE_MAINTENANCE,
        trigger_action=ACTION_APPROVED,
        variables=_message_variables(row),
        context=_notification_context(row),
    )


async def send_outsource_maintenance_rejected_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceSheet,
) -> None:
    await ensure_haoligo_outsource_maintenance_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_OUTSOURCE_MAINTENANCE,
        trigger_action=ACTION_REJECTED,
        variables=_message_variables(row),
        context=_notification_context(row),
    )
