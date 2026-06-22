"""好力 GO — 设备产出单保存后的站内信通知。"""

from __future__ import annotations

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_operations import HaoligoEquipmentOutputRecord
from apps.haoligo.services.equipment_output_message_templates import (
    ensure_haoligo_equipment_output_message_templates,
)
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_CREATED,
    DOC_EQUIPMENT_OUTPUT_RECORD,
    dispatch_haoligo_notification,
)
from apps.haoligo.services.notification_context import with_form_notify_user_ids
from apps.haoligo.utils.equipment_output_qty import normalize_equipment_output_qty
from infra.models.user import User


async def _equipment_label(tenant_id: int, equipment_id: int) -> str:
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if not eq:
        return "—"
    ac = (eq.asset_code or "").strip()
    nm = (eq.name or "").strip()
    return f"{ac} {nm}".strip() or f"设备#{equipment_id}"


async def _reporter_name(tenant_id: int, reporter_user_id: int | None) -> str:
    if not reporter_user_id:
        return "—"
    user = await User.filter(
        tenant_id=tenant_id,
        id=int(reporter_user_id),
        deleted_at__isnull=True,
    ).first()
    if not user:
        return "—"
    return (user.full_name or user.username or "").strip() or "—"


def _format_qty(value) -> str:
    normalized = normalize_equipment_output_qty(value)
    if normalized is None:
        return "—"
    return str(normalized)


async def send_equipment_output_record_saved_messages(
    tenant_id: int,
    row: HaoligoEquipmentOutputRecord,
) -> None:
    await ensure_haoligo_equipment_output_message_templates(tenant_id)
    eq_label = await _equipment_label(tenant_id, row.equipment_id)
    recorded_at = row.recorded_at.strftime("%Y-%m-%d %H:%M") if row.recorded_at else "—"
    fp_code = (row.finished_product_code or row.customer_name or "").strip() or "—"
    fp_name = (row.finished_product_name or row.product_name or "").strip() or "—"
    variables = {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "equipment_label": eq_label,
        "work_order_no": (row.work_order_no or "").strip() or "—",
        "finished_product_code": fp_code,
        "finished_product_name": fp_name,
        "planned_qty": _format_qty(row.planned_qty),
        "completed_qty": _format_qty(row.completed_qty),
        "recorded_at": recorded_at,
        "operator_name": (row.operator_name or "").strip() or "—",
        "team_leader_name": (row.team_leader_name or "").strip() or "—",
        "reporter_name": await _reporter_name(tenant_id, row.reporter_user_id),
        "equipment_output_record_id": str(row.id),
    }
    ctx: dict = {}
    if row.reporter_user_id and int(row.reporter_user_id) > 0:
        ctx["reporter_user_id"] = int(row.reporter_user_id)
        ctx["creator_user_id"] = int(row.reporter_user_id)
    ctx = with_form_notify_user_ids(ctx, getattr(row, "notify_user_ids", None))
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_EQUIPMENT_OUTPUT_RECORD,
        trigger_action=ACTION_CREATED,
        variables=variables,
        context=ctx,
    )
