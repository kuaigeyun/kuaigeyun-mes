"""审核相位单一派生。

`record.audit = { entity_type, phase, enabled, allowed_actions }` 是前端 uni-audit 的
**唯一来源**。ApprovalInstance 是运行时唯一写者（完成回调把结果写回单据
status / review_status），因此列表无需逐行查实例——由 status / review_status
确定性派生 phase 即可。

phase ∈ ``draft`` | ``pending`` | ``approved`` | ``rejected`` | ``none``
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

_DRAFT = {"draft", "草稿"}
_PENDING = {"pending_review", "pending_approval", "待审核", "已提交", "pending"}
_SENT_AWAITING_REVIEW = {"已发送", "sent"}
_AUDITED_STRICT = {"audited", "已审核", "approved"}
_APPROVED_ONGOING = {
    "confirmed", "已确认", "已生效", "effective",
    "executing", "执行中", "in_progress",
    "completed", "已完成", "closed", "已关闭",
}
_REJECTED_STATUS = {"rejected", "已驳回", "审核驳回"}
_REVIEW_APPROVED = {"approved", "审核通过", "已通过", "通过", "已审核"}
_REVIEW_REJECTED = {"rejected", "已驳回", "审核驳回"}
_REVIEW_PENDING = {"待审核", "pending_review", "pending_approval", "已提交"}

# 提交后仍保持主状态为草稿、仅 review_status 进入待审的单据（如采购询价）
_DRAFT_REVIEW_PENDING_ENTITY_TYPES = frozenset({"purchase_inquiry"})

# phase -> 该相位下允许的审核动作（前端据此渲染按钮，无需任何本地状态数组）
_ALLOWED_ACTIONS_BY_PHASE: Dict[str, List[str]] = {
    "draft": ["submit"],
    "rejected": ["submit"],
    "pending": ["approve", "reject", "withdraw"],
    "approved": ["revoke"],
    "none": [],
}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def derive_audit_phase(
    entity_type: str,
    status: Any,
    review_status: Any = None,
    *,
    enabled: bool,
) -> Dict[str, Any]:
    """由单据状态确定性派生审核相位与允许动作。

    Args:
        entity_type: 实体类型（= manifest.audit.entity_type，也即 ApprovalProcess.code）。
        status: 单据主状态。
        review_status: 单据审核状态（可空）。
        enabled: 该单据类型当前是否开启了人工审核（AuditDocumentBinding.is_enabled + 已绑定流程）。
    """
    s = _norm(status)
    r = _norm(review_status)

    if s in _REJECTED_STATUS or r in _REVIEW_REJECTED:
        phase = "rejected"
    elif s in _DRAFT:
        # 主状态仍为草稿但已提交待审（如采购询价单 status=DRAFT + review_status=待审核）
        if (
            entity_type in _DRAFT_REVIEW_PENDING_ENTITY_TYPES
            and r in _REVIEW_PENDING
        ):
            phase = "pending"
        else:
            phase = "draft"
    elif (s in _PENDING or s in _SENT_AWAITING_REVIEW) and r not in _REVIEW_APPROVED:
        phase = "pending"
    elif s in _AUDITED_STRICT or s in _APPROVED_ONGOING or r in _REVIEW_APPROVED:
        phase = "approved"
    else:
        phase = "none"

    allowed = list(_ALLOWED_ACTIONS_BY_PHASE[phase])
    # 反审核仅在「严格已审核」阶段可用；已确认/已生效/执行中等下游阶段不再展示审核动作。
    if phase == "approved" and not (s in _AUDITED_STRICT or (r in _REVIEW_APPROVED and s not in _APPROVED_ONGOING)):
        allowed = []

    return {
        "entity_type": entity_type,
        "phase": phase,
        "enabled": bool(enabled),
        "allowed_actions": allowed,
    }
