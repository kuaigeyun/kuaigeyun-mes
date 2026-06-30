"""销售合同业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import LEGACY_PENDING_VALUES, ReviewStatus
from apps.kuaizhizao.services.document_lifecycle_service import _is_approved
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    SalesContractCapabilities,
)

_CONTRACT_EFFECTIVE_STATUSES = frozenset({"已生效", "执行中"})
_CONTRACT_CLOSED_STATUSES = frozenset({"已关闭", "已完成", "已到期"})


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _is_draft(status: Any) -> bool:
    return _norm_status(status) == "草稿"


def _is_pending_review(status: Any) -> bool:
    return _norm_status(status) == "待审核"


def _is_effective(status: Any) -> bool:
    return _norm_status(status) in _CONTRACT_EFFECTIVE_STATUSES


def _normalize_review_status(review_status: Any) -> str:
    raw = _norm_status(review_status)
    if not raw:
        return ""
    from apps.kuaizhizao.constants import REVIEW_STATUS_ALIASES

    return REVIEW_STATUS_ALIASES.get(raw, raw.upper())


def _is_review_pending(review_status: Any) -> bool:
    rs = _normalize_review_status(review_status)
    return rs in LEGACY_PENDING_VALUES or rs == ReviewStatus.PENDING.value or rs == ""


def derive_sales_contract_capabilities(
    contract: Any,
    *,
    has_items: bool = True,
    has_releasable_items: bool = False,
    remaining_amount: Optional[Decimal] = None,
    remaining_quantity: Optional[Decimal] = None,
    today: Optional[date] = None,
) -> SalesContractCapabilities:
    status = getattr(contract, "status", None)
    review_status = getattr(contract, "review_status", None)
    st = _norm_status(status)
    today = today or date.today()

    update_allowed = _is_draft(status) or _is_pending_review(status)
    update_cap = _cap(
        update_allowed,
        "sales_contract.update.not_draft" if not update_allowed else None,
    )

    delete_allowed = _is_draft(status) or _is_pending_review(status)
    delete_cap = _cap(
        delete_allowed,
        "sales_contract.delete.not_draft" if not delete_allowed else None,
    )

    submit_cap = _cap(
        _is_draft(status),
        "sales_contract.submit.not_draft" if not _is_draft(status) else None,
    )

    withdraw_cap = _cap(
        _is_pending_review(status) and _is_review_pending(review_status),
        "sales_contract.withdraw_submit.not_pending" if not (
            _is_pending_review(status) and _is_review_pending(review_status)
        ) else None,
    )

    approve_cap = _cap(
        _is_pending_review(status),
        "sales_contract.approve.not_pending" if not _is_pending_review(status) else None,
    )

    reject_cap = approve_cap

    rel_qty = Decimal(str(getattr(contract, "released_quantity", 0) or 0))
    rel_amt = Decimal(str(getattr(contract, "released_amount", 0) or 0))
    revoke_allowed = False
    revoke_reason = "sales_contract.revoke_approval.not_allowed"
    if st != "已生效":
        revoke_reason = "sales_contract.revoke_approval.not_effective"
    elif not _is_approved(review_status):
        revoke_reason = "sales_contract.revoke_approval.not_allowed"
    elif rel_qty > 0 or rel_amt > 0:
        revoke_reason = "sales_contract.revoke_approval.has_release"
    else:
        revoke_allowed = True
        revoke_reason = None
    revoke_cap = _cap(revoke_allowed, revoke_reason)

    push_allowed = False
    push_reason = "sales_contract.push.not_effective"
    if not _is_effective(status):
        push_reason = "sales_contract.push.not_effective"
    elif not _is_approved(review_status):
        push_reason = "sales_contract.push.not_approved"
    elif not has_items:
        push_reason = "sales_contract.push.no_items"
    else:
        valid_to = getattr(contract, "valid_to", None)
        valid_from = getattr(contract, "valid_from", None)
        if valid_to and valid_to < today:
            push_reason = "sales_contract.push.expired"
        elif valid_from and valid_from > today:
            push_reason = "sales_contract.push.not_yet_valid"
        else:
            rem_amt = remaining_amount
            if rem_amt is None:
                total_amt = Decimal(str(getattr(contract, "total_amount", 0) or 0))
                rem_amt = max(Decimal("0"), total_amt - rel_amt)
            contract_type = _norm_status(getattr(contract, "contract_type", "single"))
            if contract_type == "single" and rem_amt <= Decimal("0"):
                push_reason = "sales_contract.push.no_remaining"
            elif not has_releasable_items:
                push_reason = "sales_contract.push.no_releasable_items"
            else:
                push_allowed = True
                push_reason = None
    push_cap = _cap(push_allowed, push_reason)

    # 支持未通过审核也可打印（用于预览），最终是否可见仍受 RBAC 的 print 权限控制。
    print_allowed = True
    print_cap = _cap(
        print_allowed,
        "sales_contract.print.not_allowed" if not print_allowed else None,
    )

    close_allowed = st not in _CONTRACT_CLOSED_STATUSES
    close_cap = _cap(
        close_allowed,
        "sales_contract.close.already_closed" if not close_allowed else None,
    )

    create_change_allowed = _is_effective(status)
    create_change_cap = _cap(
        create_change_allowed,
        "sales_contract.create_change.not_effective" if not create_change_allowed else None,
    )

    return SalesContractCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        withdraw_submit=withdraw_cap,
        approve=approve_cap,
        reject=reject_cap,
        revoke_approval=revoke_cap,
        push_to_sales_order=push_cap,
        push_to_work_order=push_cap,
        print=print_cap,
        close=close_cap,
        create_change=create_change_cap,
    )


def assert_sales_contract_capability(
    contract: Any,
    action: str,
    *,
    has_items: bool = True,
    has_releasable_items: bool = False,
    remaining_amount: Optional[Decimal] = None,
    remaining_quantity: Optional[Decimal] = None,
    today: Optional[date] = None,
) -> None:
    caps = derive_sales_contract_capabilities(
        contract,
        has_items=has_items,
        has_releasable_items=has_releasable_items,
        remaining_amount=remaining_amount,
        remaining_quantity=remaining_quantity,
        today=today,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "reject": caps.reject,
        "revoke_approval": caps.revoke_approval,
        "push_to_sales_order": caps.push_to_sales_order,
        "push_to_work_order": caps.push_to_work_order,
        "print": caps.print,
        "close": caps.close,
        "create_change": caps.create_change,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown sales contract capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
