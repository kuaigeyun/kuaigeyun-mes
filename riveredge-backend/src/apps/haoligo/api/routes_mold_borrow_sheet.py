"""好力 GO — 模具领用单 API。"""

from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_borrow_sheet import HaoligoMoldBorrowSheet
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/molds/borrow-sheets", tags=["App · HaoliGO · 领用单"])


class MoldBorrowSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    source_order_no: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: str
    mold_code: str
    mold_name: str
    finished_product_code: Optional[str] = None
    finished_product_name: Optional[str] = None
    planned_qty: Optional[Decimal] = None


class MoldBorrowSheetCreate(BaseModel):
    source_order_no: Optional[str] = Field(None, max_length=128)
    department_uuid: Optional[str] = Field(None, max_length=36)
    department_name: str = Field(max_length=200)
    mold_code: str = Field(max_length=64)
    mold_name: str = Field(max_length=200)
    finished_product_code: Optional[str] = Field(None, max_length=128)
    finished_product_name: Optional[str] = Field(None, max_length=200)
    planned_qty: Optional[Decimal] = None

    @field_validator("department_name", "mold_code", "mold_name", mode="before")
    @classmethod
    def strip_required_strings(cls, v):
        if v is None:
            raise ValueError("不能为空")
        s = str(v).strip()
        if not s:
            raise ValueError("不能为空")
        return s


class MoldBorrowSheetUpdate(BaseModel):
    source_order_no: Optional[str] = Field(None, max_length=128)
    department_uuid: Optional[str] = Field(None, max_length=36)
    department_name: Optional[str] = Field(None, max_length=200)
    mold_code: Optional[str] = Field(None, max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    finished_product_code: Optional[str] = Field(None, max_length=128)
    finished_product_name: Optional[str] = Field(None, max_length=200)
    planned_qty: Optional[Decimal] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _serialize(row: HaoligoMoldBorrowSheet) -> MoldBorrowSheetOut:
    return MoldBorrowSheetOut(
        id=row.id,
        uuid=row.uuid,
        source_order_no=row.source_order_no,
        department_uuid=row.department_uuid,
        department_name=row.department_name,
        mold_code=row.mold_code,
        mold_name=row.mold_name,
        finished_product_code=row.finished_product_code,
        finished_product_name=row.finished_product_name,
        planned_qty=row.planned_qty,
    )


@router.get("", summary="领用单分页列表")
async def list_borrow_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
):
    qs = tenant_alive(HaoligoMoldBorrowSheet, tenant_id)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(source_order_no__icontains=k)
            | Q(mold_code__icontains=k)
            | Q(mold_name__icontains=k)
            | Q(department_name__icontains=k)
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


@router.post("", response_model=MoldBorrowSheetOut, summary="创建领用单")
async def create_borrow_sheet(
    body: MoldBorrowSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoMoldBorrowSheet.create(
        tenant_id=tenant_id,
        source_order_no=(body.source_order_no or "").strip() or None,
        department_uuid=(body.department_uuid or "").strip() or None,
        department_name=body.department_name.strip(),
        mold_code=body.mold_code.strip(),
        mold_name=body.mold_name.strip(),
        finished_product_code=(body.finished_product_code or "").strip() or None,
        finished_product_name=(body.finished_product_name or "").strip() or None,
        planned_qty=body.planned_qty,
    )
    return _serialize(row)


@router.get("/{row_id}", response_model=MoldBorrowSheetOut, summary="领用单详情")
async def get_borrow_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return _serialize(row)


@router.patch("/{row_id}", response_model=MoldBorrowSheetOut, summary="更新领用单")
async def update_borrow_sheet(
    row_id: int,
    body: MoldBorrowSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    if "department_name" in data and data["department_name"] is not None:
        data["department_name"] = str(data["department_name"]).strip()
    for k in ("mold_code", "mold_name"):
        if k in data and data[k] is not None:
            data[k] = str(data[k]).strip()
    for k in ("source_order_no", "department_uuid", "finished_product_code", "finished_product_name"):
        if k in data and data[k] is not None:
            v = str(data[k]).strip()
            data[k] = v or None
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除领用单")
async def delete_borrow_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
