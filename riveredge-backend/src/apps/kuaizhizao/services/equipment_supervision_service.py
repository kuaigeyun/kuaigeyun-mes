"""快制造设备 — 点检/保养督促检测与通知派发。"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional

from loguru import logger

from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.equipment_ops import (
    EquipmentInspectionScheme,
    EquipmentSchemeBinding,
    EquipmentSpotCheck,
)
from apps.kuaizhizao.models.maintenance_reminder import MaintenanceReminder
from apps.kuaizhizao.services.equipment_mobile_notification import (
    notify_maintenance_overdue_supervision,
    notify_spot_check_overdue_supervision,
)
from core.models.message_log import MessageLog
from infra.services.business_config_service import BusinessConfigService


_EXCLUDED_EQUIPMENT_STATUSES = frozenset({"停用", "报废"})

# 方案周期 → 间隔天数（用于逾期判定）
_CYCLE_INTERVAL_DAYS = {
    "每班": 1,
    "每天": 1,
    "每日": 1,
    "每周": 7,
    "每月": 30,
    "每季度": 90,
    "季度": 90,
}


def resolve_scheme_interval_days(cycle_type: Optional[str], fallback: int = 1) -> int:
    key = (cycle_type or "").strip()
    if key in _CYCLE_INTERVAL_DAYS:
        return _CYCLE_INTERVAL_DAYS[key]
    return max(1, int(fallback or 1))


async def _supervision_sent_today(*, tenant_id: int, subject: str) -> bool:
    today_start = datetime.combine(date.today(), time.min)
    return await MessageLog.filter(
        tenant_id=tenant_id,
        subject=subject,
        created_at__gte=today_start,
        deleted_at__isnull=True,
    ).exists()


async def dispatch_maintenance_supervision(
    *,
    tenant_id: int,
    created_reminders: list[MaintenanceReminder] | None = None,
) -> dict:
    """新建 overdue 提醒即时通知；未处理 overdue 提醒每日督促一次。"""
    created = created_reminders or []
    overdue_created = [r for r in created if r.reminder_type == "overdue"]
    if overdue_created:
        await notify_maintenance_overdue_supervision(
            tenant_id=tenant_id,
            reminders=overdue_created,
            subject_tag="new",
        )

    today = date.today().isoformat()
    daily_subject = f"设备保养督促:{today}"
    if await _supervision_sent_today(tenant_id=tenant_id, subject=daily_subject):
        return {"maintenance_daily_sent": False, "maintenance_new_sent": len(overdue_created) > 0}

    unhandled = await MaintenanceReminder.filter(
        tenant_id=tenant_id,
        reminder_type="overdue",
        is_handled=False,
        deleted_at__isnull=True,
    )
    if not unhandled:
        return {"maintenance_daily_sent": False, "maintenance_new_sent": len(overdue_created) > 0}

    await notify_maintenance_overdue_supervision(
        tenant_id=tenant_id,
        reminders=list(unhandled),
        subject=daily_subject,
    )
    return {"maintenance_daily_sent": True, "maintenance_new_sent": len(overdue_created) > 0}


async def check_and_notify_spot_check_overdue(*, tenant_id: int) -> dict:
    """按设备绑定方案的周期检测逾期点检并督促（每日一次）。"""
    today = date.today()
    daily_subject = f"设备点检督促:{today.isoformat()}"
    if await _supervision_sent_today(tenant_id=tenant_id, subject=daily_subject):
        return {"spot_check_overdue_count": 0, "spot_check_notified": False}

    config = await BusinessConfigService.get_business_config(tenant_id)
    params = config.get("parameters") if isinstance(config, dict) else {}
    kuaizhizao = params.get("kuaizhizao") if isinstance(params, dict) else {}
    equipment_cfg = kuaizhizao.get("equipment") if isinstance(kuaizhizao, dict) else {}
    fallback_interval = 1
    if isinstance(equipment_cfg, dict):
        raw_interval = equipment_cfg.get("spot_check_interval_days")
        try:
            if raw_interval is not None:
                fallback_interval = max(1, int(raw_interval))
        except (TypeError, ValueError):
            fallback_interval = 1

    bindings = await EquipmentSchemeBinding.filter(
        tenant_id=tenant_id,
        scheme_type="spot_check",
        deleted_at__isnull=True,
    )
    if not bindings:
        return {"spot_check_overdue_count": 0, "spot_check_notified": False}

    scheme_ids = {b.scheme_id for b in bindings}
    schemes = await EquipmentInspectionScheme.filter(
        tenant_id=tenant_id,
        id__in=list(scheme_ids),
        is_active=True,
        deleted_at__isnull=True,
    )
    scheme_by_id = {s.id: s for s in schemes}

    equipment_ids = {b.equipment_id for b in bindings}
    equipments = await Equipment.filter(
        tenant_id=tenant_id,
        id__in=list(equipment_ids),
        is_active=True,
        deleted_at__isnull=True,
    )
    equipment_by_id = {e.id: e for e in equipments}

    overdue_equipments: list[Equipment] = []
    overdue_seen: set[int] = set()

    for binding in bindings:
        scheme = scheme_by_id.get(binding.scheme_id)
        if not scheme:
            continue
        equipment = equipment_by_id.get(binding.equipment_id)
        if not equipment:
            continue
        if (equipment.status or "").strip() in _EXCLUDED_EQUIPMENT_STATUSES:
            continue
        if equipment.id in overdue_seen:
            continue

        interval_days = resolve_scheme_interval_days(scheme.cycle_type, fallback_interval)
        if interval_days <= 1:
            checked = await EquipmentSpotCheck.filter(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                scheme_id=scheme.id,
                check_date=today,
                deleted_at__isnull=True,
            ).exists()
            if not checked:
                overdue_equipments.append(equipment)
                overdue_seen.add(equipment.id)
            continue

        last_check = (
            await EquipmentSpotCheck.filter(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                scheme_id=scheme.id,
                deleted_at__isnull=True,
            )
            .order_by("-check_date")
            .first()
        )
        if not last_check:
            overdue_equipments.append(equipment)
            overdue_seen.add(equipment.id)
            continue
        days_since = (today - last_check.check_date).days
        if days_since >= interval_days:
            overdue_equipments.append(equipment)
            overdue_seen.add(equipment.id)

    if not overdue_equipments:
        return {"spot_check_overdue_count": 0, "spot_check_notified": False}

    await notify_spot_check_overdue_supervision(
        tenant_id=tenant_id,
        equipments=overdue_equipments,
        subject=daily_subject,
        check_date=today,
    )
    logger.info(
        "设备点检督促已发送 tenant={} count={}",
        tenant_id,
        len(overdue_equipments),
    )
    return {
        "spot_check_overdue_count": len(overdue_equipments),
        "spot_check_notified": True,
    }
