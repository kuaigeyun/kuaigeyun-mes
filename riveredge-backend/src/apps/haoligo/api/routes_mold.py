"""好力 GO — 模具主数据 API。"""

from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold import HaoligoMold
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/molds", tags=["App · HaoliGO · 模具"])


class MoldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    mold_code: str
    name: str
    unit: str = ""
    mold_capacity: Decimal = Decimal("0")
    processing_time_min: Optional[int] = None
    service_life_years: Optional[int] = None
    usable_times: Optional[int] = None
    usable_yield: Optional[Decimal] = None
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = None
    allow_repeated_borrow: bool = True
    purchase_vendor_name: Optional[str] = None
    status: str
    total_manufacture_qty: Decimal
    outsource_vendor_code: Optional[str] = None
    outsource_vendor_name: Optional[str] = None
    erp_material_code: Optional[str] = None
    remark: Optional[str] = None


class MoldCreate(BaseModel):
    mold_code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    unit: str = Field(default="", max_length=32)
    mold_capacity: Decimal = Field(default=Decimal("0"))
    processing_time_min: Optional[int] = Field(None, ge=0)
    service_life_years: Optional[int] = Field(None, ge=0)
    usable_times: Optional[int] = Field(None, ge=0)
    usable_yield: Optional[Decimal] = None
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)
    allow_repeated_borrow: bool = True
    purchase_vendor_name: Optional[str] = Field(None, max_length=200)
    status: str = Field(default="待用", max_length=32)
    total_manufacture_qty: Decimal = Field(default=Decimal("0"))
    outsource_vendor_code: Optional[str] = Field(None, max_length=64)
    outsource_vendor_name: Optional[str] = Field(None, max_length=200)
    erp_material_code: Optional[str] = Field(None, max_length=64)
    remark: Optional[str] = None


class MoldUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    unit: Optional[str] = Field(None, max_length=32)
    mold_capacity: Optional[Decimal] = None
    processing_time_min: Optional[int] = Field(None, ge=0)
    service_life_years: Optional[int] = Field(None, ge=0)
    usable_times: Optional[int] = Field(None, ge=0)
    usable_yield: Optional[Decimal] = None
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)
    allow_repeated_borrow: Optional[bool] = None
    purchase_vendor_name: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, max_length=32)
    total_manufacture_qty: Optional[Decimal] = None
    outsource_vendor_code: Optional[str] = Field(None, max_length=64)
    outsource_vendor_name: Optional[str] = Field(None, max_length=200)
    erp_material_code: Optional[str] = Field(None, max_length=64)
    remark: Optional[str] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


@router.get("", summary="模具分页列表")
async def list_molds(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    qs = tenant_alive(HaoligoMold, tenant_id)
    if status_filter:
        qs = qs.filter(status=status_filter)
    total = await qs.count()
    rows = await qs.order_by("mold_code").offset(skip).limit(limit)
    return {
        "items": [MoldOut.model_validate(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=MoldOut, summary="创建模具")
async def create_mold(
    body: MoldCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoMold.create(
        tenant_id=tenant_id,
        mold_code=body.mold_code.strip(),
        name=body.name.strip(),
        unit=(body.unit or "").strip(),
        mold_capacity=body.mold_capacity,
        processing_time_min=body.processing_time_min,
        service_life_years=body.service_life_years,
        usable_times=body.usable_times,
        usable_yield=body.usable_yield,
        maintenance_cycle_by_yield=body.maintenance_cycle_by_yield,
        maintenance_cycle_by_days=body.maintenance_cycle_by_days,
        allow_repeated_borrow=body.allow_repeated_borrow,
        purchase_vendor_name=((body.purchase_vendor_name or "").strip() or None),
        status=body.status,
        total_manufacture_qty=body.total_manufacture_qty,
        outsource_vendor_code=body.outsource_vendor_code,
        outsource_vendor_name=body.outsource_vendor_name,
        erp_material_code=body.erp_material_code,
        remark=body.remark,
    )
    return MoldOut.model_validate(row)


@router.get("/{row_id}", response_model=MoldOut, summary="模具详情")
async def get_mold(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMold, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return MoldOut.model_validate(row)


@router.patch("/{row_id}", response_model=MoldOut, summary="更新模具")
async def update_mold(
    row_id: int,
    body: MoldUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMold, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if isinstance(v, str):
            v = v.strip()
        setattr(row, k, v)
    await row.save()
    return MoldOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除模具")
async def delete_mold(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMold, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
