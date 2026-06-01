"""源单据删除守卫：存在未删除的下游完成单/子单时禁止删除源单。"""

from __future__ import annotations

from typing import Type

from fastapi import HTTPException, status
from tortoise.expressions import Q
from tortoise.models import Model

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_borrow_sheet import HaoligoMoldBorrowSheet
from apps.haoligo.models.mold_return_sheet import HaoligoMoldReturnSheet


async def assert_no_active_child_sheet_by_fk(
    tenant_id: int,
    *,
    child_model: Type[Model],
    source_fk_field: str,
    source_id: int,
    source_doc_label: str,
    child_doc_label: str,
) -> None:
    """存在关联且未软删的子单/完成单时，拒绝删除源单。"""
    filters = {source_fk_field: source_id, "deleted_at__isnull": True}
    child = await tenant_alive(child_model, tenant_id).filter(**filters).order_by("-id").first()
    if not child:
        return
    sheet_no = (getattr(child, "sheet_no", None) or "").strip()
    ref = f"「{sheet_no}」" if sheet_no else f"(ID {child.id})"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"已存在关联的{child_doc_label}{ref}，请先删除{child_doc_label}后再删除{source_doc_label}"
        ),
    )


async def assert_no_return_sheets_for_borrow_sheet(
    tenant_id: int,
    borrow_row: HaoligoMoldBorrowSheet,
) -> None:
    """领用单存在未删除还入单引用时不可删除。"""
    ref_q = Q(borrow_sheet_no=f"领用单#{borrow_row.id}")
    sheet_no = (borrow_row.sheet_no or "").strip()
    if sheet_no:
        ref_q |= Q(borrow_sheet_no=sheet_no)
    ret = (
        await tenant_alive(HaoligoMoldReturnSheet, tenant_id)
        .filter(ref_q, deleted_at__isnull=True)
        .order_by("-id")
        .first()
    )
    if not ret:
        return
    sheet_label = (ret.sheet_no or "").strip() or f"#{ret.id}"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"已存在关联的还入单「{sheet_label}」，请先删除还入单后再删除领用单",
    )
