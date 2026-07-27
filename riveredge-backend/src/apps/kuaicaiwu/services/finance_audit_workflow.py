"""应收/应付/进项发票：review_status 审核流（与 audit_phase 财务 entity 配套）。

关闭人工审核（auto）：提交即写入已审核；开启时启动平台审批实例后进入待审。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Type

from apps.common.audit_actor import operator_name_from_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime

_SUBMITTABLE_REVIEW = frozenset({"草稿", "draft", "驳回", "rejected", "已驳回"})
_PENDING_REVIEW = frozenset({"待审核", "pending_review", "pending_approval", "已提交"})
_APPROVED_REVIEW = frozenset({"approved", "已审核"})

_DOC_CODE_ATTR = {
    "payable": "payable_code",
    "receivable": "receivable_code",
    "purchase_invoice": "invoice_code",
}


def _norm_review(value: Any) -> str:
    return str(value or "").strip()


async def _updated_audit_kwargs(updated_by: int) -> dict[str, Any]:
    user = await User.filter(id=updated_by).first()
    return {
        "updated_by": updated_by,
        "updated_by_name": operator_name_from_user(user) if user else "",
    }


async def _auto_approve_finance(
    *,
    model: Type[Any],
    tenant_id: int,
    doc_id: int,
    updated_by: int,
    node_key: str,
) -> None:
    user = await User.filter(id=updated_by).first()
    approver_name = operator_name_from_user(user) if user else ""
    patch: dict[str, Any] = {
        "review_status": "已审核",
        "reviewer_id": updated_by,
        "reviewer_name": approver_name,
        "review_time": resolve_business_datetime(),
        "review_remarks": "自动审核",
        "updated_by": updated_by,
        "updated_by_name": approver_name,
    }
    if node_key == "purchase_invoice":
        patch["status"] = "已审核"
    await model.filter(tenant_id=tenant_id, id=doc_id).update(**patch)


async def submit_finance_review(
    *,
    model: Type[Any],
    tenant_id: int,
    doc_id: int,
    updated_by: int,
    doc_label: str,
    node_key: str,
) -> None:
    from core.services.approval.approval_instance_service import ApprovalInstanceService
    from infra.services.business_config_service import BusinessConfigService

    if node_key not in _DOC_CODE_ATTR:
        raise BusinessLogicError(f"不支持的财务审核节点: {node_key}")

    doc = await model.get_or_none(tenant_id=tenant_id, id=doc_id, deleted_at__isnull=True)
    if not doc:
        raise NotFoundError(f"{doc_label}不存在: {doc_id}")

    review_status = _norm_review(getattr(doc, "review_status", None))
    audit_required = await BusinessConfigService().check_audit_required(tenant_id, node_key)

    # 自动模式下误入待审：再次提交即自动通过
    if review_status in _PENDING_REVIEW and not audit_required:
        await _auto_approve_finance(
            model=model,
            tenant_id=tenant_id,
            doc_id=doc_id,
            updated_by=updated_by,
            node_key=node_key,
        )
        return

    if review_status in _PENDING_REVIEW:
        raise BusinessLogicError(f"{doc_label}已提交待审核，无需重复提交")
    if review_status in _APPROVED_REVIEW:
        raise BusinessLogicError(f"{doc_label}已审核通过，无法提交")
    if review_status not in _SUBMITTABLE_REVIEW and review_status != "":
        raise BusinessLogicError(f"{doc_label}当前审核状态不可提交")

    if not audit_required:
        await _auto_approve_finance(
            model=model,
            tenant_id=tenant_id,
            doc_id=doc_id,
            updated_by=updated_by,
            node_key=node_key,
        )
        return

    code_attr = _DOC_CODE_ATTR[node_key]
    doc_code = str(getattr(doc, code_attr, None) or doc_id)
    partner = (
        getattr(doc, "supplier_name", None)
        or getattr(doc, "customer_name", None)
        or ""
    )
    amount = getattr(doc, "total_amount", None)
    content = f"{doc_label} {doc_code}"
    if partner:
        content = f"{content}, 往来单位: {partner}"
    if amount is not None:
        content = f"{content}, 金额: {amount}"

    instance = await ApprovalInstanceService.start_approval_for_node(
        tenant_id=tenant_id,
        user_id=updated_by,
        node_key=node_key,
        entity_type=node_key,
        entity_id=int(doc.id),
        entity_uuid=str(doc.uuid),
        title=f"{doc_label}审核: {doc_code}",
        content=content,
    )
    if not instance:
        raise BusinessLogicError(
            f"{doc_label}审核已开启但未找到可用的审批流程，"
            f"请在配置中心检查 {node_key} 审批流程是否已激活"
        )

    await model.filter(tenant_id=tenant_id, id=doc_id).update(
        review_status="待审核",
        **(await _updated_audit_kwargs(updated_by)),
    )


async def withdraw_finance_review(
    *,
    model: Type[Any],
    tenant_id: int,
    doc_id: int,
    updated_by: int,
    doc_label: str,
) -> None:
    doc = await model.get_or_none(tenant_id=tenant_id, id=doc_id, deleted_at__isnull=True)
    if not doc:
        raise NotFoundError(f"{doc_label}不存在: {doc_id}")
    review_status = _norm_review(getattr(doc, "review_status", None))
    if review_status not in _PENDING_REVIEW:
        raise BusinessLogicError(f"{doc_label}审核状态不是待审核，无法撤回提交")
    await model.filter(tenant_id=tenant_id, id=doc_id).update(
        review_status="草稿",
        reviewer_id=None,
        reviewer_name=None,
        review_time=None,
        review_remarks=None,
        **(await _updated_audit_kwargs(updated_by)),
    )


async def revoke_finance_review(
    *,
    model: Type[Any],
    tenant_id: int,
    doc_id: int,
    updated_by: int,
    doc_label: str,
    node_key: str,
) -> None:
    from core.services.approval.audit_transition import resolve_revoke_landing_phase
    from infra.services.business_config_service import BusinessConfigService

    doc = await model.get_or_none(tenant_id=tenant_id, id=doc_id, deleted_at__isnull=True)
    if not doc:
        raise NotFoundError(f"{doc_label}不存在: {doc_id}")
    review_status = _norm_review(getattr(doc, "review_status", None))
    if review_status not in _APPROVED_REVIEW:
        raise BusinessLogicError(f"{doc_label}未审核通过，无法撤销审核")

    audit_required = await BusinessConfigService().check_audit_required(tenant_id, node_key)
    landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
    patch: dict[str, Any] = {
        "review_status": "待审核" if landing == "pending" else "草稿",
        "reviewer_id": None,
        "reviewer_name": None,
        "review_time": None,
        "review_remarks": None,
        **(await _updated_audit_kwargs(updated_by)),
    }
    if node_key == "purchase_invoice":
        patch["status"] = "未审核"
    await model.filter(tenant_id=tenant_id, id=doc_id).update(**patch)
