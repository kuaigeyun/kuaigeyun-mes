"""快制造 — 业务消息提醒派发（仅站内信，对接 BusinessNotificationService）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from loguru import logger

from core.services.business.business_notification_service import (
    BusinessNotificationService,
    register_notification_scope_resolver,
)

# 与配置中心 trigger_document / trigger_action 一致
DOC_SALES_ORDER = "sales_order"
DOC_SALES_REVIEW = "sales_review"
DOC_PURCHASE_ORDER = "purchase_order"
DOC_PURCHASE_ORDER_CHANGE = "purchase_order_change"
DOC_WORK_ORDER = "work_order"
DOC_QUALITY_EXCEPTION = "quality_exception"
DOC_QUALITY_INSPECTION = "quality_inspection"
DOC_QUALITY_COMPLAINT = "quality_complaint"
DOC_REWORK_ORDER = "rework_order"
DOC_EQUIPMENT_CALIBRATION = "equipment_calibration"
DOC_EQUIPMENT_FAULT = "equipment_fault"
DOC_SUPPLIER_ENV = "supplier_env_document"
DOC_MOLD_SIGNBACK = "mold_signback"
DOC_EQUIPMENT_SPOT_CHECK = "equipment_spot_check"
DOC_EQUIPMENT_LINE_REBIND = "equipment_line_rebind"
DOC_INVENTORY_ALERT = "inventory_alert"
DOC_SHIPMENT_NOTICE = "shipment_notice"
DOC_REPORTING_RECORD = "reporting_record"

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
ACTION_DUE_OVERDUE = "due_overdue"
ACTION_DUE_SOON = "due_soon"
ACTION_OPEN_OVERDUE = "open_overdue"
ACTION_MONTH_END_OVERDUE = "month_end_overdue"
ACTION_PQC_CHECKED = "pqc_checked"
ACTION_OQC_NOTIFIED = "oqc_notified"
ACTION_CONFIRMED = "confirmed"
ACTION_KINGDEE_PUSH_DEAD = "kingdee_push_dead"


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
    按租户「消息提醒」规则发送站内信。
    返回成功发送条数；无匹配规则或未配置接收人时返回 0。
    发送通道异常会向上抛出（SIDE-01：不再静默吞成 0）。
    """
    vars_payload = dict(variables or {})
    vars_payload.setdefault("message_category", message_category)
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


async def notify_work_order_operation_assigned(
    tenant_id: int,
    *,
    work_order_id: int,
    work_order_code: str,
    product_name: str,
    operation_name: str,
    assignee_user_ids: List[int],
    assigned_by_name: str,
    assigned_worker_name: Optional[str] = None,
    creator_user_id: Optional[int] = None,
) -> int:
    """工序派工后通知被指派人员。"""
    assignee_ids = [
        int(uid)
        for uid in (assignee_user_ids or [])
        if uid is not None and int(uid) > 0
    ]
    if not assignee_ids:
        return 0
    return await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_WORK_ORDER,
        trigger_action=ACTION_ASSIGNED,
        variables={
            "work_order_code": work_order_code or str(work_order_id),
            "product_name": product_name or "—",
            "operation_name": operation_name or "—",
            "assigned_by_name": assigned_by_name or "—",
            "assigned_worker_name": assigned_worker_name or "—",
            "detail_path": f"/apps/kuaizhizao/production-execution/work-orders?highlight={work_order_id}",
            "work_order_id": str(work_order_id),
        },
        context={
            "creator_user_id": creator_user_id,
            "operation_assignee_user_ids": assignee_ids,
        },
    )


DOC_DELIVERY_PROJECT = "delivery_project"
ACTION_NODE_DUE_SOON = "node_due_soon"
ACTION_NODE_OVERDUE = "node_overdue"
ACTION_MILESTONE_OVERDUE = "milestone_overdue"


async def _send_delivery_project_internal(
    tenant_id: int,
    *,
    recipient_user_ids: List[int],
    subject: str,
    content: str,
    detail_path: str,
) -> int:
    """交付项目预警：固化默认站内信（不依赖配置中心规则）。"""
    from core.schemas.message_template import SendMessageRequest
    from core.services.messaging.message_service import MessageService

    sent = 0
    seen: set[int] = set()
    for raw in recipient_user_ids:
        try:
            uid = int(raw)
        except (TypeError, ValueError):
            continue
        if uid < 1 or uid in seen:
            continue
        seen.add(uid)
        try:
            req = SendMessageRequest(
                type="internal",
                recipient=str(uid),
                subject=subject,
                content=content,
                variables={"detail_path": detail_path, "message_category": "process"},
            )
            result = await MessageService.send_message(tenant_id, req)
            if result.success:
                sent += 1
        except Exception as exc:
            logger.error(
                "交付项目预警站内信失败 tenant={} user={}: {}",
                tenant_id,
                uid,
                exc,
            )
    return sent


def _delivery_workbench_path(project_id: int) -> str:
    return f"/apps/kuaizhizao/delivery-project/projects/{project_id}"


async def notify_delivery_node_due_soon(
    tenant_id: int,
    *,
    project_id: int,
    project_code: str,
    project_name: str,
    node_id: int,
    node_name: str,
    planned_end_date: str,
    days_remaining: int,
    node_owner_user_id: Optional[int],
    project_owner_user_id: Optional[int],
) -> int:
    recipients = [uid for uid in (node_owner_user_id, project_owner_user_id) if uid]
    subject = f"交付节点临期提醒 {project_code} {node_name}"
    content = (
        f"项目 {project_code} {project_name} 的节点「{node_name}」"
        f"计划 {planned_end_date} 完成，剩余 {days_remaining} 天，请及时跟进。"
    )
    dispatched = await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_DELIVERY_PROJECT,
        trigger_action=ACTION_NODE_DUE_SOON,
        variables={
            "project_code": project_code,
            "project_name": project_name,
            "node_name": node_name,
            "planned_end_date": planned_end_date,
            "days_remaining": str(days_remaining),
            "detail_path": _delivery_workbench_path(project_id),
        },
        context={
            "node_owner_user_id": node_owner_user_id,
            "project_owner_user_id": project_owner_user_id,
        },
    )
    if dispatched:
        return dispatched
    return await _send_delivery_project_internal(
        tenant_id,
        recipient_user_ids=recipients,
        subject=subject,
        content=content,
        detail_path=_delivery_workbench_path(project_id),
    )


async def notify_delivery_node_overdue(
    tenant_id: int,
    *,
    project_id: int,
    project_code: str,
    project_name: str,
    node_id: int,
    node_name: str,
    planned_end_date: str,
    days_overdue: int,
    node_owner_user_id: Optional[int],
    project_owner_user_id: Optional[int],
) -> int:
    recipients = [uid for uid in (node_owner_user_id, project_owner_user_id) if uid]
    subject = f"交付节点逾期 {project_code} {node_name}"
    content = (
        f"项目 {project_code} {project_name} 的节点「{node_name}」"
        f"计划 {planned_end_date} 完成，已逾期 {days_overdue} 天，请负责人与项目负责人尽快处理。"
    )
    dispatched = await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_DELIVERY_PROJECT,
        trigger_action=ACTION_NODE_OVERDUE,
        variables={
            "project_code": project_code,
            "project_name": project_name,
            "node_name": node_name,
            "planned_end_date": planned_end_date,
            "days_overdue": str(days_overdue),
            "detail_path": _delivery_workbench_path(project_id),
        },
        context={
            "node_owner_user_id": node_owner_user_id,
            "project_owner_user_id": project_owner_user_id,
        },
    )
    if dispatched:
        return dispatched
    return await _send_delivery_project_internal(
        tenant_id,
        recipient_user_ids=recipients,
        subject=subject,
        content=content,
        detail_path=_delivery_workbench_path(project_id),
    )


async def notify_delivery_node_milestone_overdue(
    tenant_id: int,
    *,
    project_id: int,
    project_code: str,
    project_name: str,
    node_id: int,
    node_name: str,
    planned_end_date: str,
    days_overdue: int,
    node_owner_user_id: Optional[int],
    project_owner_user_id: Optional[int],
) -> int:
    recipients = [uid for uid in (node_owner_user_id, project_owner_user_id) if uid]
    subject = f"里程碑节点逾期 {project_code} {node_name}"
    content = (
        f"【高优先级】项目 {project_code} {project_name} 的里程碑节点「{node_name}」"
        f"计划 {planned_end_date} 完成，已逾期 {days_overdue} 天，请立即升级处理。"
    )
    dispatched = await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_DELIVERY_PROJECT,
        trigger_action=ACTION_MILESTONE_OVERDUE,
        variables={
            "project_code": project_code,
            "project_name": project_name,
            "node_name": node_name,
            "planned_end_date": planned_end_date,
            "days_overdue": str(days_overdue),
            "detail_path": _delivery_workbench_path(project_id),
        },
        context={
            "node_owner_user_id": node_owner_user_id,
            "project_owner_user_id": project_owner_user_id,
        },
        message_category="process",
    )
    if dispatched:
        return dispatched
    return await _send_delivery_project_internal(
        tenant_id,
        recipient_user_ids=recipients,
        subject=subject,
        content=content,
        detail_path=_delivery_workbench_path(project_id),
    )


FQC_EXECUTE_PERMISSION = "kuaizhizao:quality-management-finished-goods-inspection:execute"


async def list_tenant_user_ids_with_permission_code(
    tenant_id: int,
    permission_code: str,
) -> List[int]:
    """按角色权限矩阵解析持有某权限码的激活用户（不含管理员旁路全量展开）。"""
    from core.models.permission import Permission
    from core.models.role import Role
    from core.models.role_permission import RolePermission
    from core.models.user_role import UserRole
    from infra.models.user import User

    code = (permission_code or "").strip()
    if not code or tenant_id < 1:
        return []
    perm = await Permission.get_or_none(
        tenant_id=tenant_id,
        code=code,
        deleted_at__isnull=True,
    )
    if perm is None:
        perm = await Permission.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            code__iexact=code,
        ).first()
    if perm is None:
        return []

    role_ids = await RolePermission.filter(permission_id=perm.id).values_list(
        "role_id", flat=True
    )
    if not role_ids:
        return []
    active_role_ids = await Role.filter(
        id__in=list(role_ids),
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    ).values_list("id", flat=True)
    if not active_role_ids:
        return []
    user_ids = await UserRole.filter(role_id__in=list(active_role_ids)).values_list(
        "user_id", flat=True
    )
    if not user_ids:
        return []
    active_user_ids = await User.filter(
        id__in=list(user_ids),
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    ).values_list("id", flat=True)
    return sorted({int(uid) for uid in active_user_ids if int(uid) > 0})


async def notify_finished_goods_inspection_created(
    tenant_id: int,
    *,
    inspection_id: int,
    inspection_code: str,
    work_order_id: int,
    work_order_code: str,
    material_name: str,
    inspection_quantity: str,
    created_by: Optional[int] = None,
) -> int:
    """
    成品检验单新建（含工单下推）后通知质检人员。

    默认站内信发给持有「成品检验执行」权限的激活用户（排除下推人）；
    同时派发配置中心「质检单 / 新建」规则，便于管理员追加固定接收人。
    """
    from core.schemas.message_template import SendMessageRequest
    from core.services.messaging.message_service import MessageService

    detail_path = (
        f"/apps/kuaizhizao/quality-management/finished-goods-inspection"
        f"?highlight={inspection_id}"
    )
    code = (inspection_code or "").strip() or str(inspection_id)
    wo_code = (work_order_code or "").strip() or str(work_order_id)
    material = (material_name or "").strip() or "—"
    qty = (inspection_quantity or "").strip() or "0"
    variables: Dict[str, Any] = {
        "inspection_code": code,
        "inspection_type": "成品检验",
        "work_order_code": wo_code,
        "material_name": material,
        "inspection_quantity": qty,
        "detail_path": detail_path,
        "finished_goods_inspection_id": str(inspection_id),
        "work_order_id": str(work_order_id),
        "message_category": "process",
    }
    subject = f"【成品检验待办】{code}"
    content = (
        f"工单 {wo_code} 已下推成品检验单 {code}。\n"
        f"物料：{material}\n"
        f"检验数量：{qty}\n"
        f"请尽快在成品检验中完成检验。"
    )

    holder_ids = await list_tenant_user_ids_with_permission_code(
        tenant_id, FQC_EXECUTE_PERMISSION
    )
    exclude_id: Optional[int] = None
    try:
        if created_by is not None:
            exclude_id = int(created_by)
    except (TypeError, ValueError):
        exclude_id = None
    recipients = [
        uid for uid in holder_ids if exclude_id is None or uid != exclude_id
    ]

    sent = 0
    seen: set[int] = set()
    for uid in recipients:
        if uid in seen:
            continue
        seen.add(uid)
        try:
            result = await MessageService.send_message(
                tenant_id,
                SendMessageRequest(
                    type="internal",
                    recipient=str(uid),
                    subject=subject,
                    content=content,
                    variables=variables,
                    business_document=DOC_QUALITY_INSPECTION,
                    business_action=ACTION_CREATED,
                    entity_type="finished_goods_inspection",
                    entity_id=inspection_id,
                ),
            )
            if result.success:
                sent += 1
        except Exception as exc:
            logger.error(
                "成品检验新建站内信失败 tenant={} user={} inspection={}: {}",
                tenant_id,
                uid,
                inspection_id,
                exc,
            )

    await dispatch_kuaizhizao_notification(
        tenant_id,
        trigger_document=DOC_QUALITY_INSPECTION,
        trigger_action=ACTION_CREATED,
        variables=variables,
        context={
            "creator_user_id": created_by,
            "entity_type": "finished_goods_inspection",
            "entity_id": inspection_id,
        },
    )
    if sent:
        logger.info(
            "成品检验新建已通知质检人员 tenant={} inspection={} count={}",
            tenant_id,
            inspection_id,
            sent,
        )
    elif not recipients:
        logger.info(
            "成品检验新建无执行权限接收人 tenant={} inspection={}（可在配置中心消息提醒补充固定人员）",
            tenant_id,
            inspection_id,
        )
    return sent


async def _scope_pending_approvers(_tenant_id: int, context: Dict[str, Any]) -> List[int]:
    """优先用 context 待审人快照，否则按实体查询。"""
    from core.services.approval.approval_data_scope import (
        list_pending_approver_user_ids_for_entity,
    )

    explicit = context.get("pending_approver_user_ids")
    if isinstance(explicit, list) and explicit:
        out: List[int] = []
        seen: set[int] = set()
        for item in explicit:
            try:
                uid = int(item)
            except (TypeError, ValueError):
                continue
            if uid > 0 and uid not in seen:
                seen.add(uid)
                out.append(uid)
        if out:
            return out
    entity_type = str(context.get("entity_type") or "").strip()
    try:
        entity_id = int(context.get("entity_id"))
    except (TypeError, ValueError):
        return []
    if not entity_type or entity_id < 1:
        return []
    return await list_pending_approver_user_ids_for_entity(
        _tenant_id, entity_type, entity_id
    )


def ensure_kuaizhizao_notification_scope_resolvers() -> None:
    register_notification_scope_resolver("pending_approvers", _scope_pending_approvers)


ensure_kuaizhizao_notification_scope_resolvers()
