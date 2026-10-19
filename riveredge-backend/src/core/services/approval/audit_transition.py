"""审核动作落点（与 ``audit_phase.allowed_actions`` 配套）。

标准流转（主流 ERP / OA 实践）::

    人工审核 (manual)::

        draft --submit--> pending --approve--> approved
        approved --revoke--> pending（停在终审节点，可再审）
        pending --withdraw--> draft
    自动审核 (auto)::

        draft --submit--> approved
        approved --revoke--> draft --submit--> approved

人工审 ``revoke``：有多级流程时重开终审节点待办，单据落 ``pending``
（``resolve_revoke_landing_phase`` / ``reopen_at_last_approval_node``）。
无流程或自动审：落 ``draft``，须重新提交。

``withdraw`` 仅人工审 pending 态提供，退回 draft。
"""

from __future__ import annotations

from typing import Literal, TypedDict

RevokeLandingPhase = Literal["draft", "pending"]


class SalesOrderRevokeState(TypedDict):
    """销售订单 revoke 后写入 DB 的 status / review_status（唯一真源）。"""

    status: str
    review_status: str


def resolve_revoke_to_draft_landing_phase(
    *,
    manual_audit_enabled: bool = True,
    flow_reopened: bool = False,
) -> RevokeLandingPhase:
    """撤销审核落点。

    - 人工审且已重开终审节点 → pending
    - 人工审但无可用流程实例可重开 → draft（须重提）
    - 自动审 → draft
    """
    if manual_audit_enabled and flow_reopened:
        return "pending"
    return "draft"


def resolve_revoke_landing_phase(
    *,
    manual_audit_enabled: bool,
    flow_reopened: bool = False,
) -> RevokeLandingPhase:
    """撤销审核落点（与 ``resolve_revoke_to_draft_landing_phase`` 同义）。"""
    return resolve_revoke_to_draft_landing_phase(
        manual_audit_enabled=manual_audit_enabled,
        flow_reopened=flow_reopened,
    )


def resolve_sales_order_revoke_landing_phase(
    *,
    manual_audit_enabled: bool = True,
    flow_reopened: bool = False,
) -> RevokeLandingPhase:
    """销售订单别名；请新调用改用 ``resolve_revoke_to_draft_landing_phase``。"""
    return resolve_revoke_to_draft_landing_phase(
        manual_audit_enabled=manual_audit_enabled,
        flow_reopened=flow_reopened,
    )


def resolve_sales_order_revoke_state(*, landing: RevokeLandingPhase) -> SalesOrderRevokeState:
    """销售订单撤销审核后的主状态与 review_status（与 withdraw_sales_order 草稿态一致）。"""
    if landing == "pending":
        return {"status": "PENDING_REVIEW", "review_status": "PENDING"}
    return {"status": "DRAFT", "review_status": "PENDING"}
