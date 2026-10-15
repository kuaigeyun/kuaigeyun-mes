"""设备点检未点检/未审核超时提醒（INF-03 / R-10 WP-10.6）。"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional, Tuple
from zoneinfo import ZoneInfo

from loguru import logger

from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.equipment_ops import (
    EquipmentInspectionScheme,
    EquipmentSchemeBinding,
    EquipmentSpotCheck,
)
from apps.kuaizhizao.services.kuaizhizao_business_notification import (
    ACTION_DUE_OVERDUE,
    ACTION_SUBMITTED,
    DOC_EQUIPMENT_SPOT_CHECK,
    dispatch_kuaizhizao_notification,
)
from core.models.reminder_event import ReminderEvent
from core.services.business.reminder_dispatch_service import (
    register_reminder_handler,
    register_reminder_preparer,
)
from core.services.business.reminder_event_service import ReminderEventService
from core.utils.timezone_utils import (
    resolve_business_datetime,
    site_timezone_name,
    to_api_isoformat,
    to_site_date,
)

DOC_SPOT_CHECK = DOC_EQUIPMENT_SPOT_CHECK
ENTITY_SPOT_CHECK = "equipment_spot_check"
ENTITY_BINDING = "equipment_scheme_binding"
RULE_PREFIX = "kuaizhizao.spot_check"
RULE_INCOMPLETE = f"{RULE_PREFIX}.incomplete_overdue"
RULE_REVIEW = f"{RULE_PREFIX}.review_overdue"
RULE_TASK = f"{RULE_PREFIX}.task_overdue"
CHANNEL_INTERNAL = "internal"
VALID_DONE_STATUSES = ("待审核", "已审核")


def _site_tz() -> ZoneInfo:
    return ZoneInfo(site_timezone_name())


def _site_today() -> date:
    return to_site_date(resolve_business_datetime())


def _period_key_and_start(cycle_type: Optional[str], day: date) -> Tuple[str, date]:
    cycle = (cycle_type or "每天").strip()
    if cycle in ("每班", "每天"):
        return day.isoformat(), day
    if cycle == "每周":
        monday = day - timedelta(days=day.weekday())
        iso = monday.isocalendar()
        return f"{iso.year}-W{iso.week:02d}", monday
    if cycle == "每月":
        start = day.replace(day=1)
        return f"{start.year}-{start.month:02d}", start
    if cycle == "每季度":
        quarter = (day.month - 1) // 3 + 1
        start = day.replace(month=(quarter - 1) * 3 + 1, day=1)
        return f"{start.year}-Q{quarter}", start
    return day.isoformat(), day


def _period_end(cycle_type: Optional[str], period_start: date) -> date:
    cycle = (cycle_type or "每天").strip()
    if cycle in ("每班", "每天"):
        return period_start
    if cycle == "每周":
        return period_start + timedelta(days=6)
    if cycle == "每月":
        if period_start.month == 12:
            return date(period_start.year + 1, 1, 1) - timedelta(days=1)
        return date(period_start.year, period_start.month + 1, 1) - timedelta(days=1)
    if cycle == "每季度":
        end_month = period_start.month + 3
        end_year = period_start.year
        if end_month > 12:
            end_month -= 12
            end_year += 1
        return date(end_year, end_month, 1) - timedelta(days=1)
    return period_start


def _site_datetime_utc(day: date, *, hour: int = 0, minute: int = 0) -> datetime:
    local = datetime(day.year, day.month, day.day, hour, minute, 0, tzinfo=_site_tz())
    return local.astimezone(timezone.utc)


class SpotCheckReminderService:
    @staticmethod
    async def stop_review_reminders(tenant_id: int, spot_check_id: int, *, reason: str) -> int:
        return await ReminderEventService.stop_future_for_entity(
            tenant_id,
            entity_type=ENTITY_SPOT_CHECK,
            entity_id=spot_check_id,
            reason=reason,
        )

    @staticmethod
    async def stop_incomplete_for_period(
        tenant_id: int,
        *,
        binding_id: int,
        period_key: str,
        reason: str,
    ) -> None:
        await ReminderEventService.stop_future_for_entity(
            tenant_id,
            entity_type=ENTITY_BINDING,
            entity_id=binding_id,
            rule_id=f"{RULE_INCOMPLETE}:{binding_id}:{period_key}",
            reason=reason,
        )

    @staticmethod
    async def on_spot_check_created(
        tenant_id: int,
        header: EquipmentSpotCheck,
        scheme: Optional[EquipmentInspectionScheme],
    ) -> None:
        if header.status != "待审核":
            return
        period_key, _ = _period_key_and_start(
            scheme.cycle_type if scheme else None, header.check_date
        )
        bindings = [] if not scheme else await EquipmentSchemeBinding.filter(
            tenant_id=tenant_id,
            equipment_id=header.equipment_id,
            scheme_id=scheme.id,
            scheme_type="spot_check",
            deleted_at__isnull=True,
        ).all()
        for binding in bindings:
            await SpotCheckReminderService.stop_incomplete_for_period(
                tenant_id,
                binding_id=binding.id,
                period_key=period_key,
                reason="本周期已提交点检",
            )

        hours = int(getattr(scheme, "review_overdue_hours", None) or 4)
        planned = resolve_business_datetime() + timedelta(hours=hours)
        await ReminderEventService.ensure_event(
            tenant_id,
            rule_id=f"{RULE_REVIEW}:{header.id}",
            rule_code=RULE_REVIEW,
            entity_type=ENTITY_SPOT_CHECK,
            entity_id=header.id,
            entity_uuid=str(header.uuid),
            planned_at=planned,
            channel=CHANNEL_INTERNAL,
            payload={
                "kind": "review_overdue",
                "document_no": header.document_no,
                "equipment_code": header.equipment_code,
                "equipment_name": header.equipment_name,
                "check_date": header.check_date.isoformat(),
                "reviewer_user_id": header.reviewer_user_id,
            },
        )

        await dispatch_kuaizhizao_notification(
            tenant_id,
            trigger_document=DOC_SPOT_CHECK,
            trigger_action=ACTION_SUBMITTED,
            variables={
                "document_no": header.document_no,
                "equipment_code": header.equipment_code or "",
                "equipment_name": header.equipment_name or "",
                "check_date": header.check_date.isoformat(),
                "inspector_name": header.inspector_name or "",
                "detail_path": "/apps/kuaizhizao/equipment-management/spot-checks",
            },
            context={
                "creator_user_id": header.inspector_id,
                "assignee_user_id": header.reviewer_user_id,
            },
        )

    @staticmethod
    async def on_spot_check_reviewed(tenant_id: int, header: EquipmentSpotCheck) -> None:
        await SpotCheckReminderService.stop_review_reminders(
            tenant_id, header.id, reason=f"点检已{header.status}"
        )

    @staticmethod
    async def schedule_incomplete_for_binding(
        tenant_id: int,
        binding: EquipmentSchemeBinding,
        scheme: EquipmentInspectionScheme,
        equipment: Equipment,
        *,
        day: Optional[date] = None,
    ) -> None:
        if not scheme.is_active:
            return
        today = day or _site_today()
        period_key, period_start = _period_key_and_start(scheme.cycle_type, today)
        overdue_hours = int(getattr(scheme, "overdue_hours", None) or 8)
        planned = _site_datetime_utc(period_start) + timedelta(hours=overdue_hours)
        if planned > resolve_business_datetime() + timedelta(days=2):
            return

        period_end = _period_end(scheme.cycle_type, period_start)

        exists = await EquipmentSpotCheck.filter(
            tenant_id=tenant_id,
            equipment_id=equipment.id,
            scheme_id=scheme.id,
            check_date__gte=period_start,
            check_date__lte=period_end,
            status__in=list(VALID_DONE_STATUSES),
            deleted_at__isnull=True,
        ).exists()
        if exists:
            await SpotCheckReminderService.stop_incomplete_for_period(
                tenant_id,
                binding_id=binding.id,
                period_key=period_key,
                reason="本周期已有点检",
            )
            return

        await ReminderEventService.ensure_event(
            tenant_id,
            rule_id=f"{RULE_INCOMPLETE}:{binding.id}:{period_key}",
            rule_code=RULE_INCOMPLETE,
            entity_type=ENTITY_BINDING,
            entity_id=binding.id,
            entity_uuid=str(binding.uuid),
            planned_at=planned,
            channel=CHANNEL_INTERNAL,
            payload={
                "kind": "incomplete_overdue",
                "period_key": period_key,
                "equipment_id": equipment.id,
                "equipment_code": equipment.code,
                "equipment_name": equipment.name,
                "scheme_id": scheme.id,
                "scheme_code": scheme.code,
                "scheme_name": scheme.name,
                "cycle_type": scheme.cycle_type,
                "check_date": today.isoformat(),
                "reviewer_user_id": scheme.reviewer_user_id,
            },
        )


async def dispatch_spot_check_reminder(
    tenant_id: int, event: ReminderEvent
) -> Literal["sent", "stopped"]:
    payload = event.payload or {}
    kind = str(payload.get("kind") or "")

    if event.rule_code == RULE_TASK:
        header = await EquipmentSpotCheck.filter(
            tenant_id=tenant_id, id=event.entity_id, deleted_at__isnull=True,
        ).first()
        if not header or header.status not in ("待执行", "已驳回"):
            await ReminderEventService.mark_stopped(tenant_id, event.id, "任务已提交、取消或不可用")
            return "stopped"
        await dispatch_kuaizhizao_notification(
            tenant_id, trigger_document=DOC_SPOT_CHECK,
            trigger_action=ACTION_DUE_OVERDUE,
            variables={
                "document_no": header.document_no,
                "equipment_code": header.equipment_code or "",
                "equipment_name": header.equipment_name or "",
                "check_date": header.check_date.isoformat(),
                "reminder_kind": "计划点检任务超时",
                "detail_path": f"/apps/kuaizhizao/equipment-management/spot-checks?uuid={header.uuid}",
            },
            context={"creator_user_id": header.inspector_id, "assignee_user_id": header.inspector_id},
        )
        return "sent"

    if event.rule_code == RULE_REVIEW or kind == "review_overdue":
        header = await EquipmentSpotCheck.filter(
            tenant_id=tenant_id, id=event.entity_id, deleted_at__isnull=True
        ).first()
        if not header:
            await ReminderEventService.mark_stopped(tenant_id, event.id, "点检单已删除")
            return "stopped"
        if header.status != "待审核":
            await ReminderEventService.mark_stopped(tenant_id, event.id, f"状态已为{header.status}")
            return "stopped"
        await dispatch_kuaizhizao_notification(
            tenant_id,
            trigger_document=DOC_SPOT_CHECK,
            trigger_action=ACTION_DUE_OVERDUE,
            variables={
                "document_no": header.document_no,
                "equipment_code": header.equipment_code or "",
                "equipment_name": header.equipment_name or "",
                "check_date": header.check_date.isoformat(),
                "reminder_kind": "未审核超时",
                "detail_path": "/apps/kuaizhizao/equipment-management/spot-checks",
            },
            context={
                "creator_user_id": header.inspector_id,
                "assignee_user_id": header.reviewer_user_id,
            },
        )
        return "sent"

    binding = await EquipmentSchemeBinding.filter(
        tenant_id=tenant_id, id=event.entity_id, deleted_at__isnull=True
    ).first()
    if not binding:
        await ReminderEventService.mark_stopped(tenant_id, event.id, "方案绑定已删除")
        return "stopped"
    scheme = await EquipmentInspectionScheme.filter(
        tenant_id=tenant_id, id=binding.scheme_id, deleted_at__isnull=True
    ).first()
    equipment = await Equipment.filter(
        tenant_id=tenant_id, id=binding.equipment_id, deleted_at__isnull=True
    ).first()
    if not scheme or not equipment or not scheme.is_active:
        await ReminderEventService.mark_stopped(tenant_id, event.id, "方案或设备不可用")
        return "stopped"
    period_key = str(payload.get("period_key") or "")
    today = _site_today()
    current_key, period_start = _period_key_and_start(scheme.cycle_type, today)
    if period_key and period_key != current_key:
        await ReminderEventService.mark_stopped(tenant_id, event.id, "已非本周期事件")
        return "stopped"

    period_end = _period_end(scheme.cycle_type, period_start)
    exists = await EquipmentSpotCheck.filter(
        tenant_id=tenant_id,
        equipment_id=equipment.id,
        scheme_id=scheme.id,
        check_date__gte=period_start,
        check_date__lte=period_end,
        status__in=list(VALID_DONE_STATUSES),
        deleted_at__isnull=True,
    ).exists()
    if exists:
        await ReminderEventService.mark_stopped(tenant_id, event.id, "本周期已点检")
        return "stopped"

    await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_SPOT_CHECK,
        trigger_action=ACTION_DUE_OVERDUE,
        variables={
            "document_no": "—",
            "equipment_code": equipment.code or "",
            "equipment_name": equipment.name or "",
            "check_date": today.isoformat(),
            "reminder_kind": "未点检超时",
            "scheme_name": scheme.name or "",
            "detail_path": "/apps/kuaizhizao/equipment-management/spot-checks",
            "planned_at": to_api_isoformat(event.planned_at) if event.planned_at else "",
        },
        context={
            "creator_user_id": scheme.reviewer_user_id or getattr(equipment, "created_by", None),
        },
    )
    return "sent"


register_reminder_handler(RULE_PREFIX, dispatch_spot_check_reminder)


async def prepare_spot_check_reminders() -> None:
    """按设备方案绑定准备未点检超时提醒。"""
    bindings = await EquipmentSchemeBinding.filter(
        scheme_type="spot_check",
        deleted_at__isnull=True,
    ).all()
    for binding in bindings:
        try:
            scheme = await EquipmentInspectionScheme.filter(
                tenant_id=binding.tenant_id,
                id=binding.scheme_id,
                deleted_at__isnull=True,
                is_active=True,
            ).first()
            equipment = await Equipment.filter(
                tenant_id=binding.tenant_id,
                id=binding.equipment_id,
                deleted_at__isnull=True,
                is_active=True,
            ).first()
            if not scheme or not equipment:
                continue
            if equipment.status == "报废":
                continue
            await SpotCheckReminderService.schedule_incomplete_for_binding(
                int(binding.tenant_id),
                binding,
                scheme,
                equipment,
            )
        except Exception:
            logger.exception(
                "准备点检未完成提醒失败 tenant={} binding={}",
                binding.tenant_id,
                binding.id,
            )


register_reminder_preparer(prepare_spot_check_reminders)
