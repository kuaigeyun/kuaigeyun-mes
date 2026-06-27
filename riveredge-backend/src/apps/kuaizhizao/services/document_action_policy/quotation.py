"""报价单业务态 capabilities（唯一真源，与 service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.constants import LEGACY_PENDING_VALUES
from apps.kuaizhizao.services.document_lifecycle_service import _is_approved
from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    QuotationCapabilities,
)

_QUOTATION_POST_SUBMIT_STATUSES = frozenset(
    {"已发送", "已接受", "已转订单", "sent", "accepted", "converted"}
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm_status(value: Any) -> str:
    return str(value or "").strip()


def _is_pending_review(review_status: Any) -> bool:
    rs = _norm_status(review_status)
    return rs in LEGACY_PENDING_VALUES or rs == ""


def _is_superseded(quotation: Any) -> bool:
    return (
        getattr(quotation, "is_latest_in_series", True) is False
        and getattr(quotation, "superseded_by_id", None) is not None
        and int(getattr(quotation, "superseded_by_id", 0) or 0) > 0
    )


def _has_live_sales_order_link(quotation: Any, conversion_downstream_missing: bool) -> bool:
    st = _norm_status(getattr(quotation, "status", None))
    # 已接受：尚未转单，不因历史 sales_order_id 残留阻断下推（convert 前会 detach 无效关联）
    if st == "已接受":
        return False
    so_id = getattr(quotation, "sales_order_id", None)
    if so_id is None:
        return False
    if conversion_downstream_missing:
        return False
    return int(so_id) > 0


def _has_live_contract_link(quotation: Any, contract_downstream_missing: bool) -> bool:
    cid = getattr(quotation, "contract_id", None)
    if cid is None or int(cid) <= 0:
        return False
    if contract_downstream_missing:
        return False
    return True


def _sent_allows_business_action(status: str, audit_required: bool, review_status: Any) -> bool:
    if status != "已发送":
        return False
    if not audit_required:
        return True
    return _is_approved(review_status)


def derive_quotation_capabilities(
    quotation: Any,
    *,
    audit_required: bool,
    conversion_downstream_missing: bool = False,
    contract_downstream_missing: bool = False,
) -> QuotationCapabilities:
    st = _norm_status(getattr(quotation, "status", None))
    rs = getattr(quotation, "review_status", None)
    superseded = _is_superseded(quotation)
    linked_so = _has_live_sales_order_link(quotation, conversion_downstream_missing)
    linked_contract = _has_live_contract_link(quotation, contract_downstream_missing)

    # update — 草稿，或已发送且待审核（撤回审核后可编辑）
    update_allowed = st in ("草稿", "draft") or (st == "已发送" and _is_pending_review(rs))
    update_cap = _cap(
        update_allowed,
        None if update_allowed else "quotation.update.not_draft",
    )

    # delete
    delete_allowed = False
    delete_reason = "quotation.delete.not_allowed"
    if conversion_downstream_missing:
        delete_allowed = True
    elif linked_so:
        delete_reason = "quotation.delete.linked_sales_order"
    elif linked_contract:
        delete_reason = "quotation.delete.linked_contract"
    elif st in ("草稿", "draft", "已拒绝", "rejected"):
        delete_allowed = True
    elif st == "已发送" and _is_pending_review(rs):
        delete_allowed = True
    elif st == "已转订单" and conversion_downstream_missing:
        delete_allowed = True
    delete_cap = _cap(delete_allowed, delete_reason if not delete_allowed else None)

    # submit (draft/rejected only; audit UI still uses record.audit)
    submit_allowed = st in ("草稿", "draft", "已拒绝", "rejected")
    submit_cap = _cap(submit_allowed, None if submit_allowed else "quotation.update.not_draft")

    # withdraw_submit — 已发送 + 待审核 → 草稿
    withdraw_allowed = audit_required and st == "已发送" and _is_pending_review(rs)
    withdraw_cap = _cap(
        withdraw_allowed,
        "quotation.withdraw_submit.not_pending" if not withdraw_allowed else None,
    )

    # approve — 已发送 + 待审核
    approve_allowed = audit_required and st == "已发送" and _is_pending_review(rs)
    approve_cap = _cap(
        approve_allowed,
        "quotation.approve.not_pending" if not approve_allowed else None,
    )

    # revoke_approval — 已发送 + 已通过（人工审→待审核，自动审→草稿）
    revoke_reason = "quotation.revoke_approval.not_allowed"
    if st == "已发送":
        if _is_approved(rs):
            revoke_allowed = True
            revoke_reason = None
        else:
            revoke_allowed = False
            revoke_reason = "quotation.revoke_approval.not_approved"
    else:
        revoke_allowed = False
    revoke_cap = _cap(revoke_allowed, revoke_reason if not revoke_allowed else None)

    # confirm_customer — 已发送；开审核时须已通过
    confirm_allowed = st == "已发送" and (not audit_required or _is_approved(rs))
    confirm_reason = (
        "quotation.confirm.not_sent"
        if st != "已发送"
        else "quotation.confirm.not_approved"
    )
    confirm_cap = _cap(confirm_allowed, confirm_reason if not confirm_allowed else None)

    # cancel_customer_confirm — 已接受且无有效下游合同关联 → 回到已发送（可撤回审核/删除）
    cancel_confirm_allowed = False
    cancel_confirm_reason = "quotation.cancel_customer_confirm.not_allowed"
    if st == "已接受":
        if linked_contract:
            cancel_confirm_reason = "quotation.cancel_customer_confirm.linked_contract"
        else:
            cancel_confirm_allowed = True
    cancel_confirm_cap = _cap(
        cancel_confirm_allowed,
        cancel_confirm_reason if not cancel_confirm_allowed else None,
    )

    # convert_to_order
    convert_order_allowed = False
    convert_order_reason = "quotation.convert_order.not_allowed"
    if linked_contract:
        convert_order_reason = "quotation.convert_order.linked_contract"
    elif superseded or getattr(quotation, "is_latest_in_series", True) is False:
        convert_order_reason = "quotation.convert_order.not_latest"
    elif st == "已拒绝":
        convert_order_reason = "quotation.convert_order.not_allowed"
    elif st == "已转订单":
        convert_order_allowed = conversion_downstream_missing
    elif st == "已接受":
        convert_order_allowed = not linked_so
    elif _sent_allows_business_action(st, audit_required, rs):
        convert_order_allowed = not linked_so
    convert_order_cap = _cap(
        convert_order_allowed,
        convert_order_reason if not convert_order_allowed else None,
    )

    # convert_to_contract
    convert_contract_allowed = False
    convert_contract_reason = "quotation.convert_contract.not_allowed"
    if superseded:
        convert_contract_reason = "quotation.convert_contract.superseded"
    elif linked_contract:
        convert_contract_reason = "quotation.convert_contract.linked_contract"
    elif linked_so:
        convert_contract_reason = "quotation.convert_contract.linked_sales_order"
    elif st == "已转订单":
        if conversion_downstream_missing:
            convert_contract_allowed = True
        else:
            convert_contract_reason = "quotation.convert_contract.not_allowed"
    elif st == "已接受":
        convert_contract_allowed = True
    elif _sent_allows_business_action(st, audit_required, rs):
        convert_contract_allowed = True
    convert_contract_cap = _cap(
        convert_contract_allowed,
        convert_contract_reason if not convert_contract_allowed else None,
    )

    # revoke_push
    revoke_push_allowed = st == "已转订单" and conversion_downstream_missing
    revoke_push_cap = _cap(
        revoke_push_allowed,
        "quotation.revoke_push.not_allowed" if not revoke_push_allowed else None,
    )

    # reopen
    reopen_allowed = st == "已拒绝"
    reopen_cap = _cap(
        reopen_allowed,
        "quotation.reopen.not_rejected" if not reopen_allowed else None,
    )

    # create_revision
    revision_allowed = (
        getattr(quotation, "is_latest_in_series", True) is not False
        and st not in ("草稿", "draft", "")
    )
    revision_cap = _cap(
        revision_allowed,
        "quotation.revision.not_allowed" if not revision_allowed else None,
    )

    # print_formal
    print_allowed = st in ("已接受", "已转订单") or (
        st == "已发送" and (not audit_required or _is_approved(rs))
    )
    print_cap = _cap(
        print_allowed,
        "quotation.print.not_allowed" if not print_allowed else None,
    )

    return QuotationCapabilities(
        update=update_cap,
        delete=delete_cap,
        submit=submit_cap,
        withdraw_submit=withdraw_cap,
        approve=approve_cap,
        revoke_approval=revoke_cap,
        confirm_customer=confirm_cap,
        cancel_customer_confirm=cancel_confirm_cap,
        convert_to_order=convert_order_cap,
        convert_to_contract=convert_contract_cap,
        revoke_push=revoke_push_cap,
        reopen=reopen_cap,
        create_revision=revision_cap,
        print_formal=print_cap,
    )


def assert_quotation_capability(
    quotation: Any,
    action: str,
    *,
    audit_required: bool,
    conversion_downstream_missing: bool = False,
    contract_downstream_missing: bool = False,
) -> None:
    caps = derive_quotation_capabilities(
        quotation,
        audit_required=audit_required,
        conversion_downstream_missing=conversion_downstream_missing,
        contract_downstream_missing=contract_downstream_missing,
    )
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "submit": caps.submit,
        "withdraw_submit": caps.withdraw_submit,
        "approve": caps.approve,
        "revoke_approval": caps.revoke_approval,
        "confirm_customer": caps.confirm_customer,
        "cancel_customer_confirm": caps.cancel_customer_confirm,
        "convert_to_order": caps.convert_to_order,
        "convert_to_contract": caps.convert_to_contract,
        "revoke_push": caps.revoke_push,
        "reopen": caps.reopen,
        "create_revision": caps.create_revision,
        "print_formal": caps.print_formal,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown quotation capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)


def quotation_capabilities_to_suggestions(
    caps: QuotationCapabilities,
    *,
    audit_required: bool,
    conversion_downstream_missing: bool = False,
) -> list[str]:
    """由 capabilities 派生 lifecycle next_step_suggestions。"""
    suggestions: list[str] = []
    if caps.submit.allowed:
        suggestions.append("提交报价单")
    if caps.reopen.allowed:
        suggestions.append("修改报价单后点击「重新编辑」回到草稿，再提交审核")
    if audit_required and caps.delete.allowed and not caps.confirm_customer.allowed and not caps.convert_to_order.allowed:
        suggestions.extend(["审核通过", "审核驳回", "撤回提交（整单回草稿）"])
    if caps.confirm_customer.allowed:
        suggestions.append("客户确认（标记已接受）")
    if caps.cancel_customer_confirm.allowed:
        suggestions.append("客户取消确认（回到已发送，可撤回审核或删除）")
    if caps.convert_to_order.allowed:
        if audit_required and caps.confirm_customer.allowed:
            suggestions.append("转销售订单（下推，可直接下推不经客户确认）")
        else:
            suggestions.append("转销售订单（下推）")
    if caps.print_formal.allowed and (audit_required or caps.confirm_customer.allowed):
        suggestions.append("生成正式报价 PDF")
    if caps.revoke_approval.allowed:
        suggestions.append(
            "撤销审核（回到待审核）" if audit_required else "撤销审核（回到草稿）"
        )
    if conversion_downstream_missing:
        suggestions.extend(
            [
                "可点击「撤回下推」解除与已删订单的关联并回到已接受",
                "或直接重新下推转销售订单（系统将自动解除无效关联）",
            ]
        )
        if caps.delete.allowed:
            suggestions.append("删除本报价单")
    if caps.create_revision.allowed:
        suggestions.append("新建修订版")
    return suggestions
