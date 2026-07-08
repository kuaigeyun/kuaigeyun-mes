"""审核相位单一派生。

`record.audit = { entity_type, phase, enabled, mode, allowed_actions }` 是前端 uni-audit 的
**唯一来源**。ApprovalInstance 是运行时唯一写者（完成回调把结果写回单据
status / review_status），因此列表无需逐行查实例——由 status / review_status
确定性派生 phase 即可。

``enabled``（= manual）：是否启用**人工**审批流（绑定流程且开关打开）。
``enabled=False`` 表示 **自动通过审核**（提交即写入已通过态），**不是**跳过审核；
phase 仍由 status / review_status 派生，UI 须展示审核状态列。

phase ∈ ``draft`` | ``pending`` | ``approved`` | ``rejected`` | ``none``

撤销审核落点见 ``audit_transition.resolve_revoke_landing_phase``（人工→pending，自动→draft）。
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
    # 报价单：客户确认 / 已转单后不再展示反审核（与 revoke_review 仅允许「已发送」一致）
    "已接受", "accepted", "已转订单", "converted",
}
# 已通过态仍禁止撤销审核的主状态（终态 / 报价转单后）
_REVOKE_DENIED_STATUSES = frozenset({
    "completed", "已完成",
    "closed", "已关闭",
    "cancelled", "已取消",
    "已接受", "accepted",
    "已转订单", "converted",
})
_REJECTED_STATUS = {"rejected", "已驳回", "审核驳回"}
_REVIEW_APPROVED = {"approved", "审核通过", "已通过", "通过", "已审核"}
_REVIEW_REJECTED = {"rejected", "已驳回", "审核驳回"}
_REVIEW_PENDING = {"待审核", "pending_review", "pending_approval", "已提交"}
_REVIEW_DRAFT = {"草稿", "draft", ""}

# 提交后仍保持主状态为草稿、仅 review_status 进入待审的单据（如采购询价）
_DRAFT_REVIEW_PENDING_ENTITY_TYPES = frozenset({"purchase_inquiry"})

# 来料/过程/成品/出货检验：主状态「已检验」+ review 待审（与 quality_inspection_record capabilities 一致）
_QUALITY_INSPECTION_ENTITY_TYPES = frozenset({
    "incoming_inspection",
    "process_inspection",
    "finished_goods_inspection",
    "oqc_inspection",
})
_QUALITY_INSPECTION_PENDING_MAIN_STATUSES = frozenset({
    "已检验", "inspected", "待审核", "pending_review",
})

# 审核已通过、主 status 进入业务履约态（无 review_status 字段的单据）
_ENTITY_APPROVED_BUSINESS_STATUSES: Dict[str, frozenset[str]] = {
    "shipment_notice": frozenset({"待发货", "已通知", "已出库", "notified", "shipped"}),
    "sales_delivery": frozenset({"待出库", "已出库", "completed", "已完成"}),
}
# 业务 status 与 review_status 分离的退货单（主状态待退货/已退货，审核看 review_status）
_RETURN_REVIEW_ENTITY_TYPES = frozenset({"sales_return", "purchase_return"})
# 财务 AR/AP/进项：主 status 为收付款态，审核看 review_status
_FINANCE_REVIEW_ENTITY_TYPES = frozenset({"receivable", "payable", "purchase_invoice"})
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
    elif entity_type in _RETURN_REVIEW_ENTITY_TYPES | _FINANCE_REVIEW_ENTITY_TYPES:
        if r in _REVIEW_PENDING:
            phase = "pending"
        elif r in _REVIEW_APPROVED:
            phase = "approved"
        elif r in _REVIEW_DRAFT or s in _DRAFT:
            phase = "draft"
        else:
            phase = "none"
    elif (
        entity_type in _QUALITY_INSPECTION_ENTITY_TYPES
        and r in _REVIEW_PENDING
        and s in _QUALITY_INSPECTION_PENDING_MAIN_STATUSES
    ):
        phase = "pending"
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
    elif entity_type in _ENTITY_APPROVED_BUSINESS_STATUSES and s in _ENTITY_APPROVED_BUSINESS_STATUSES[entity_type]:
        phase = "approved"
    else:
        phase = "none"

    allowed = list(_ALLOWED_ACTIONS_BY_PHASE[phase])
    # 已通过态默认允许 revoke；终态或报价转单后禁止（业务能力门控见 audit_capability_gate）
    if phase == "approved":
        allow_revoke = s not in _REVOKE_DENIED_STATUSES
        if not allow_revoke:
            allowed = []

    if entity_type in _QUALITY_INSPECTION_ENTITY_TYPES:
        if phase == "pending":
            allowed = [a for a in allowed if a in ("approve", "reject")]
        else:
            allowed = []

    # 审核关闭（自动通过）：不提供人工审/驳回；已通过态仍保留 revoke，便于撤回后再编辑
    if not enabled:
        if phase in ("draft", "rejected"):
            allowed = ["submit"]
        elif phase == "pending":
            allowed = ["withdraw"]
        elif phase == "approved":
            allowed = [a for a in allowed if a == "revoke"]
        else:
            allowed = []

    return {
        "entity_type": entity_type,
        "phase": phase,
        "enabled": bool(enabled),
        "mode": "manual" if enabled else "auto",
        "allowed_actions": allowed,
    }
