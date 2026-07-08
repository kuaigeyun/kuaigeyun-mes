"""应收/应付/进项发票：review_status 审核流（与 audit_phase 财务 entity 配套）。"""

from __future__ import annotations

from typing import Any, Type

from infra.exceptions.exceptions import BusinessLogicError, NotFoundError

_SUBMITTABLE_REVIEW = frozenset({"草稿", "draft", "驳回", "rejected", "已驳回"})
_PENDING_REVIEW = frozenset({"待审核", "pending_review", "pending_approval", "已提交"})
_APPROVED_REVIEW = frozenset({"通过", "approved", "已审核"})


def _norm_review(value: Any) -> str:
    return str(value or "").strip()


async def submit_finance_review(
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
    if review_status in _PENDING_REVIEW:
        raise BusinessLogicError(f"{doc_label}已提交待审核，无需重复提交")
    if review_status in _APPROVED_REVIEW:
        raise BusinessLogicError(f"{doc_label}已审核通过，无法提交")
    if review_status not in _SUBMITTABLE_REVIEW and review_status != "":
        raise BusinessLogicError(f"{doc_label}当前审核状态不可提交")
    await model.filter(tenant_id=tenant_id, id=doc_id).update(
        review_status="待审核",
        updated_by=updated_by,
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
        updated_by=updated_by,
    )


async def revoke_finance_review(
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
    if review_status not in _APPROVED_REVIEW:
        raise BusinessLogicError(f"{doc_label}未审核通过，无法撤销审核")
    await model.filter(tenant_id=tenant_id, id=doc_id).update(
        review_status="待审核",
        reviewer_id=None,
        reviewer_name=None,
        review_time=None,
        review_remarks=None,
        updated_by=updated_by,
    )
