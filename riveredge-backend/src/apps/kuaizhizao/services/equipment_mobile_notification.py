"""快制造设备 — 移动端报修/督促类通知（站内信 + 可选企微）。"""

from __future__ import annotations

from datetime import date
from typing import Any, List

from loguru import logger

from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.equipment_fault import EquipmentFault
from apps.kuaizhizao.models.maintenance_reminder import MaintenanceReminder
from core.schemas.message_template import SendMessageRequest
from core.services.messaging.message_service import MessageService
from core.services.messaging.wecom_message_service import send_wecom_text_message
from infra.models.user import User
from infra.services.business_config_service import BusinessConfigService


def _normalize_user_ids(raw: Any) -> List[int]:
    if raw is None:
        return []
    if isinstance(raw, (int, str)):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    out: List[int] = []
    seen: set[int] = set()
    for item in raw:
        try:
            uid = int(item)
        except (TypeError, ValueError):
            continue
        if uid < 1 or uid in seen:
            continue
        seen.add(uid)
        out.append(uid)
    return out


async def _resolve_equipment_notify_user_ids(tenant_id: int, config_key: str) -> List[int]:
    config = await BusinessConfigService.get_business_config(tenant_id)
    params = config.get("parameters") if isinstance(config, dict) else {}
    if not isinstance(params, dict):
        return []
    kuaizhizao = params.get("kuaizhizao")
    if not isinstance(kuaizhizao, dict):
        return []
    equipment = kuaizhizao.get("equipment")
    if not isinstance(equipment, dict):
        return []
    return _normalize_user_ids(equipment.get(config_key))


def _extract_wecom_user_id(user: User) -> str | None:
    contact = user.contact_info if isinstance(user.contact_info, dict) else {}
    for key in ("wecom_userid", "wecom_user_id", "wx_work_userid"):
        value = contact.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


async def _send_to_notify_users(
    *,
    tenant_id: int,
    user_ids: List[int],
    subject: str,
    content: str,
) -> None:
    if not user_ids:
        return
    for uid in user_ids:
        try:
            await MessageService.send_message(
                tenant_id,
                SendMessageRequest(
                    type="internal",
                    recipient=str(uid),
                    subject=subject,
                    content=content,
                ),
            )
        except Exception as exc:
            logger.warning("设备通知站内信发送失败 tenant={} user={}: {}", tenant_id, uid, exc)

    users = await User.filter(
        tenant_id=tenant_id,
        id__in=user_ids,
        deleted_at__isnull=True,
        is_active=True,
    )
    wecom_ids = [wid for u in users if (wid := _extract_wecom_user_id(u))]
    if not wecom_ids:
        return
    try:
        await send_wecom_text_message(
            tenant_id=tenant_id,
            user_ids=wecom_ids,
            content=content,
        )
    except Exception as exc:
        logger.warning("设备通知企微发送失败 tenant={}: {}", tenant_id, exc)


async def notify_equipment_fault_reported(
    *,
    tenant_id: int,
    fault: EquipmentFault,
    reporter: User | None = None,
) -> None:
    """报修成功后通知负责人：站内信 + 已绑定企微 userid 的用户。"""
    user_ids = await _resolve_equipment_notify_user_ids(tenant_id, "fault_report_notify_user_ids")
    if not user_ids:
        logger.info("租户 {} 未配置 equipment.fault_report_notify_user_ids，跳过报修通知", tenant_id)
        return

    equipment_label = (fault.equipment_name or fault.equipment_uuid or "").strip() or "设备"
    fault_no = (fault.fault_no or "").strip() or str(fault.uuid)
    reporter_name = (fault.reporter_name or "").strip()
    if not reporter_name and reporter:
        reporter_name = (reporter.full_name or reporter.username or "").strip()
    content = (
        f"【设备报修】{equipment_label}\n"
        f"故障单号：{fault_no}\n"
        f"级别：{fault.fault_level}\n"
        f"类型：{fault.fault_type}\n"
        f"描述：{fault.fault_description}\n"
        f"报告人：{reporter_name or '—'}"
    )
    subject = f"设备报修：{equipment_label}"
    await _send_to_notify_users(
        tenant_id=tenant_id,
        user_ids=user_ids,
        subject=subject,
        content=content,
    )


async def notify_spot_check_overdue_supervision(
    *,
    tenant_id: int,
    equipments: list[Equipment],
    subject: str,
    check_date: date,
) -> None:
    """督促完成点检（站内信 + 企微）。"""
    user_ids = await _resolve_equipment_notify_user_ids(
        tenant_id,
        "spot_check_overdue_notify_user_ids",
    )
    if not user_ids:
        logger.info(
            "租户 {} 未配置 equipment.spot_check_overdue_notify_user_ids，跳过点检督促",
            tenant_id,
        )
        return
    if not equipments:
        return

    lines = [f"【设备点检督促】以下设备在 {check_date.isoformat()} 尚未完成点检："]
    for eq in equipments[:50]:
        code = (eq.code or "").strip()
        name = (eq.name or "").strip()
        label = f"{code} {name}".strip() or str(eq.uuid)
        lines.append(f"- {label}")
    if len(equipments) > 50:
        lines.append(f"… 共 {len(equipments)} 台，请登录系统查看。")
    else:
        lines.append(f"共 {len(equipments)} 台，请尽快完成点检。")
    content = "\n".join(lines)
    await _send_to_notify_users(
        tenant_id=tenant_id,
        user_ids=user_ids,
        subject=subject,
        content=content,
    )


async def notify_maintenance_overdue_supervision(
    *,
    tenant_id: int,
    reminders: list[MaintenanceReminder],
    subject: str | None = None,
    subject_tag: str = "daily",
) -> None:
    """督促完成保养（站内信 + 企微）。"""
    user_ids = await _resolve_equipment_notify_user_ids(
        tenant_id,
        "maintenance_overdue_notify_user_ids",
    )
    if not user_ids:
        logger.info(
            "租户 {} 未配置 equipment.maintenance_overdue_notify_user_ids，跳过保养督促",
            tenant_id,
        )
        return
    overdue = [r for r in reminders if r.reminder_type == "overdue"]
    if not overdue:
        return

    if subject is None:
        subject = f"设备保养督促:{date.today().isoformat()}"
        if subject_tag == "new" and len(overdue) == 1:
            subject = f"设备保养督促:{overdue[0].uuid}"

    lines = ["【设备保养督促】以下设备维护计划已逾期，请尽快处理："]
    for reminder in overdue[:50]:
        name = (reminder.equipment_name or reminder.equipment_code or "").strip() or "设备"
        days = reminder.days_until_due
        overdue_days = abs(days) if isinstance(days, int) and days < 0 else 0
        suffix = f"（逾期 {overdue_days} 天）" if overdue_days else ""
        lines.append(f"- {name}{suffix}")
    if len(overdue) > 50:
        lines.append(f"… 共 {len(overdue)} 条，请登录系统查看。")
    else:
        lines.append(f"共 {len(overdue)} 条。")
    content = "\n".join(lines)
    await _send_to_notify_users(
        tenant_id=tenant_id,
        user_ids=user_ids,
        subject=subject,
        content=content,
    )
