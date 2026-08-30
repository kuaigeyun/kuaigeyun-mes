"""快制造 — 业务消息提醒派发（仅站内信，对接 BusinessNotificationService）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from loguru import logger

from core.services.business.business_notification_service import BusinessNotificationService

# 与配置中心 trigger_document / trigger_action 一致
DOC_SALES_ORDER = "sales_order"
DOC_SALES_REVIEW = "sales_review"
DOC_PURCHASE_ORDER = "purchase_order"
DOC_PURCHASE_ORDER_CHANGE = "purchase_order_change"
DOC_WORK_ORDER = "work_order"
DOC_QUALITY_EXCEPTION = "quality_exception"
DOC_QUALITY_INSPECTION = "quality_inspection"
DOC_EQUIPMENT_FAULT = "equipment_fault"
DOC_INVENTORY_ALERT = "inventory_alert"
DOC_SHIPMENT_NOTICE = "shipment_notice"

ACTION_DELIVERY_DELAYED = "delivery_delayed"
ACTION_CREATED = "created"
ACTION_ABNORMAL_DETECTED = "abnormal_detected"
ACTION_REPORTED = "reported"
ACTION_REMIND_BATCHING = "remind_batching"
ACTION_ISSUED = "issued"
ACTION_REJECTED = "rejected"
ACTION_PASSED = "passed"
ACTION_APPROVED = "approved"
ACTION_SUBMITTED = "submitted"
ACTION_PUSHED_TO_WORK_ORDER = "pushed_to_work_order"
ACTION_RELEASED = "released"
ACTION_COMPLETED = "completed"
ACTION_OPERATION_COMPLETED = "operation_completed"
ACTION_REWORKED = "reworked"
ACTION_ASSIGNED = "assigned"
ACTION_RESOLVED = "resolved"
ACTION_TRIGGERED = "triggered"
ACTION_ARRIVAL_OVERDUE = "arrival_overdue"
ACTION_CONFIRMED = "confirmed"


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


async def notify_sales_order_approved(
    tenant_id: int,
    *,
    order_code: str,
    customer_name: str,
    delivery_date: str,
    sales_order_id: int,
    creator_user_id: Optional[int],
    salesman_user_id: Optional[int],
) -> int:
    return await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_SALES_ORDER,
        trigger_action=ACTION_APPROVED,
        variables={
            "order_code": order_code or str(sales_order_id),
            "customer_name": customer_name or "—",
            "delivery_date": delivery_date or "—",
            "detail_path": f"/apps/kuaizhizao/sales-management/sales-orders?highlight={sales_order_id}",
            "sales_order_id": str(sales_order_id),
        },
        context={
            "creator_user_id": creator_user_id,
            "salesman_user_id": salesman_user_id,
        },
    )


async def notify_work_order_completed(
    tenant_id: int,
    *,
    work_order_id: int,
    work_order_code: str,
    product_name: str,
    completed_quantity: str,
    creator_user_id: Optional[int],
) -> int:
    return await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_WORK_ORDER,
        trigger_action=ACTION_COMPLETED,
        variables={
            "work_order_code": work_order_code or str(work_order_id),
            "product_name": product_name or "—",
            "completed_quantity": completed_quantity or "0",
            "detail_path": f"/apps/kuaizhizao/production-execution/work-orders?highlight={work_order_id}",
            "work_order_id": str(work_order_id),
        },
        context={"creator_user_id": creator_user_id},
    )


async def notify_work_order_next_operation(
    tenant_id: int,
    *,
    work_order_id: int,
    work_order_code: str,
    product_name: str,
    completed_operation_name: str,
    next_operation_name: str,
    next_operation_assignee_user_ids: List[int],
    creator_user_id: Optional[int] = None,
) -> int:
    """当前工序完成后，通知下一工序指派人。"""
    assignee_ids = [
        int(uid)
        for uid in (next_operation_assignee_user_ids or [])
        if uid is not None and int(uid) > 0
    ]
    if not assignee_ids:
        return 0
    return await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_WORK_ORDER,
        trigger_action=ACTION_OPERATION_COMPLETED,
        variables={
            "work_order_code": work_order_code or str(work_order_id),
            "product_name": product_name or "—",
            "completed_operation_name": completed_operation_name or "—",
            "next_operation_name": next_operation_name or "—",
            "detail_path": f"/apps/kuaizhizao/production-execution/work-orders?highlight={work_order_id}",
            "work_order_id": str(work_order_id),
        },
        context={
            "creator_user_id": creator_user_id,
            "next_operation_assignee_user_ids": assignee_ids,
        },
    )
