"""生产计划业务态 capabilities（唯一真源，与 planning_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    ProductionPlanCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_executed(execution_status: Any) -> bool:
    return _norm(execution_status) == "已执行"


def _is_cancelled(status: Any) -> bool:
    return _norm(status) in ("已取消", "cancelled", "CANCELLED")


def _audit_approved(status: Any, review_status: Any) -> bool:
    st = _norm(status)
    rs = _norm(review_status)
    return st == "已审核" or rs in ("已审核", "APPROVED", "通过")


def derive_production_plan_capabilities(
    plan: Any,
    *,
    audit_required: bool = False,
    has_production_items: bool = False,
) -> ProductionPlanCapabilities:
    status = getattr(plan, "status", None)
    execution_status = getattr(plan, "execution_status", None)
    review_status = getattr(plan, "review_status", None)
    executed = _is_executed(execution_status)
    st = _norm(status)

    update_allowed = not executed and not _is_cancelled(status)
    update_cap = _cap(
        update_allowed,
        "production_plan.update.executed" if executed else "production_plan.update.not_allowed"
        if not update_allowed
        else None,
    )

    delete_cap = _cap(
        not executed,
        "production_plan.delete.executed" if executed else None,
    )

    submit_cap = _cap(
        not executed and st == "已驳回",
        "production_plan.submit.not_rejected" if not (not executed and st == "已驳回") else None,
    )

    withdraw_cap = _cap(
        not executed and st == "待审核",
        "production_plan.withdraw_submit.not_pending"
        if not (not executed and st == "待审核")
        else None,
    )

    approve_cap = _cap(
        not executed and st == "待审核",
        "production_plan.approve.not_pending" if not (not executed and st == "待审核") else None,
    )

    revoke_cap = _cap(
        not executed and st == "已审核",
        "production_plan.revoke_approval.not_allowed"
        if not (not executed and st == "已审核")
        else None,
    )

    execute_allowed = False
    execute_reason = "production_plan.execute.already_executed"
    if executed:
        pass
    elif audit_required and not _audit_approved(status, review_status):
        execute_reason = "production_plan.execute.requires_approved"
    else:
        execute_allowed = True
        execute_reason = None
    execute_cap = _cap(execute_allowed, execute_reason)

    push_allowed = False
    push_reason = "production_plan.push_work_order.not_allowed"
    if executed:
        push_reason = "production_plan.push_work_order.executed"
    elif not has_production_items:
        push_reason = "production_plan.push_work_order.no_items"
    elif audit_required and st != "已审核":
        push_reason = "production_plan.push_work_order.requires_approved"
    else:
        push_allowed = True
        push_reason = None
    push_cap = _cap(push_allowed, push_reason)

    return ProductionPlanCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        withdraw_submit=withdraw_cap,
        approve=approve_cap,
        revoke_approval=revoke_cap,
        execute=execute_cap,
        push_work_order=push_cap,
    )


def assert_production_plan_capability(
    plan: Any,
    action: str,
    *,
    audit_required: bool = False,
    has_production_items: bool = False,
) -> None:
    caps = derive_production_plan_capabilities(
        plan,
        audit_required=audit_required,
        has_production_items=has_production_items,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "revoke_approval": caps.revoke_approval,
        "execute": caps.execute,
        "push_work_order": caps.push_work_order,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown production plan capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
