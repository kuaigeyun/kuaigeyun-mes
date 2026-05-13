"""好力 GO — 模具还入单 API。"""

from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_return_sheet import HaoligoMoldReturnSheet
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/molds/return-sheets", tags=["App · HaoliGO · 还入单"])


def _strip_opt(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


class MoldReturnSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    production_order_no: Optional[str] = None
    borrow_sheet_no: Optional[str] = None
    issue_department_uuid: Optional[str] = None
    issue_department_name: Optional[str] = None
    mold_code: str
    mold_name: str
    finished_product_code: Optional[str] = None
    finished_product_name: Optional[str] = None
    manufacture_qty: Decimal


class MoldReturnSheetCreate(BaseModel):
    production_order_no: Optional[str] = Field(None, max_length=128)
    borrow_sheet_no: Optional[str] = Field(None, max_length=128)
    issue_department_uuid: Optional[str] = Field(None, max_length=36)
    issue_department_name: Optional[str] = Field(None, max_length=200)
    mold_code: str = Field(max_length=64)
    mold_name: str = Field(max_length=200)
    finished_product_code: Optional[str] = Field(None, max_length=128)
    finished_product_name: Optional[str] = Field(None, max_length=200)
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


class MoldReturnSheetUpdate(BaseModel):
    production_order_no: Optional[str] = Field(None, max_length=128)
    borrow_sheet_no: Optional[str] = Field(None, max_length=128)
    issue_department_uuid: Optional[str] = Field(None, max_length=36)
    issue_department_name: Optional[str] = Field(None, max_length=200)
    mold_code: Optional[str] = Field(None, max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    finished_product_code: Optional[str] = Field(None, max_length=128)
    finished_product_name: Optional[str] = Field(None, max_length=200)
    manufacture_qty: Optional[Decimal] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _serialize(row: HaoligoMoldReturnSheet) -> MoldReturnSheetOut:
    return MoldReturnSheetOut(
        id=row.id,
        uuid=row.uuid,
        production_order_no=row.production_order_no,
        borrow_sheet_no=row.borrow_sheet_no,
        issue_department_uuid=row.issue_department_uuid,
        issue_department_name=row.issue_department_name,
        mold_code=row.mold_code,
        mold_name=row.mold_name,
        finished_product_code=row.finished_product_code,
        finished_product_name=row.finished_product_name,
        manufacture_qty=row.manufacture_qty,
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


@router.post("", response_model=MoldReturnSheetOut, summary="创建还入单")
async def create_return_sheet(
    body: MoldReturnSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoMoldReturnSheet.create(
        tenant_id=tenant_id,
        production_order_no=_strip_opt(body.production_order_no),
        borrow_sheet_no=_strip_opt(body.borrow_sheet_no),
        issue_department_uuid=_strip_opt(body.issue_department_uuid),
        issue_department_name=_strip_opt(body.issue_department_name),
        mold_code=body.mold_code.strip(),
        mold_name=body.mold_name.strip(),
        finished_product_code=_strip_opt(body.finished_product_code),
        finished_product_name=_strip_opt(body.finished_product_name),
        manufacture_qty=body.manufacture_qty,
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
    if "manufacture_qty" in data and data["manufacture_qty"] is not None:
        mq = data["manufacture_qty"]
        if mq < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="制造数量不能为负")
    for k, v in data.items():
        setattr(row, k, v)
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
    row.deleted_at = timezone.now()
    await row.save()
