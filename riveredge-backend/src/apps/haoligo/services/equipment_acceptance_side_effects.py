"""好力 GO — 设备验收单消息提醒。"""

from __future__ import annotations

from loguru import logger

from apps.haoligo.models.equipment_acceptance import HaoligoEquipmentAcceptanceRound, HaoligoEquipmentAcceptanceSheet
from apps.haoligo.services.equipment_acceptance_message_templates import (
    ensure_haoligo_equipment_acceptance_message_templates,
)
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_ACCEPTED,
    ACTION_TRIAL_FAILED,
    ACTION_TRIAL_PENDING,
    DOC_EQUIPMENT_ACCEPTANCE,
    dispatch_haoligo_notification,
)
from apps.haoligo.services.haoligo_notification_rule_presets import load_haoligo_notification_rule_presets
from apps.haoligo.services.notification_context import with_form_notify_user_ids


async def _ensure_acceptance_notification_ready(tenant_id: int) -> None:
    """确保消息模板与业务提醒规则已就绪（老租户新增单据类型时自动补齐）。"""
    await ensure_haoligo_equipment_acceptance_message_templates(tenant_id)
    await load_haoligo_notification_rule_presets(tenant_id)


def _log_if_acceptance_notification_not_sent(
    *,
    tenant_id: int,
    trigger_action: str,
    row: HaoligoEquipmentAcceptanceSheet,
    context: dict,
    sent: int,
) -> None:
    if sent > 0:
        return
    form_ids = context.get("form_notify_user_ids") or context.get("report_notify_user_ids") or []
    if not form_ids:
        return
    logger.warning(
        "设备验收单消息未发出 tenant={} action={} sheet_id={} sheet_no={} form_notify_user_ids={}",
        tenant_id,
        trigger_action,
        row.id,
        (row.sheet_no or "").strip() or f"#{row.id}",
        form_ids,
    )


def _sheet_variables(row: HaoligoEquipmentAcceptanceSheet, *, round_no: int | None = None) -> dict:
    return {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "equipment_name": (row.equipment_name or "").strip() or "—",
        "install_location": (row.install_location or "").strip() or "—",
        "manufacturer_name": (row.manufacturer_name or "").strip() or "—",
        "round_no": str(round_no if round_no is not None else row.current_round),
        "equipment_acceptance_sheet_id": str(row.id),
    }


def _base_context(row: HaoligoEquipmentAcceptanceSheet) -> dict:
    ctx: dict = {}
    if row.reporter_user_id and int(row.reporter_user_id) > 0:
        ctx["creator_user_id"] = int(row.reporter_user_id)
    commissioning_ids = getattr(row, "commissioning_user_ids", None) or []
    if isinstance(commissioning_ids, list):
        normalized = [int(x) for x in commissioning_ids if str(x).strip().isdigit() and int(x) > 0]
        if normalized:
            ctx["commissioning_user_ids"] = normalized
    return with_form_notify_user_ids(ctx, getattr(row, "submitted_notify_user_ids", None))


async def send_acceptance_trial_pending_messages(
    tenant_id: int,
    row: HaoligoEquipmentAcceptanceSheet,
) -> None:
    await _ensure_acceptance_notification_ready(tenant_id)
    ctx = _base_context(row)
    sent = await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_EQUIPMENT_ACCEPTANCE,
        trigger_action=ACTION_TRIAL_PENDING,
        variables=_sheet_variables(row),
        context=ctx,
    )
    _log_if_acceptance_notification_not_sent(
        tenant_id=tenant_id,
        trigger_action=ACTION_TRIAL_PENDING,
        row=row,
        context=ctx,
        sent=sent,
    )


async def send_acceptance_trial_failed_messages(
    tenant_id: int,
    row: HaoligoEquipmentAcceptanceSheet,
    *,
    round_row: HaoligoEquipmentAcceptanceRound | None = None,
) -> None:
    await _ensure_acceptance_notification_ready(tenant_id)
    rnd = round_row.round_no if round_row else row.current_round
    ctx = _base_context(row)
    sent = await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_EQUIPMENT_ACCEPTANCE,
        trigger_action=ACTION_TRIAL_FAILED,
        variables=_sheet_variables(row, round_no=rnd),
        context=ctx,
    )
    _log_if_acceptance_notification_not_sent(
        tenant_id=tenant_id,
        trigger_action=ACTION_TRIAL_FAILED,
        row=row,
        context=ctx,
        sent=sent,
    )


async def send_acceptance_accepted_messages(
    tenant_id: int,
    row: HaoligoEquipmentAcceptanceSheet,
) -> None:
    await _ensure_acceptance_notification_ready(tenant_id)
    ctx = _base_context(row)
    sent = await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_EQUIPMENT_ACCEPTANCE,
        trigger_action=ACTION_ACCEPTED,
        variables=_sheet_variables(row),
        context=ctx,
    )
    _log_if_acceptance_notification_not_sent(
        tenant_id=tenant_id,
        trigger_action=ACTION_ACCEPTED,
        row=row,
        context=ctx,
        sent=sent,
    )
