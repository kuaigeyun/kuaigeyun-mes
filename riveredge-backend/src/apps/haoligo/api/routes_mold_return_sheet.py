"""好力 GO — 模具还入单 API。"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._mold_processing_time import (
    outstanding_borrow_ids_for_tenant,
    recompute_mold_processing_time_minutes,
)
from apps.haoligo.api._mold_ledger_sync import sync_mold_ledger_status_for_mold_code
from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_sheet_rule_codes import HAOLIGO_MOLD_RETURN_SHEET_NO
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_borrow_sheet import HaoligoMoldBorrowSheet
from apps.haoligo.models.mold_return_sheet import HaoligoMoldReturnSheet
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/molds/return-sheets",
    tags=["App · HaoliGO · 还入单"],
    dependencies=[Depends(require_haoligo_module_access("molds-documents-return-in"))],
)


def _strip_opt(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


class MoldReturnSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    production_order_no: Optional[str] = None
    borrow_sheet_no: Optional[str] = None
    issue_department_uuid: Optional[str] = None
    issue_department_name: Optional[str] = None
    mold_code: str
    mold_name: str
    finished_product_code: Optional[str] = None
    finished_product_name: Optional[str] = None
    planned_qty: Optional[Decimal] = None
    manufacture_qty: Decimal
    created_at: datetime


class MoldReturnSheetCreate(BaseModel):
    production_order_no: Optional[str] = Field(None, max_length=128)
    borrow_sheet_no: Optional[str] = Field(None, max_length=128)
    issue_department_uuid: Optional[str] = Field(None, max_length=36)
    issue_department_name: Optional[str] = Field(None, max_length=200)
    mold_code: str = Field(max_length=64)
    mold_name: str = Field(max_length=200)
    finished_product_code: Optional[str] = Field(None, max_length=128)
    finished_product_name: Optional[str] = Field(None, max_length=200)
    planned_qty: Optional[Decimal] = None
    manufacture_qty: Decimal = Field(description="制造数量（必填）")

    @field_validator("mold_code", "mold_name", mode="before")
    @classmethod
    def strip_required_strings(cls, v):
        if v is None:
            raise ValueError("不能为空")
        s = str(v).strip()
        if not s:
            raise ValueError("不能为空")
        return s

    @field_validator("manufacture_qty", mode="before")
    @classmethod
    def coerce_qty(cls, v):
        if v is None or v == "":
            raise ValueError("制造数量不能为空")
        try:
            d = Decimal(str(v))
        except Exception as e:  # noqa: BLE001
            raise ValueError("制造数量格式无效") from e
        if d < 0:
            raise ValueError("制造数量不能为负")
        return d

    @field_validator("planned_qty", mode="before")
    @classmethod
    def coerce_planned_qty(cls, v):
        if v is None or v == "":
            return None
        try:
            d = Decimal(str(v))
        except Exception as e:  # noqa: BLE001
            raise ValueError("计划数量格式无效") from e
        if d < 0:
            raise ValueError("计划数量不能为负")
        return d


class MoldReturnSheetUpdate(BaseModel):
    production_order_no: Optional[str] = Field(None, max_length=128)
    borrow_sheet_no: Optional[str] = Field(None, max_length=128)
    issue_department_uuid: Optional[str] = Field(None, max_length=36)
    issue_department_name: Optional[str] = Field(None, max_length=200)
    mold_code: Optional[str] = Field(None, max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    finished_product_code: Optional[str] = Field(None, max_length=128)
    finished_product_name: Optional[str] = Field(None, max_length=200)
    planned_qty: Optional[Decimal] = None
    manufacture_qty: Optional[Decimal] = None

    @field_validator("manufacture_qty", mode="before")
    @classmethod
    def coerce_manufacture_qty_upd(cls, v):
        if v is None or v == "":
            return None
        try:
            d = Decimal(str(v))
        except Exception as e:  # noqa: BLE001
            raise ValueError("制造数量格式无效") from e
        if d < 0:
            raise ValueError("制造数量不能为负")
        return d

    @field_validator("planned_qty", mode="before")
    @classmethod
    def coerce_planned_qty_upd(cls, v):
        if v is None or v == "":
            return None
        try:
            d = Decimal(str(v))
        except Exception as e:  # noqa: BLE001
            raise ValueError("计划数量格式无效") from e
        if d < 0:
            raise ValueError("计划数量不能为负")
        return d


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


async def _apply_mold_ledger_after_return_delta(
    tenant_id: int,
    mold_code: str,
    *,
    times_delta: int,
    yield_delta: Decimal,
) -> None:
    """还入单变更后：已使用次数/已使用产量累加或回滚；额定次数/产量不变。非报废模具状态置为「待用」。
    撤销还入（times_delta<0）时再按领用单 sync，以便在仍有领用单时恢复「在用」。"""
    mcode = (mold_code or "").strip()
    if not mcode:
        return
    if times_delta == 0 and yield_delta == 0:
        # 仅还入单资料变更：不调整已使用次数/产量；模具已还入，台账应为「待用」。
        # 不可再调 sync_mold_ledger_status_for_mold_code：其在仍有领用单记录时会强制「在用」，与还入语义冲突。
        mold0 = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mcode).first()
        if mold0 and mold0.status != "报废":
            mold0.status = "待用"
            await mold0.save(update_fields=["status"])
        return
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mcode).first()
    if not mold:
        await sync_mold_ledger_status_for_mold_code(tenant_id, mcode)
        return
    cur_t = int(mold.used_times or 0)
    cur_y = mold.used_yield if mold.used_yield is not None else Decimal("0")
    cur_total = mold.total_manufacture_qty if mold.total_manufacture_qty is not None else Decimal("0")
    if not isinstance(cur_y, Decimal):
        cur_y = Decimal(str(cur_y))
    if not isinstance(cur_total, Decimal):
        cur_total = Decimal(str(cur_total))
    mold.used_times = max(0, cur_t + int(times_delta))
    ny = cur_y + yield_delta
    if ny < 0:
        ny = Decimal("0")
    mold.used_yield = ny
    nt = cur_total + yield_delta
    if nt < 0:
        nt = Decimal("0")
    mold.total_manufacture_qty = nt
    if mold.status != "报废":
        mold.status = "待用"
    await mold.save(update_fields=["used_times", "used_yield", "total_manufacture_qty", "status"])
    # 还入增加/调整产量后模具在库，应为「待用」。sync 仅按「是否存在领用单」推在用，会覆盖上述结果。
    # 仅在撤销还入（times_delta < 0）时再 sync，以便在仍有领用单时恢复「在用」。
    if times_delta < 0:
        await sync_mold_ledger_status_for_mold_code(tenant_id, mcode)
    await recompute_mold_processing_time_minutes(tenant_id, mcode)


def _serialize(row: HaoligoMoldReturnSheet) -> MoldReturnSheetOut:
    return MoldReturnSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        production_order_no=row.production_order_no,
        borrow_sheet_no=row.borrow_sheet_no,
        issue_department_uuid=row.issue_department_uuid,
        issue_department_name=row.issue_department_name,
        mold_code=row.mold_code,
        mold_name=row.mold_name,
        finished_product_code=row.finished_product_code,
        finished_product_name=row.finished_product_name,
        planned_qty=row.planned_qty,
        manufacture_qty=row.manufacture_qty,
        created_at=row.created_at,
    )


@router.get("", summary="还入单分页列表")
async def list_return_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
):
    qs = tenant_alive(HaoligoMoldReturnSheet, tenant_id)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(production_order_no__icontains=k)
            | Q(borrow_sheet_no__icontains=k)
            | Q(sheet_no__icontains=k)
            | Q(mold_code__icontains=k)
            | Q(mold_name__icontains=k)
            | Q(issue_department_name__icontains=k)
            | Q(finished_product_code__icontains=k)
            | Q(finished_product_name__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    return {
        "items": [_serialize(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


class MoldReturnBorrowLookupOut(BaseModel):
    """从领用单带入还入单（制造数量仍手填；含计划数量）。"""

    borrow_sheet_id: int
    borrow_sheet_no: str
    production_order_no: Optional[str] = None
    issue_department_uuid: Optional[str] = None
    issue_department_name: Optional[str] = None
    mold_code: str
    mold_name: str
    finished_product_code: Optional[str] = None
    finished_product_name: Optional[str] = None
    planned_qty: Optional[Decimal] = None


def _borrow_sheet_to_lookup_out(row: HaoligoMoldBorrowSheet) -> MoldReturnBorrowLookupOut:
    return MoldReturnBorrowLookupOut(
        borrow_sheet_id=row.id,
        borrow_sheet_no=(row.sheet_no or "").strip() or f"领用单#{row.id}",
        production_order_no=_strip_opt(row.source_order_no),
        issue_department_uuid=_strip_opt(row.department_uuid),
        issue_department_name=_strip_opt(row.department_name),
        mold_code=row.mold_code,
        mold_name=row.mold_name,
        finished_product_code=_strip_opt(row.finished_product_code),
        finished_product_name=_strip_opt(row.finished_product_name),
        planned_qty=row.planned_qty,
    )


class MoldOutstandingBorrowOut(MoldReturnBorrowLookupOut):
    created_at: datetime


@router.get(
    "/outstanding-borrows",
    summary="待还入领用单列表（已领用、尚未配对还入单）",
)
async def list_outstanding_borrows_for_return(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
):
    outstanding_ids = await outstanding_borrow_ids_for_tenant(tenant_id)
    if not outstanding_ids:
        return {"items": [], "total": 0, "skip": skip, "limit": limit}
    qs = tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(id__in=list(outstanding_ids))
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(sheet_no__icontains=k)
            | Q(mold_code__icontains=k)
            | Q(mold_name__icontains=k)
            | Q(department_name__icontains=k)
            | Q(source_order_no__icontains=k)
            | Q(finished_product_code__icontains=k)
            | Q(finished_product_name__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit).all()
    items = [
        MoldOutstandingBorrowOut(
            **_borrow_sheet_to_lookup_out(row).model_dump(),
            created_at=row.created_at,
        )
        for row in rows
    ]
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get(
    "/borrow-lookup",
    response_model=MoldReturnBorrowLookupOut,
    summary="按制令单号或模具代号匹配领用单（用于还入单带出）",
)
async def borrow_lookup_for_return_sheet(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    production_order_no: Optional[str] = Query(None, max_length=128),
    mold_code: Optional[str] = Query(None, max_length=64),
    borrow_sheet_id: Optional[int] = Query(None, ge=1),
):
    if borrow_sheet_id is not None:
        row = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(id=borrow_sheet_id).first()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="领用单不存在")
        outstanding_ids = await outstanding_borrow_ids_for_tenant(tenant_id)
        if row.id not in outstanding_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="该领用单已还入或不可再还入",
            )
        return _borrow_sheet_to_lookup_out(row)

    p = (production_order_no or "").strip()
    m = (mold_code or "").strip()
    if not p and not m:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="请提供制令单号或模具代号至少一项",
        )
    qs = tenant_alive(HaoligoMoldBorrowSheet, tenant_id)
    row = None
    if p:
        row = await qs.filter(source_order_no=p).order_by("-id").first()
    if row is None and m:
        row = await qs.filter(mold_code=m).order_by("-id").first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未找到与制令单号或模具代号匹配的领用单",
        )
    return _borrow_sheet_to_lookup_out(row)


@router.post("", response_model=MoldReturnSheetOut, summary="创建还入单")
async def create_return_sheet(
    body: MoldReturnSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    async with in_transaction():
        try:
            sheet_no = await generate_mold_sheet_no(tenant_id, HAOLIGO_MOLD_RETURN_SHEET_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoMoldReturnSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            production_order_no=_strip_opt(body.production_order_no),
            borrow_sheet_no=_strip_opt(body.borrow_sheet_no),
            issue_department_uuid=_strip_opt(body.issue_department_uuid),
            issue_department_name=_strip_opt(body.issue_department_name),
            mold_code=body.mold_code.strip(),
            mold_name=body.mold_name.strip(),
            finished_product_code=_strip_opt(body.finished_product_code),
            finished_product_name=_strip_opt(body.finished_product_name),
            planned_qty=body.planned_qty,
            manufacture_qty=body.manufacture_qty,
        )
        await _apply_mold_ledger_after_return_delta(
            tenant_id,
            body.mold_code.strip(),
            times_delta=1,
            yield_delta=body.manufacture_qty,
        )
    return _serialize(row)


@router.get("/{row_id}", response_model=MoldReturnSheetOut, summary="还入单详情")
async def get_return_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldReturnSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return _serialize(row)


@router.patch("/{row_id}", response_model=MoldReturnSheetOut, summary="更新还入单")
async def update_return_sheet(
    row_id: int,
    body: MoldReturnSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldReturnSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    old_mold = row.mold_code.strip()
    old_qty = row.manufacture_qty
    for k in ("mold_code", "mold_name"):
        if k in data and data[k] is not None:
            data[k] = str(data[k]).strip()
            if not data[k]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{k} 不能为空")
    for k in (
        "production_order_no",
        "borrow_sheet_no",
        "issue_department_uuid",
        "issue_department_name",
        "finished_product_code",
        "finished_product_name",
    ):
        if k in data and data[k] is not None:
            data[k] = _strip_opt(str(data[k]))
    if "planned_qty" in data and data["planned_qty"] is not None and data["planned_qty"] < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="计划数量不能为负")
    for k, v in data.items():
        setattr(row, k, v)
    new_mold = row.mold_code.strip()
    new_qty = row.manufacture_qty
    async with in_transaction():
        if old_mold != new_mold:
            await _apply_mold_ledger_after_return_delta(tenant_id, old_mold, times_delta=-1, yield_delta=-old_qty)
            await _apply_mold_ledger_after_return_delta(tenant_id, new_mold, times_delta=1, yield_delta=new_qty)
        else:
            await _apply_mold_ledger_after_return_delta(
                tenant_id,
                new_mold,
                times_delta=0,
                yield_delta=new_qty - old_qty,
            )
        await row.save()
    return _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除还入单")
async def delete_return_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldReturnSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    mcode = row.mold_code.strip()
    qty = row.manufacture_qty
    async with in_transaction():
        await _apply_mold_ledger_after_return_delta(tenant_id, mcode, times_delta=-1, yield_delta=-qty)
        row.deleted_at = timezone.now()
        await row.save(update_fields=["deleted_at"])
