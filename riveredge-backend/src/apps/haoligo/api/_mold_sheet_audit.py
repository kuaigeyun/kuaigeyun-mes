"""模具单据审核：状态守卫与通用校验。"""

from __future__ import annotations

from typing import Any, Type, TypeVar

from fastapi import HTTPException, status
from tortoise.models import Model

from apps.haoligo.api._qs import tenant_alive

TModel = TypeVar("TModel", bound=Model)

from apps.haoligo.constants.mold_sheet_audit import (
    SHEET_AUDIT_STATUS_SET,
    SHEET_STATUS_APPROVED,
    SHEET_STATUS_PENDING,
    SHEET_STATUS_REJECTED,
)


def effective_sheet_status(row: Any) -> str:
    raw = (getattr(row, "sheet_status", None) or "").strip()
    if raw in SHEET_AUDIT_STATUS_SET:
        return raw
    return SHEET_STATUS_PENDING


def assert_sheet_mutation_allowed(row: Any, *, detail: str | None = None) -> None:
    if effective_sheet_status(row) == SHEET_STATUS_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail or "已通过审核的单据不可修改或删除",
        )


def assert_pending_for_audit(row: Any) -> None:
    if effective_sheet_status(row) != SHEET_STATUS_PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅待审核状态可审核",
        )


def assert_approved_for_revoke(row: Any) -> None:
    if effective_sheet_status(row) != SHEET_STATUS_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅已通过状态可撤销审核",
        )


def apply_rejected_resubmit_fields(data: dict[str, Any], row: Any) -> None:
    """已驳回单据保存后重新进入待审核。"""
    if effective_sheet_status(row) == SHEET_STATUS_REJECTED:
        data["sheet_status"] = SHEET_STATUS_PENDING
        data["audited_at"] = None
        data["audited_by_user_id"] = None


async def load_sheet_row_for_audit(
    model: Type[TModel],
    tenant_id: int,
    row_id: int,
) -> TModel:
    """审核操作前加行锁，避免并发双点审核导致状态错乱或未捕获的数据库异常。"""
    row = await tenant_alive(model, tenant_id).select_for_update().filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    return row
