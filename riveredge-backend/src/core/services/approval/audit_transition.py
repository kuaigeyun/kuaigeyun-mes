"""审核动作落点（与 ``audit_phase.allowed_actions`` 配套）。

标准流转（主流 ERP / OA 实践）::

    人工审核 (manual)::

        draft --submit--> pending --approve--> approved
        approved --revoke--> pending --withdraw--> draft

    自动审核 (auto)::

        draft --submit--> approved
        approved --revoke--> draft --submit--> approved

``revoke`` 在自动审模式下须落到 ``draft``，否则 pending 态无法 ``submit``；
``withdraw`` 仅人工审 pending 态提供，退回 draft。
"""

from __future__ import annotations

from typing import Literal, TypedDict

RevokeLandingPhase = Literal["draft", "pending"]


class SalesOrderRevokeState(TypedDict):
    """销售订单 revoke 后写入 DB 的 status / review_status（唯一真源）。"""

    status: str
    review_status: str


def resolve_revoke_landing_phase(*, manual_audit_enabled: bool) -> RevokeLandingPhase:
    """确定 revoke 动作的目标审核相位。"""
    return "pending" if manual_audit_enabled else "draft"


def resolve_sales_order_revoke_state(*, landing: RevokeLandingPhase) -> SalesOrderRevokeState:
    """销售订单撤销审核后的主状态与 review_status（与 withdraw_sales_order 草稿态一致）。"""
    if landing == "pending":
        return {"status": "PENDING_REVIEW", "review_status": "PENDING"}
    return {"status": "DRAFT", "review_status": "PENDING"}
