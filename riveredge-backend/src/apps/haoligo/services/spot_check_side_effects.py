"""好力 GO — 点检单保存后的设备状态更新与上报站内信。"""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException, status
from loguru import logger

from apps.haoligo.constants.message_template_codes import HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_operations import (
    HaoligoEquipmentSpotCheck,
    HaoligoEquipmentSpotCheckLine,
)
from apps.haoligo.models.equipment_status_log import HaoligoEquipmentOperationalStatusLog
from apps.haoligo.services.equipment_message_templates import ensure_haoligo_equipment_message_templates
from apps.haoligo.services.equipment_operational_status import (
    format_operational_status_label,
    normalize_operational_status,
)
from core.models.message_log import MessageLog
from core.schemas.message_template import SendMessageRequest
from core.services.messaging.message_service import MessageService
from infra.models.user import User


def normalize_report_user_ids(raw: Optional[List[int]]) -> List[int]:
    if not raw:
        return []
    seen: set[int] = set()
    out: List[int] = []
    for x in raw:
        try:
            i = int(x)
        except (TypeError, ValueError):
            continue
        if i < 1 or i in seen:
            continue
        seen.add(i)
        out.append(i)
    return out


async def validate_report_notify_users(tenant_id: int, user_ids: List[int]) -> None:
    if not user_ids:
        return
    count = await User.filter(
        tenant_id=tenant_id, id__in=user_ids, deleted_at__isnull=True, is_active=True
    ).count()
    if count != len(user_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="部分上报接收人不存在或已停用",
        )


async def apply_spot_check_equipment_status(
    tenant_id: int,
    equipment: HaoligoEquipment,
    status_value: Optional[str],
    changed_by_user_id: int,
) -> tuple[Optional[str], Optional[str]]:
    """将点检单指定的运行状态写入设备台账。返回 (调整后状态 value, 调整前状态 value)。"""
    normalized = await normalize_operational_status(tenant_id, status_value)
    if not normalized:
        return None, equipment.operational_status
    old_status = equipment.operational_status
    if (old_status or "").strip().lower() == normalized:
        return normalized, old_status
    equipment.operational_status = normalized
    await equipment.save()
    await HaoligoEquipmentOperationalStatusLog.create(
        tenant_id=tenant_id,
        equipment_id=equipment.id,
        old_status=old_status,
        new_status=normalized,
        changed_by_user_id=changed_by_user_id,
    )
    return normalized, old_status


def _format_measured_display(ln: HaoligoEquipmentSpotCheckLine) -> str:
    mv = (ln.measured_value or "").strip()
    if not mv:
        return "—"
    unit = (ln.unit or "").strip()
    return f"{mv}{unit}" if unit else mv


async def _format_abnormal_items_summary(
    tenant_id: int,
    header_id: int,
) -> str:
    lines = (
        await HaoligoEquipmentSpotCheckLine.filter(
            tenant_id=tenant_id,
            header_id=header_id,
            deleted_at__isnull=True,
            result="abnormal",
        )
        .order_by("sort_order", "id")
        .all()
    )
    if not lines:
        return "无"
    parts: List[str] = []
    for ln in lines:
        name = (ln.param_name or ln.param_code or "点检项").strip()
        measured = _format_measured_display(ln)
        remark = (ln.remark or "").strip()
        line = f"• {name}：正常 → 异常（实测：{measured}）"
        if remark:
            line += f"，说明：{remark}"
        parts.append(line)
    return "\n".join(parts)


async def _format_equipment_status_change(
    tenant_id: int,
    *,
    old_status: Optional[str],
    new_status: Optional[str],
    requested_status: Optional[str],
) -> str:
    if not requested_status or not str(requested_status).strip():
        return "未填写调整状态"
    old_label = await format_operational_status_label(tenant_id, old_status, empty_label="未设置")
    new_label = await format_operational_status_label(
        tenant_id, new_status or requested_status, empty_label="未设置"
    )
    if (old_status or "").strip().lower() == (new_status or requested_status or "").strip().lower():
        return f"无变更（当前：{new_label}）"
    return f"{old_label} → {new_label}"


async def _spot_check_report_already_sent(tenant_id: int, spot_check_id: int) -> bool:
    sid = str(spot_check_id)
    rows = await MessageLog.filter(
        tenant_id=tenant_id,
        type="internal",
        status="success",
        deleted_at__isnull=True,
    ).order_by("-id").limit(200)
    for row in rows:
        vars_ = row.variables or {}
        if str(vars_.get("spot_check_id", "")) == sid:
            return True
    return False


async def _spot_check_report_message_variables(
    tenant_id: int,
    header: HaoligoEquipmentSpotCheck,
    equipment: HaoligoEquipment,
    *,
    equipment_status_before: Optional[str],
    equipment_status_after: Optional[str],
    requested_equipment_status: Optional[str],
) -> dict[str, str]:
    sheet = (header.sheet_no or "").strip() or f"#{header.id}"
    asset = (equipment.asset_code or "").strip()
    name = (equipment.name or "").strip()
    eq_label = f"{asset} {name}".strip() or f"设备#{equipment.id}"
    recorded_at = ""
    if header.recorded_at:
        recorded_at = header.recorded_at.strftime("%Y-%m-%d %H:%M")
    reporter_name = "—"
    reporter = await User.filter(
        id=header.reporter_user_id, tenant_id=tenant_id, deleted_at__isnull=True
    ).first()
    if reporter:
        reporter_name = (reporter.full_name or "").strip() or reporter.username or str(reporter.id)

    abnormal_summary = await _format_abnormal_items_summary(tenant_id, header.id)
    status_change = await _format_equipment_status_change(
        tenant_id,
        old_status=equipment_status_before,
        new_status=equipment_status_after,
        requested_status=requested_equipment_status,
    )

    return {
        "sheet_no": sheet,
        "equipment_label": eq_label,
        "equipment_asset_code": asset or "—",
        "equipment_name": name or "—",
        "recorded_at": recorded_at or "—",
        "reporter_name": reporter_name,
        "spot_check_id": str(header.id),
        "abnormal_items_summary": abnormal_summary,
        "equipment_status_change": status_change,
    }


async def send_spot_check_report_messages(
    tenant_id: int,
    header: HaoligoEquipmentSpotCheck,
    equipment: HaoligoEquipment,
    user_ids: List[int],
    *,
    equipment_status_before: Optional[str],
    equipment_status_after: Optional[str],
    requested_equipment_status: Optional[str],
) -> None:
    if not user_ids:
        return
    await ensure_haoligo_equipment_message_templates(tenant_id)
    variables = await _spot_check_report_message_variables(
        tenant_id,
        header,
        equipment,
        equipment_status_before=equipment_status_before,
        equipment_status_after=equipment_status_after,
        requested_equipment_status=requested_equipment_status,
    )
    for uid in user_ids:
        try:
            result = await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(
                    type="internal",
                    recipient=str(uid),
                    template_code=HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT,
                    variables=variables,
                    content="",
                ),
            )
            if not result.success:
                logger.error(
                    "点检单上报站内信未成功 tenant={} spot_check={} user={} err={}",
                    tenant_id,
                    header.id,
                    uid,
                    result.error,
                )
        except Exception as e:
            logger.error("点检单上报站内信发送失败 tenant={} spot_check={} user={}: {}", tenant_id, header.id, uid, e)
