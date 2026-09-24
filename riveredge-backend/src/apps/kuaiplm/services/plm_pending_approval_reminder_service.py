"""PLM 待审超时提醒（INF-03）— 研发交付物 8h / 固件与生产文件 24h。"""

from __future__ import annotations

from datetime import timedelta
from typing import Literal, Optional

from loguru import logger

from apps.kuaiplm.constants.rd_project import RdDeliverableStatus
from apps.kuaiplm.models.rd_project import RdProject, RdProjectDeliverable
from apps.kuaiplm.models.production_file import ProductionFile
from apps.kuaiplm.models.product_firmware import ProductFirmware
from apps.kuaiplm.services.kuaiplm_business_notification import (
    ACTION_PENDING_APPROVAL_OVERDUE,
    TRIGGER_PENDING_APPROVAL,
)
from core.models.reminder_event import ReminderEvent
from core.services.approval.approval_data_scope import (
    list_pending_approver_user_ids_for_entity,
)
from core.services.business.business_notification_service import (
    BusinessNotificationService,
)
from core.services.business.reminder_dispatch_service import register_reminder_handler
from core.services.business.reminder_event_service import ReminderEventService

RULE_PREFIX = "kuaiplm.pending_approval"
RULE_APPROVAL = f"{RULE_PREFIX}.approval"
CHANNEL_INTERNAL = "internal"
APPROVAL_DELAY_HOURS_DEFAULT = 24
DELAY_HOURS_BY_ENTITY = {
    "rd_deliverable": 8,
    "product_firmware": 24,
    "production_file": 24,
    "engineering_drawing": 24,
}

ENTITY_RD_DELIVERABLE = "rd_deliverable"
ENTITY_PRODUCT_FIRMWARE = "product_firmware"
ENTITY_PRODUCTION_FILE = "production_file"
ENTITY_ENGINEERING_DRAWING = "engineering_drawing"


def approval_delay_hours(entity_type: str) -> int:
    return int(DELAY_HOURS_BY_ENTITY.get(entity_type, APPROVAL_DELAY_HOURS_DEFAULT))


class PlmPendingApprovalReminderService:
    @staticmethod
    async def stop_all(
        tenant_id: int,
        *,
        entity_type: str,
        entity_id: int,
        reason: str,
    ) -> int:
        return await ReminderEventService.stop_future_for_entity(
            tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            reason=reason,
        )

    @staticmethod
    async def schedule(
        tenant_id: int,
        *,
        entity_type: str,
        entity_id: int,
        entity_uuid: str,
        submitted_at,
        doc_code: str,
        title: str,
        project_code: Optional[str] = None,
        doc_label: Optional[str] = None,
        delay_hours: Optional[int] = None,
    ) -> None:
        if submitted_at is None:
            return
        if submitted_at.tzinfo is None:
            raise ValueError("submitted_at 必须是带时区的 UTC 时刻")
        hours = int(delay_hours if delay_hours is not None else approval_delay_hours(entity_type))
        planned_at = submitted_at + timedelta(hours=hours)
        await ReminderEventService.ensure_event(
            tenant_id,
            rule_id=f"{RULE_APPROVAL}:{entity_type}:{entity_id}",
            rule_code=RULE_APPROVAL,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_uuid=entity_uuid,
            planned_at=planned_at,
            channel=CHANNEL_INTERNAL,
            payload={
                "entity_type": entity_type,
                "delay_hours": hours,
                "doc_code": doc_code,
                "title": title,
                "project_code": project_code or "",
                "doc_label": doc_label or "",
            },
        )

    @staticmethod
    async def sync_after_submit(
        tenant_id: int,
        *,
        entity_type: str,
        entity_id: int,
        entity_uuid: str,
        submitted_at,
        doc_code: str,
        title: str,
        project_code: Optional[str] = None,
        doc_label: Optional[str] = None,
        delay_hours: Optional[int] = None,
    ) -> None:
        await PlmPendingApprovalReminderService.stop_all(
            tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            reason="重新提交",
        )
        await PlmPendingApprovalReminderService.schedule(
            tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_uuid=entity_uuid,
            submitted_at=submitted_at,
            doc_code=doc_code,
            title=title,
            project_code=project_code,
            doc_label=doc_label,
            delay_hours=delay_hours,
        )

    @staticmethod
    async def sync_after_terminal(
        tenant_id: int,
        *,
        entity_type: str,
        entity_id: int,
        reason: str,
    ) -> None:
        await PlmPendingApprovalReminderService.stop_all(
            tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            reason=reason,
        )


async def _load_pending_row(tenant_id: int, entity_type: str, entity_id: int):
    if entity_type == ENTITY_RD_DELIVERABLE:
        return await RdProjectDeliverable.filter(
            tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
        ).first()
    if entity_type == ENTITY_PRODUCT_FIRMWARE:
        return await ProductFirmware.filter(
            tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
        ).first()
    if entity_type == ENTITY_PRODUCTION_FILE:
        return await ProductionFile.filter(
            tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
        ).first()
    if entity_type == ENTITY_ENGINEERING_DRAWING:
        from apps.master_data.models.drawing import EngineeringDrawing

        return await EngineeringDrawing.filter(
            tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
        ).first()
    return None


def _is_still_pending(entity_type: str, row) -> bool:
    if row is None:
        return False
    if entity_type == ENTITY_RD_DELIVERABLE:
        return row.status == RdDeliverableStatus.SUBMITTED.value
    if entity_type == ENTITY_ENGINEERING_DRAWING:
        return (row.status or "") == "Pending"
    return (row.status or "") == "pending"


async def dispatch_plm_pending_approval_reminder(
    tenant_id: int, event: ReminderEvent
) -> Literal["sent", "stopped"]:
    payload = event.payload or {}
    entity_type = str(payload.get("entity_type") or event.entity_type or "").strip()
    entity_id = int(event.entity_id or 0)
    if not entity_type or entity_id < 1:
        await ReminderEventService.mark_stopped(tenant_id, event.id, "缺少实体信息")
        return "stopped"

    row = await _load_pending_row(tenant_id, entity_type, entity_id)
    if not row:
        await ReminderEventService.mark_stopped(tenant_id, event.id, "单据已删除")
        return "stopped"
    if not _is_still_pending(entity_type, row):
        await ReminderEventService.mark_stopped(tenant_id, event.id, "已不在待审")
        return "stopped"

    doc_code = str(payload.get("doc_code") or "").strip()
    title = str(payload.get("title") or "").strip()
    project_code = str(payload.get("project_code") or "").strip()
    doc_label = str(payload.get("doc_label") or "").strip()
    if not doc_code:
        if entity_type == ENTITY_RD_DELIVERABLE:
            doc_code = row.name or f"交付物#{row.id}"
        elif entity_type == ENTITY_PRODUCT_FIRMWARE:
            doc_code = row.firmware_code or f"固件#{row.id}"
        elif entity_type == ENTITY_PRODUCTION_FILE:
            doc_code = row.file_code or f"文件#{row.id}"
        elif entity_type == ENTITY_ENGINEERING_DRAWING:
            doc_code = f"{row.code}-{row.revision}" if row.code else f"图纸#{row.id}"
    if not title:
        title = getattr(row, "title", None) or getattr(row, "name", None) or doc_code
    if entity_type == ENTITY_RD_DELIVERABLE and not project_code:
        project = await RdProject.filter(
            tenant_id=tenant_id, id=row.project_id, deleted_at__isnull=True
        ).first()
        if project:
            project_code = project.project_code or ""

    approver_ids = await list_pending_approver_user_ids_for_entity(
        tenant_id, entity_type, entity_id
    )
    hours = int(
        payload.get("delay_hours")
        or approval_delay_hours(entity_type)
    )
    sent = await BusinessNotificationService.dispatch(
        tenant_id,
        trigger_document=TRIGGER_PENDING_APPROVAL,
        trigger_action=ACTION_PENDING_APPROVAL_OVERDUE,
        variables={
            "doc_code": doc_code,
            "title": title,
            "project_code": project_code,
            "doc_label": doc_label,
            "delay_hours": str(hours),
            "entity_type": entity_type,
        },
        context={
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_uuid": str(row.uuid),
            "creator_user_id": row.created_by,
            "pending_approver_user_ids": approver_ids,
        },
    )
    if sent == 0:
        logger.warning(
            "PLM 待审超时提醒无接收人 tenant={} entity={}/{} approvers={}",
            tenant_id,
            entity_type,
            entity_id,
            approver_ids,
        )
    return "sent"


register_reminder_handler(RULE_PREFIX, dispatch_plm_pending_approval_reminder)
