"""供应商环保资料有效期提醒（INF-03 / R-03）。

到期前 30 天 due_soon；过期当天 due_overdue。
不替代主数据供应商资质证书字段。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from loguru import logger

from apps.kuaizhizao.models.supplier_evaluation import SupplierEvalEnvDocument
from apps.kuaizhizao.services.kuaizhizao_business_notification import (
    ACTION_DUE_OVERDUE,
    ACTION_DUE_SOON,
    DOC_SUPPLIER_ENV,
    dispatch_kuaizhizao_notification,
)
from core.models.reminder_event import ReminderEvent
from core.services.business.reminder_dispatch_service import register_reminder_handler
from core.services.business.reminder_event_service import ReminderEventService
from core.utils.timezone_utils import site_timezone_name

ENTITY_TYPE = "supplier_env_document"
RULE_PREFIX = "kuaizhizao.supplier_env_document"
RULE_DUE_SOON = f"{RULE_PREFIX}.due_soon"
RULE_OVERDUE = f"{RULE_PREFIX}.overdue"
CHANNEL_INTERNAL = "internal"
DEFAULT_DUE_SOON_DAYS = 30


def _resolve_lead_days(doc: SupplierEvalEnvDocument) -> int:
    raw = getattr(doc, "reminder_lead_days", None)
    if raw is None:
        return DEFAULT_DUE_SOON_DAYS
    days = int(raw)
    return max(1, days)


def _site_day_at_hour_utc(day, *, hour: int = 9) -> datetime:
    tz = ZoneInfo(site_timezone_name())
    local = datetime(day.year, day.month, day.day, hour, 0, 0, tzinfo=tz)
    return local.astimezone(timezone.utc)


class SupplierEvalEnvReminderService:
    @staticmethod
    async def stop_for_doc(tenant_id: int, doc_id: int, *, reason: str) -> int:
        return await ReminderEventService.stop_future_for_entity(
            tenant_id,
            entity_type=ENTITY_TYPE,
            entity_id=doc_id,
            reason=reason,
        )

    @staticmethod
    async def sync_after_saved(tenant_id: int, doc: SupplierEvalEnvDocument) -> None:
        await SupplierEvalEnvReminderService.stop_for_doc(
            tenant_id, doc.id, reason="环保资料更新"
        )
        if not doc.expires_at:
            return
        due = doc.expires_at
        soon_day = due - timedelta(days=_resolve_lead_days(doc))
        payload = {
            "doc_id": doc.id,
            "title": doc.title,
            "doc_type": doc.doc_type,
            "due_date": due.isoformat(),
            "supplier_code": doc.supplier_code,
            "supplier_name": doc.supplier_name,
        }
        await ReminderEventService.ensure_event(
            tenant_id,
            rule_id=f"{RULE_DUE_SOON}:{doc.id}:{due.isoformat()}",
            rule_code=RULE_DUE_SOON,
            entity_type=ENTITY_TYPE,
            entity_id=doc.id,
            entity_uuid=str(doc.uuid),
            planned_at=_site_day_at_hour_utc(soon_day),
            channel=CHANNEL_INTERNAL,
            payload={**payload, "kind": "due_soon"},
        )
        await ReminderEventService.ensure_event(
            tenant_id,
            rule_id=f"{RULE_OVERDUE}:{doc.id}:{due.isoformat()}",
            rule_code=RULE_OVERDUE,
            entity_type=ENTITY_TYPE,
            entity_id=doc.id,
            entity_uuid=str(doc.uuid),
            planned_at=_site_day_at_hour_utc(due),
            channel=CHANNEL_INTERNAL,
            payload={**payload, "kind": "overdue"},
        )


async def dispatch_supplier_env_reminder(
    tenant_id: int, event: ReminderEvent
) -> Literal["sent", "stopped"]:
    doc = await SupplierEvalEnvDocument.filter(
        tenant_id=tenant_id, id=event.entity_id, deleted_at__isnull=True
    ).first()
    if not doc:
        await ReminderEventService.mark_stopped(tenant_id, event.id, "环保资料已删除")
        return "stopped"

    payload = event.payload or {}
    due_raw = str(payload.get("due_date") or "")
    if doc.expires_at and due_raw and doc.expires_at.isoformat() != due_raw:
        await ReminderEventService.mark_stopped(tenant_id, event.id, "有效期已变更")
        return "stopped"

    rule_code = str(event.rule_code or "")
    if rule_code == RULE_DUE_SOON:
        action = ACTION_DUE_SOON
        kind_label = "到期前一个月"
    elif rule_code == RULE_OVERDUE:
        action = ACTION_DUE_OVERDUE
        kind_label = "已到期"
    else:
        await ReminderEventService.mark_stopped(
            tenant_id, event.id, f"未知环保资料提醒规则: {rule_code}"
        )
        return "stopped"

    variables = {
        "supplier_code": doc.supplier_code or "—",
        "supplier_name": doc.supplier_name or "—",
        "doc_title": doc.title or "—",
        "doc_type": doc.doc_type or "—",
        "due_date": due_raw or "—",
        "reminder_kind": kind_label,
        "detail_path": (
            f"/apps/kuaizhizao/quality-management/supplier-evaluations"
            f"?tab=env&highlight={doc.uuid}"
        ),
    }
    context = {
        "creator_user_id": getattr(doc, "created_by", None),
    }
    sent = await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_SUPPLIER_ENV,
        trigger_action=action,
        variables=variables,
        context=context,
    )
    if not sent:
        logger.info(
            "供应商环保资料提醒无匹配规则 tenant={} doc={} action={}",
            tenant_id,
            doc.id,
            action,
        )
    return "sent"


register_reminder_handler(RULE_PREFIX, dispatch_supplier_env_reminder)
