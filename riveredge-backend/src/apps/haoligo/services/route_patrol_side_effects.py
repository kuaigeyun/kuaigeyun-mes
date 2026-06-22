"""好力 GO — 路线巡检单保存后的设备状态更新与上报站内信。"""

from __future__ import annotations

from typing import List, Optional

from loguru import logger

from apps.haoligo.constants.message_template_codes import HAOLIGO_EQUIPMENT_ROUTE_PATROL_REPORT
from apps.haoligo.constants.route_patrol_line_status import ROUTE_PATROL_LINE_STATUS_ABNORMAL
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_operations import (
    HaoligoEquipmentRoutePatrol,
    HaoligoEquipmentRoutePatrolLine,
)
from apps.haoligo.services.equipment_message_templates import ensure_haoligo_equipment_message_templates
from apps.haoligo.services.equipment_operational_status import format_operational_status_label
from apps.haoligo.services.spot_check_side_effects import (
    apply_spot_check_equipment_status,
    normalize_report_user_ids,
)
from core.models.message_log import MessageLog
from infra.models.user import User


async def _format_abnormal_patrol_lines_summary(
    tenant_id: int,
    header_id: int,
) -> str:
    lines = (
        await HaoligoEquipmentRoutePatrolLine.filter(
            tenant_id=tenant_id,
            header_id=header_id,
            deleted_at__isnull=True,
            line_status=ROUTE_PATROL_LINE_STATUS_ABNORMAL,
        )
        .order_by("sequence", "id")
        .all()
    )
    if not lines:
        return "无"
    parts: List[str] = []
    for ln in lines:
        label = f"{(ln.asset_code or '').strip()} {(ln.equipment_name or '').strip()}".strip() or f"设备#{ln.equipment_id}"
        desc = (ln.abnormal_description or "").strip()
        line = f"• 顺序{ln.sequence} {label}：正常 → 异常"
        if desc:
            line += f"（说明：{desc}）"
        parts.append(line)
    return "\n".join(parts)


async def _format_patrol_status_changes_summary(
    tenant_id: int,
    changes: List[tuple[str, Optional[str], Optional[str]]],
) -> str:
    """changes: (设备标签, 调整前 value, 调整后 value)"""
    if not changes:
        return "无"
    parts: List[str] = []
    for label, old_v, new_v in changes:
        if not new_v or not str(new_v).strip():
            continue
        old_label = await format_operational_status_label(tenant_id, old_v, empty_label="未设置")
        new_label = await format_operational_status_label(tenant_id, new_v, empty_label="未设置")
        if (old_v or "").strip().lower() == (new_v or "").strip().lower():
            parts.append(f"• {label}：无变更（当前：{new_label}）")
        else:
            parts.append(f"• {label}：{old_label} → {new_label}")
    return "\n".join(parts) if parts else "无"


async def apply_route_patrol_line_equipment_statuses(
    tenant_id: int,
    lines: List[HaoligoEquipmentRoutePatrolLine],
    *,
    line_status_by_id: dict[int, Optional[str]],
    actor_user_id: int,
) -> List[tuple[str, Optional[str], Optional[str]]]:
    """按行应用运行状态，返回用于消息的设备状态变更列表。"""
    changes: List[tuple[str, Optional[str], Optional[str]]] = []
    if not line_status_by_id:
        return changes
    equipment_ids = {ln.equipment_id for ln in lines if ln.id in line_status_by_id}
    equipments = {
        e.id: e
        for e in await HaoligoEquipment.filter(
            tenant_id=tenant_id, id__in=list(equipment_ids), deleted_at__isnull=True
        ).all()
    }
    for ln in lines:
        raw = line_status_by_id.get(ln.id)
        if raw is None or not str(raw).strip():
            continue
        eq = equipments.get(ln.equipment_id)
        if not eq:
            continue
        label = f"{(ln.asset_code or '').strip()} {(ln.equipment_name or '').strip()}".strip() or f"设备#{ln.equipment_id}"
        old_before = eq.operational_status
        new_status, _old = await apply_spot_check_equipment_status(
            tenant_id, eq, str(raw).strip(), actor_user_id
        )
        if new_status:
            ln.applied_operational_status = new_status
            await ln.save(update_fields=["applied_operational_status"])
            changes.append((label, old_before, new_status))
    return changes


async def _route_patrol_report_already_sent(tenant_id: int, route_patrol_id: int) -> bool:
    sid = str(route_patrol_id)
    rows = await MessageLog.filter(
        tenant_id=tenant_id,
        type="internal",
        status="success",
        deleted_at__isnull=True,
    ).order_by("-id").limit(200)
    for row in rows:
        vars_ = row.variables or {}
        if str(vars_.get("route_patrol_id", "")) == sid:
            return True
    return False


async def _route_patrol_report_message_variables(
    tenant_id: int,
    header: HaoligoEquipmentRoutePatrol,
    *,
    status_changes: List[tuple[str, Optional[str], Optional[str]]],
) -> dict[str, str]:
    await header.fetch_related("patrol_route")
    pr = header.patrol_route
    route_code = (pr.code if pr else "") or ""
    route_name = (pr.name if pr else "") or ""
    route_label = f"{route_code} {route_name}".strip() or f"路线#{header.patrol_route_id}"
    sheet = (header.sheet_no or "").strip() or f"#{header.id}"
    recorded_at = header.recorded_at.strftime("%Y-%m-%d %H:%M") if header.recorded_at else "—"
    reporter_name = "—"
    reporter = await User.filter(
        id=header.reporter_user_id, tenant_id=tenant_id, deleted_at__isnull=True
    ).first()
    if reporter:
        reporter_name = (reporter.full_name or "").strip() or reporter.username or str(reporter.id)

    abnormal_summary = await _format_abnormal_patrol_lines_summary(tenant_id, header.id)
    status_summary = await _format_patrol_status_changes_summary(tenant_id, status_changes)

    return {
        "sheet_no": sheet,
        "patrol_route_label": route_label,
        "patrol_route_code": route_code or "—",
        "patrol_route_name": route_name or "—",
        "recorded_at": recorded_at,
        "reporter_name": reporter_name,
        "route_patrol_id": str(header.id),
        "abnormal_items_summary": abnormal_summary,
        "equipment_status_changes_summary": status_summary,
    }


async def send_route_patrol_report_messages(
    tenant_id: int,
    header: HaoligoEquipmentRoutePatrol,
    user_ids: List[int],
    *,
    status_changes: List[tuple[str, Optional[str], Optional[str]]],
) -> None:
    del user_ids
    from apps.haoligo.services.haoligo_business_notification import (
        ACTION_REPORTED,
        DOC_EQUIPMENT_ROUTE_PATROL,
        dispatch_haoligo_notification,
    )

    await ensure_haoligo_equipment_message_templates(tenant_id)
    variables = await _route_patrol_report_message_variables(
        tenant_id, header, status_changes=status_changes
    )
    from apps.haoligo.services.notification_context import with_form_notify_user_ids

    ctx: dict = {}
    if header.reporter_user_id and int(header.reporter_user_id) > 0:
        ctx["reporter_user_id"] = int(header.reporter_user_id)
        ctx["creator_user_id"] = int(header.reporter_user_id)
    ctx = with_form_notify_user_ids(ctx, header.report_notify_user_ids)
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=DOC_EQUIPMENT_ROUTE_PATROL,
        trigger_action=ACTION_REPORTED,
        variables=variables,
        context=ctx,
    )
