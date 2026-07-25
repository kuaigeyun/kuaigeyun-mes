"""快制造 — 业务消息提醒派发（仅站内信，对接 BusinessNotificationService）。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from loguru import logger

from core.services.business.business_notification_service import BusinessNotificationService

# 与配置中心 trigger_document / trigger_action 一致
DOC_SALES_ORDER = "sales_order"
DOC_PURCHASE_ORDER = "purchase_order"
DOC_WORK_ORDER = "work_order"
DOC_QUALITY_EXCEPTION = "quality_exception"
DOC_QUALITY_INSPECTION = "quality_inspection"
DOC_EQUIPMENT_FAULT = "equipment_fault"

ACTION_DELIVERY_DELAYED = "delivery_delayed"
ACTION_CREATED = "created"
ACTION_ABNORMAL_DETECTED = "abnormal_detected"
ACTION_REPORTED = "reported"
ACTION_REMIND_BATCHING = "remind_batching"


async def dispatch_kuaizhizao_notification(
    tenant_id: int,
    *,
    trigger_document: str,
    trigger_action: str,
    variables: Optional[Dict[str, Any]] = None,
    context: Optional[Dict[str, Any]] = None,
    message_category: str = "process",
) -> int:
    """
    按租户「消息提醒」规则发送站内信。无匹配规则或未配置接收人时返回 0。
    """
    vars_payload = dict(variables or {})
    vars_payload.setdefault("message_category", message_category)
    try:
        sent = await BusinessNotificationService.dispatch(
            tenant_id,
            trigger_document=trigger_document,
            trigger_action=trigger_action,
            variables=vars_payload,
            context=context,
        )
        if sent:
            logger.info(
                "快制造消息提醒已发送 tenant={} doc={} action={} count={}",
                tenant_id,
                trigger_document,
                trigger_action,
                sent,
            )
        return sent
    except Exception as exc:
        logger.error(
            "快制造消息提醒派发失败 tenant={} doc={} action={}: {}",
            tenant_id,
            trigger_document,
            trigger_action,
            exc,
        )
        return 0
