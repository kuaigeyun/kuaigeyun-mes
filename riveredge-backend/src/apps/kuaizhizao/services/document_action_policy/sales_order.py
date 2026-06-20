"""销售订单业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import (
    DocumentStatus,
    DemandStatus,
    LEGACY_AUDITED_VALUES,
    ReviewStatus,
    normalize_status,
)
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    SalesOrderCapabilities,
)
from apps.kuaizhizao.services.order_change.helpers import is_source_order_locked_for_direct_edit


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _is_draft(status: Any) -> bool:
    return normalize_status(_norm_status(status)) == DemandStatus.DRAFT.value


def _is_pending_review_status(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DemandStatus.PENDING_REVIEW.value or raw.upper() == "PENDING"


def _is_rejected_status(status: Any) -> bool:
    return normalize_status(_norm_status(status)) == DemandStatus.REJECTED.value


def _is_closed(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DocumentStatus.CLOSED.value or raw in ("已关闭", "CLOSED", "closed")


def _is_completed_status(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DocumentStatus.COMPLETED.value or raw in ("已完成", "COMPLETED", "FINISHED")


def _is_cancelled_status(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DocumentStatus.CANCELLED.value or raw in ("已取消", "CANCELLED")


def _is_confirmed(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DemandStatus.CONFIRMED.value or raw in ("已确认", "已生效")


def _is_audited_status(status: Any) -> bool:
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return (
        normalized in (DemandStatus.AUDITED.value, DemandStatus.CONFIRMED.value)
        or raw in LEGACY_AUDITED_VALUES
    )


def _is_strictly_audited_status(status: Any) -> bool:
    if _is_confirmed(status):
        return False
    raw = _norm_status(status)
    normalized = normalize_status(raw)
    return normalized == DemandStatus.AUDITED.value or raw in LEGACY_AUDITED_VALUES


def _normalize_review_status(review_status: Any) -> str:
    from apps.kuaizhizao.constants import REVIEW_STATUS_ALIASES

    raw = _norm_status(review_status)
    if not raw:
        return ""
    return REVIEW_STATUS_ALIASES.get(raw, raw.upper())


def _is_review_approved(review_status: Any) -> bool:
    return _normalize_review_status(review_status) == ReviewStatus.APPROVED.value


def _is_review_pending(review_status: Any) -> bool:
    return _normalize_review_status(review_status) == ReviewStatus.PENDING.value


def _executable_base(order: Any) -> tuple[bool, Optional[str]]:
    status = getattr(order, "status", None)
    if _is_closed(status):
        return False, "sales_order.push.closed"
    if _is_cancelled_status(status):
        return False, "sales_order.push.cancelled"
    if _is_completed_status(status):
        return False, "sales_order.push.completed"
    return True, None


def _push_base(order: Any) -> tuple[bool, Optional[str]]:
    ok, reason = _executable_base(order)
    if not ok:
        return ok, reason
    if not _is_audited_status(getattr(order, "status", None)):
        return False, "sales_order.push.requires_approved"
    return True, None


def _can_withdraw_submitted(order: Any) -> bool:
    status = getattr(order, "status", None)
    if _is_pending_review_status(status) or _is_confirmed(status):
        return True
    return False


def derive_sales_order_capabilities(
    order: Any,
    *,
    pushed_to_computation: bool = False,
    has_items: bool = True,
    has_line_work_orders: bool = False,
    computation_pushed_blocks_withdraw: bool = False,
) -> SalesOrderCapabilities:
    status = getattr(order, "status", None)
    review_status = getattr(order, "review_status", None)

    # update — 未锁定且草稿/待审核（与 update_sales_order 一致）
    update_allowed = False
    update_reason = "sales_order.update.not_allowed"
    if is_source_order_locked_for_direct_edit(_norm_status(status), review_status):
        update_reason = "sales_order.update.locked"
    elif _is_draft(status) or _is_pending_review_status(status):
        update_allowed = True
    update_cap = _cap(update_allowed, update_reason if not update_allowed else None)

    # delete — 草稿、待审核或已提交
    delete_allowed = (
        _is_draft(status)
        or _is_pending_review_status(status)
        or _norm_status(status) == "已提交"
    )
    delete_cap = _cap(
        delete_allowed,
        "sales_order.delete.not_allowed" if not delete_allowed else None,
    )

    # submit — 草稿（已审核时 submit 接口直接返回，不报错）
    submit_allowed = _is_draft(status)
    submit_cap = _cap(
        submit_allowed,
        "sales_order.submit.not_draft" if not submit_allowed else None,
    )

    approve_cap = _cap(
        _is_pending_review_status(status),
        "sales_order.approve.not_pending" if not _is_pending_review_status(status) else None,
    )

    # close — 与 _validate_can_close_sales_order 一致
    close_allowed = False
    close_reason = "sales_order.close.not_allowed"
    if _is_closed(status):
        close_reason = "sales_order.close.already_closed"
    elif _is_cancelled_status(status):
        close_reason = "sales_order.close.cancelled"
    elif _is_completed_status(status):
        close_reason = "sales_order.close.completed"
    elif _is_draft(status):
        close_reason = "sales_order.close.draft_use_delete"
    elif _is_pending_review_status(status) and not _is_review_approved(review_status):
        close_reason = "sales_order.close.pending_review"
    elif _is_rejected_status(status) or _normalize_review_status(review_status) == ReviewStatus.REJECTED.value:
        close_reason = "sales_order.close.rejected"
    elif not _is_review_approved(review_status):
        close_reason = "sales_order.close.not_approved"
    else:
        close_allowed = True
    close_cap = _cap(close_allowed, close_reason if not close_allowed else None)

    # print — 无业务态限制（RBAC 门控）
    print_cap = _cap(True)

    # withdraw_submit — 批量撤回提交
    withdraw_submit_allowed = False
    withdraw_submit_reason = "sales_order.withdraw_submit.not_allowed"
    exec_ok, exec_reason = _executable_base(order)
    if not exec_ok:
        withdraw_submit_reason = exec_reason or withdraw_submit_reason
    elif computation_pushed_blocks_withdraw:
        withdraw_submit_reason = "sales_order.withdraw_submit.computation_pushed"
    elif _can_withdraw_submitted(order):
        withdraw_submit_allowed = True
    withdraw_submit_cap = _cap(
        withdraw_submit_allowed,
        withdraw_submit_reason if not withdraw_submit_allowed else None,
    )

    # revoke_approval — 反审核（已审核或已驳回）
    revoke_allowed = (
        _is_strictly_audited_status(status) or _is_rejected_status(status)
    ) and not _is_closed(status)
    revoke_cap = _cap(
        revoke_allowed,
        "sales_order.revoke_approval.not_allowed" if not revoke_allowed else None,
    )

    push_ok, push_reason = _push_base(order)

    # push_computation
    push_computation_allowed = False
    push_computation_reason = push_reason or "sales_order.push_computation.not_allowed"
    if push_ok:
        if pushed_to_computation:
            push_computation_reason = "sales_order.push_computation.already_pushed"
        elif has_line_work_orders:
            push_computation_reason = "sales_order.push_computation.line_work_orders"
        else:
            push_computation_allowed = True
    push_computation_cap = _cap(
        push_computation_allowed,
        push_computation_reason if not push_computation_allowed else None,
    )

    # withdraw_computation
    withdraw_computation_allowed = push_ok and pushed_to_computation
    withdraw_computation_cap = _cap(
        withdraw_computation_allowed,
        push_reason or "sales_order.withdraw_computation.not_allowed"
        if not withdraw_computation_allowed
        else None,
    )

    # push_work_order
    push_work_order_allowed = False
    push_work_order_reason = push_reason or "sales_order.push_work_order.not_allowed"
    if push_ok:
        if not has_items:
            push_work_order_reason = "sales_order.push_work_order.no_items"
        else:
            push_work_order_allowed = True
    push_work_order_cap = _cap(
        push_work_order_allowed,
        push_work_order_reason if not push_work_order_allowed else None,
    )

    # push_shipment_notice / push_sales_delivery / push_invoice — 须已审核且有明细
    def _push_with_items_cap(not_allowed_key: str) -> ActionCapability:
        allowed = False
        reason = push_reason or not_allowed_key
        if push_ok:
            if not has_items:
                reason = "sales_order.push.no_items"
            else:
                allowed = True
                reason = None
        return _cap(allowed, reason if not allowed else None)

    push_shipment_cap = _push_with_items_cap("sales_order.push_shipment.not_allowed")
    push_delivery_cap = _push_with_items_cap("sales_order.push_delivery.not_allowed")
    push_invoice_cap = _push_with_items_cap("sales_order.push_invoice.not_allowed")

    # push_sales_return — 与前端一致：已审核可执行即可
    push_return_allowed = push_ok
    push_return_cap = _cap(
        push_return_allowed,
        push_reason if not push_return_allowed else None,
    )

    # create_change_order — 不可直接改单且已审核可执行
    create_change_allowed = (
        not update_allowed
        and push_ok
        and is_source_order_locked_for_direct_edit(_norm_status(status), review_status)
    )
    create_change_cap = _cap(
        create_change_allowed,
        "sales_order.create_change.not_allowed" if not create_change_allowed else None,
    )

    return SalesOrderCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        approve=approve_cap,
        close=close_cap,
        print=print_cap,
        withdraw_submit=withdraw_submit_cap,
        revoke_approval=revoke_cap,
        push_computation=push_computation_cap,
        withdraw_computation=withdraw_computation_cap,
        push_work_order=push_work_order_cap,
        push_shipment_notice=push_shipment_cap,
        push_sales_delivery=push_delivery_cap,
        push_invoice=push_invoice_cap,
        push_sales_return=push_return_cap,
        create_change_order=create_change_cap,
    )


def assert_sales_order_capability(
    order: Any,
    action: str,
    *,
    pushed_to_computation: bool = False,
    has_items: bool = True,
    has_line_work_orders: bool = False,
    computation_pushed_blocks_withdraw: bool = False,
) -> None:
    caps = derive_sales_order_capabilities(
        order,
        pushed_to_computation=pushed_to_computation,
        has_items=has_items,
        has_line_work_orders=has_line_work_orders,
        computation_pushed_blocks_withdraw=computation_pushed_blocks_withdraw,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "approve": caps.approve,
        "close": caps.close,
        "print": caps.print,
        "withdraw_submit": caps.withdraw_submit,
        "revoke_approval": caps.revoke_approval,
        "push_computation": caps.push_computation,
        "withdraw_computation": caps.withdraw_computation,
        "push_work_order": caps.push_work_order,
        "push_shipment_notice": caps.push_shipment_notice,
        "push_sales_delivery": caps.push_sales_delivery,
        "push_invoice": caps.push_invoice,
        "push_sales_return": caps.push_sales_return,
        "create_change_order": caps.create_change_order,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown sales order capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
