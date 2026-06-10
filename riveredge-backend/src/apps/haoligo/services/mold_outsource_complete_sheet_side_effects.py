"""好力 GO — 外协维保完修单消息提醒。"""

from __future__ import annotations

from typing import List

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
from apps.haoligo.services.notification_context import with_form_notify_user_ids
from apps.haoligo.services.spot_check_side_effects import normalize_report_user_ids
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_APPROVED,
    ACTION_REJECTED,
    ACTION_REVOKED,
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


def _merge_notify_user_ids(*groups: List[int]) -> List[int]:
    seen: set[int] = set()
    out: List[int] = []
    for group in groups:
        for uid in group:
            if uid < 1 or uid in seen:
                continue
            seen.add(uid)
            out.append(uid)
    return out


def _notification_context(row: HaoligoMoldOutsourceMaintenanceCompleteSheet) -> dict:
    ctx: dict = {
        "outsourced_unit_name": (row.outsourced_unit_name or "").strip(),
        "supplier_name": (row.outsourced_unit_name or "").strip(),
    }
    code = (row.outsourced_unit_code or "").strip()
    if code:
        ctx["outsourced_unit_code"] = code
        ctx["supplier_code"] = code
    if row.applicant_user_id and int(row.applicant_user_id) > 0:
        ctx["creator_user_id"] = int(row.applicant_user_id)
    return ctx


async def _outsource_complete_submitted_notification_context(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceCompleteSheet,
) -> dict:
    """
    外协提交维修完成：通知完修单申请人，及来源外协维保单当时的申请人/审核人（负责人）。
    """
    ctx = _notification_context(row)
    notify_ids: List[int] = []
    src_id = row.source_outsource_maintenance_sheet_id
    if src_id:
        src = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(
            id=int(src_id),
        ).first()
        if src:
            if src.applicant_user_id and int(src.applicant_user_id) > 0:
                applicant = int(src.applicant_user_id)
                ctx["creator_user_id"] = applicant
                notify_ids.append(applicant)
            if src.audited_by_user_id and int(src.audited_by_user_id) > 0:
                notify_ids.append(int(src.audited_by_user_id))
    if row.applicant_user_id and int(row.applicant_user_id) > 0:
        uid = int(row.applicant_user_id)
        ctx.setdefault("creator_user_id", uid)
        notify_ids.append(uid)
    merged = _merge_notify_user_ids(normalize_report_user_ids(notify_ids))
    ctx = with_form_notify_user_ids(ctx, merged)
    return with_form_notify_user_ids(ctx, getattr(row, "complete_notify_user_ids", None))


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
        context=await _outsource_complete_submitted_notification_context(tenant_id, row),
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


async def _outsource_complete_revoked_notification_context(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceCompleteSheet,
) -> dict:
    ctx = _notification_context(row)
    src_id = row.source_outsource_maintenance_sheet_id
    if src_id:
        src = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(
            id=int(src_id),
        ).first()
        if src:
            if src.applicant_user_id and int(src.applicant_user_id) > 0:
                ctx["source_applicant_user_id"] = int(src.applicant_user_id)
            if src.audited_by_user_id and int(src.audited_by_user_id) > 0:
                ctx["source_auditor_user_id"] = int(src.audited_by_user_id)
            ctx = with_form_notify_user_ids(ctx, getattr(src, "submitted_notify_user_ids", None))
    return ctx


async def send_outsource_complete_revoked_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceCompleteSheet,
) -> None:
    await ensure_haoligo_mold_outsource_complete_message_templates(tenant_id)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE,
        trigger_action=ACTION_REVOKED,
        variables=_message_variables(row),
        context=await _outsource_complete_revoked_notification_context(tenant_id, row),
    )
