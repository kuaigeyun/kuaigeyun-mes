"""好力 GO — 设备维保单/完修单消息提醒。"""

from __future__ import annotations

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_upkeep import HaoligoEquipmentUpkeepCompleteSheet, HaoligoEquipmentUpkeepSheet
from apps.haoligo.services.equipment_upkeep_message_templates import (
    ensure_haoligo_equipment_upkeep_message_templates,
)
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_CREATED,
    DOC_EQUIPMENT_UPKEEP_COMPLETE,
    DOC_EQUIPMENT_UPKEEP_SHEET,
    dispatch_haoligo_notification,
)


async def _equipment_label(tenant_id: int, equipment_id: int) -> str:
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if not eq:
        return "—"
    ac = (eq.asset_code or "").strip()
    nm = (eq.name or "").strip()
    return f"{ac} {nm}".strip() or f"设备#{equipment_id}"


async def send_equipment_upkeep_sheet_created_messages(
    tenant_id: int,
    row: HaoligoEquipmentUpkeepSheet,
) -> None:
    await ensure_haoligo_equipment_upkeep_message_templates(tenant_id)
    eq_label = await _equipment_label(tenant_id, row.equipment_id)
    variables = {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "service_type": (row.service_type or "").strip() or "—",
        "applicant_name": (row.applicant_name or "").strip() or "—",
        "department_name": (row.department_name or "").strip() or "—",
        "equipment_label": eq_label,
        "equipment_upkeep_sheet_id": str(row.id),
    }
    from apps.haoligo.services.notification_context import with_form_notify_user_ids

    ctx: dict = {"service_type": (row.service_type or "").strip()}
    if row.applicant_user_id and int(row.applicant_user_id) > 0:
        ctx["creator_user_id"] = int(row.applicant_user_id)
    ctx = with_form_notify_user_ids(ctx, getattr(row, "complete_notify_user_ids", None))
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_EQUIPMENT_UPKEEP_SHEET,
        trigger_action=ACTION_CREATED,
        variables=variables,
        context=ctx,
    )


async def send_equipment_upkeep_complete_created_messages(
    tenant_id: int,
    row: HaoligoEquipmentUpkeepCompleteSheet,
) -> None:
    await ensure_haoligo_equipment_upkeep_message_templates(tenant_id)
    await row.fetch_related("source_upkeep_sheet")
    src_sheet = row.source_upkeep_sheet
    equipment_id = int(src_sheet.equipment_id) if src_sheet and src_sheet.equipment_id else 0
    eq_label = await _equipment_label(tenant_id, equipment_id) if equipment_id else "—"
    variables = {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "source_order_no": (row.source_order_no or "").strip() or "—",
        "service_type": (row.service_type or "").strip() or "—",
        "applicant_name": (row.applicant_name or "").strip() or "—",
        "equipment_label": eq_label,
        "equipment_upkeep_complete_sheet_id": str(row.id),
    }
    from apps.haoligo.services.notification_context import with_form_notify_user_ids

    ctx: dict = {}
    if src_sheet and src_sheet.applicant_user_id and int(src_sheet.applicant_user_id) > 0:
        ctx["source_applicant_user_id"] = int(src_sheet.applicant_user_id)
        ctx["creator_user_id"] = int(src_sheet.applicant_user_id)
    ctx = with_form_notify_user_ids(ctx, getattr(row, "complete_notify_user_ids", None))
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_EQUIPMENT_UPKEEP_COMPLETE,
        trigger_action=ACTION_CREATED,
        variables=variables,
        context=ctx,
    )
