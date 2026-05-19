"""好力 GO — 问题登记（隐患单）上报站内信。"""

from __future__ import annotations

from typing import List, Optional

from loguru import logger

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.message_template_codes import HAOLIGO_PATROL_ISSUE_REGISTER_REPORT
from apps.haoligo.models.equipment import HaoligoEquipment, HaoligoWorkshop
from apps.haoligo.models.patrol import HaoligoHazardReport
from apps.haoligo.services.patrol_message_templates import ensure_haoligo_patrol_message_templates
from apps.haoligo.services.spot_check_side_effects import normalize_report_user_ids
from core.models.message_log import MessageLog
from core.schemas.message_template import SendMessageRequest
from core.services.data.data_dictionary_service import DataDictionaryService
from core.services.messaging.message_service import MessageService

HAOLIGO_PATROL_ISSUE_TYPE_DICT = "HAOLIGO_PATROL_ISSUE_TYPE"


async def _hazard_report_already_sent(tenant_id: int, hazard_id: int) -> bool:
    sid = str(hazard_id)
    rows = await MessageLog.filter(
        tenant_id=tenant_id,
        type="internal",
        status="success",
        deleted_at__isnull=True,
    ).order_by("-id").limit(200)
    for row in rows:
        vars_ = row.variables or {}
        if str(vars_.get("hazard_id", "")) == sid:
            return True
    return False


async def _resolve_issue_type_label(tenant_id: int, code: Optional[str]) -> str:
    raw = (code or "").strip()
    if not raw:
        return "—"
    try:
        dictionary = await DataDictionaryService.get_dictionary_by_code(
            tenant_id, HAOLIGO_PATROL_ISSUE_TYPE_DICT, use_cache=True
        )
        if not dictionary:
            return raw
        items = await DataDictionaryService.get_items_by_dictionary(
            tenant_id, str(dictionary.uuid), is_active=True
        )
        for item in items:
            if str(item.value or "").strip() == raw and (item.label or "").strip():
                return item.label.strip()
    except Exception:
        pass
    return raw


def _hazard_issue_type_codes(row: HaoligoHazardReport) -> list[str]:
    raw = getattr(row, "issue_type_codes", None) or []
    codes: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            s = str(item).strip()
            if s and s not in codes:
                codes.append(s)
    if not codes and (row.issue_type_code or "").strip():
        codes.append(str(row.issue_type_code).strip())
    return codes


async def _resolve_issue_type_labels(tenant_id: int, row: HaoligoHazardReport) -> str:
    codes = _hazard_issue_type_codes(row)
    if not codes:
        return "—"
    labels = [await _resolve_issue_type_label(tenant_id, c) for c in codes]
    return "、".join(labels)


async def _hazard_report_message_variables(
    tenant_id: int,
    row: HaoligoHazardReport,
    *,
    workshop_name: Optional[str] = None,
    equipment_label: Optional[str] = None,
) -> dict[str, str]:
    hazard_ref = (row.sheet_no or "").strip() or f"#{row.id}"
    ws_name = workshop_name or "—"
    if not workshop_name and row.workshop_id:
        ws = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=row.workshop_id).first()
        if ws:
            ws_name = (ws.name or "").strip() or f"车间#{row.workshop_id}"

    eq_label = equipment_label or "—"
    eid = getattr(row, "equipment_id", None)
    if equipment_label is None and eid:
        eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=eid).first()
        if eq:
            ac = (eq.asset_code or "").strip()
            nm = (eq.name or "").strip()
            eq_label = f"{ac} {nm}".strip() or f"设备#{eid}"

    reported_at = row.reported_at.strftime("%Y-%m-%d %H:%M") if row.reported_at else "—"
    issue_codes = _hazard_issue_type_codes(row)
    issue_type_label = await _resolve_issue_type_labels(tenant_id, row)

    return {
        "hazard_ref": hazard_ref,
        "hazard_id": str(row.id),
        "workshop_name": ws_name,
        "workshop_area": (row.workshop_area or "").strip() or "—",
        "reported_at": reported_at,
        "issue_type_label": issue_type_label,
        "issue_type_code": "、".join(issue_codes) if issue_codes else "—",
        "registrant_name": (row.registrant_name or "").strip() or "—",
        "responsible_name": (row.responsible_name or "").strip() or "—",
        "equipment_label": eq_label,
    }


async def send_hazard_report_messages(
    tenant_id: int,
    row: HaoligoHazardReport,
    user_ids: List[int],
) -> None:
    if not user_ids:
        return
    await ensure_haoligo_patrol_message_templates(tenant_id)
    variables = await _hazard_report_message_variables(tenant_id, row)
    for uid in user_ids:
        try:
            result = await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(
                    type="internal",
                    recipient=str(uid),
                    template_code=HAOLIGO_PATROL_ISSUE_REGISTER_REPORT,
                    variables=variables,
                    content="",
                ),
            )
            if not result.success:
                logger.error(
                    "问题登记上报站内信未成功 tenant={} hazard={} user={} err={}",
                    tenant_id,
                    row.id,
                    uid,
                    result.error,
                )
        except Exception as e:
            logger.error(
                "问题登记上报站内信发送失败 tenant={} hazard={} user={}: {}",
                tenant_id,
                row.id,
                uid,
                e,
            )


async def maybe_send_hazard_report_on_save(
    tenant_id: int,
    row: HaoligoHazardReport,
    *,
    report_enabled: bool,
    report_notify_user_ids: List[int],
    send_report: bool,
) -> None:
    if not send_report or not report_enabled or not report_notify_user_ids:
        return
    if await _hazard_report_already_sent(tenant_id, row.id):
        return
    await send_hazard_report_messages(tenant_id, row, report_notify_user_ids)
