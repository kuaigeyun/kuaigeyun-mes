"""好力 GO — 模具仓库 API。"""

from __future__ import annotations

from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_warehouse import (
    MOLD_WAREHOUSE_TYPE_EXTERNAL,
    MOLD_WAREHOUSE_TYPE_INTERNAL,
    MOLD_WAREHOUSE_TYPES,
)
from apps.haoligo.models.equipment import HaoligoWorkshop
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_warehouse import HaoligoMoldWarehouse
from apps.master_data.models.supplier import Supplier as MasterSupplier
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/molds/warehouses",
    tags=["App · HaoliGO · 模具仓库"],
    dependencies=[Depends(require_module_access("haoligo", "molds-warehouse"))],
)

WarehouseTypeLiteral = Literal["内部", "外部"]


def _coerce_optional_workshop_id(v: object) -> int | None:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            return int(s)
        except ValueError as e:
            raise ValueError("所属车间无效") from e
    if isinstance(v, bool):
        raise ValueError("所属车间无效")
    try:
        return int(v)  # type: ignore[arg-type]
    except (TypeError, ValueError) as e:
        raise ValueError("所属车间无效") from e


class MoldWarehouseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    warehouse_code: str
    warehouse_name: str
    warehouse_type: str
    supplier_uuid: Optional[str] = None
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    workshop_id: Optional[int] = None
    workshop_code: Optional[str] = None
    workshop_name: Optional[str] = None


class MoldWarehouseCreate(BaseModel):
    warehouse_code: str = Field(max_length=64)
    warehouse_name: str = Field(max_length=200)
    warehouse_type: WarehouseTypeLiteral
    workshop_id: Optional[int] = Field(None, description="所属车间 ID（可选）")
    supplier_uuid: Optional[str] = Field(None, max_length=36)

    @field_validator("warehouse_code", "warehouse_name", mode="before")
    @classmethod
    def strip_required(cls, v, info):
        s = str(v or "").strip()
        if not s:
            raise ValueError(f"{info.field_name} 不能为空")
        return s

    @field_validator("workshop_id", mode="before")
    @classmethod
    def coerce_workshop_id(cls, v):
        return _coerce_optional_workshop_id(v)


class MoldWarehouseUpdate(BaseModel):
    warehouse_code: Optional[str] = Field(None, max_length=64)
    warehouse_name: Optional[str] = Field(None, max_length=200)
    warehouse_type: Optional[WarehouseTypeLiteral] = None
    workshop_id: Optional[int] = Field(None, description="所属车间 ID")
    supplier_uuid: Optional[str] = Field(None, max_length=36)

    @field_validator("warehouse_code", mode="before")
    @classmethod
    def strip_code(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError("仓库编号不能为空")
        return s

    @field_validator("warehouse_name", mode="before")
    @classmethod
    def strip_name(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError("仓库名称不能为空")
        return s

    @field_validator("workshop_id", mode="before")
    @classmethod
    def coerce_workshop_id(cls, v):
        return _coerce_optional_workshop_id(v)


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


async def _resolve_workshop(tenant_id: int, workshop_id: int) -> HaoligoWorkshop:
    row = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=workshop_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在，请先在主数据维护车间并刷新列表")
    return row


def _apply_workshop_fields(row: HaoligoMoldWarehouse, workshop: HaoligoWorkshop) -> None:
    row.workshop_id = workshop.id
    row.workshop_code = (workshop.code or "").strip()
    row.workshop_name = (workshop.name or "").strip()


def _clear_workshop_fields(row: HaoligoMoldWarehouse) -> None:
    row.workshop_id = None
    row.workshop_code = None
    row.workshop_name = None


async def _resolve_supplier(tenant_id: int, supplier_uuid: str) -> tuple[str, str, str]:
    uid = (supplier_uuid or "").strip()
    if not uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外部仓库须选择供应商")
    row = await MasterSupplier.filter(tenant_id=tenant_id, uuid=uid, deleted_at__isnull=True).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="供应商不存在")
    if not row.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="供应商已停用")
    return uid, (row.code or "").strip(), (row.name or "").strip()


def _apply_supplier_fields(
    row: HaoligoMoldWarehouse,
    *,
    warehouse_type: str,
    supplier_uuid: Optional[str],
    supplier_code: Optional[str],
    supplier_name: Optional[str],
) -> None:
    wt = (warehouse_type or "").strip()
    if wt == MOLD_WAREHOUSE_TYPE_INTERNAL:
        row.supplier_uuid = None
        row.supplier_code = None
        row.supplier_name = None
        return
    if wt == MOLD_WAREHOUSE_TYPE_EXTERNAL:
        row.supplier_uuid = supplier_uuid
        row.supplier_code = supplier_code
        row.supplier_name = supplier_name


async def _validate_type_and_supplier(
    tenant_id: int,
    *,
    warehouse_type: str,
    supplier_uuid: Optional[str],
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    wt = (warehouse_type or "").strip()
    if wt not in MOLD_WAREHOUSE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仓库类型无效")
    if wt == MOLD_WAREHOUSE_TYPE_INTERNAL:
        return None, None, None
    uid, code, name = await _resolve_supplier(tenant_id, supplier_uuid or "")
    return uid, code, name


@router.get("", response_model=List[MoldWarehouseOut], summary="模具仓库列表")
async def list_mold_warehouses(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    keyword: Optional[str] = Query(None),
    warehouse_type: Optional[str] = Query(None),
):
    qs = tenant_alive(HaoligoMoldWarehouse, tenant_id)
    if warehouse_type and warehouse_type.strip():
        qs = qs.filter(warehouse_type=warehouse_type.strip())
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(warehouse_code__icontains=k)
            | Q(warehouse_name__icontains=k)
            | Q(supplier_code__icontains=k)
            | Q(supplier_name__icontains=k)
            | Q(workshop_code__icontains=k)
            | Q(workshop_name__icontains=k)
        )
    rows = await qs.order_by("warehouse_code")
    return [_serialize_warehouse(r) for r in rows]


def _serialize_warehouse(row: HaoligoMoldWarehouse) -> MoldWarehouseOut:
    wid = _coerce_optional_workshop_id(getattr(row, "workshop_id", None))
    return MoldWarehouseOut(
        id=int(row.id),
        uuid=str(row.uuid),
        warehouse_code=str(row.warehouse_code or "").strip(),
        warehouse_name=str(row.warehouse_name or "").strip(),
        warehouse_type=str(row.warehouse_type or "").strip(),
        supplier_uuid=(str(row.supplier_uuid).strip() if row.supplier_uuid else None) or None,
        supplier_code=(str(row.supplier_code).strip() if row.supplier_code else None) or None,
        supplier_name=(str(row.supplier_name).strip() if row.supplier_name else None) or None,
        workshop_id=wid,
        workshop_code=(str(row.workshop_code).strip() if row.workshop_code else None) or None,
        workshop_name=(str(row.workshop_name).strip() if row.workshop_name else None) or None,
    )


@router.post("", response_model=MoldWarehouseOut, summary="创建模具仓库")
async def create_mold_warehouse(
    body: MoldWarehouseCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    code = body.warehouse_code.strip()
    if await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(warehouse_code=code).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="仓库编号已存在")
    suid, scode, sname = await _validate_type_and_supplier(
        tenant_id,
        warehouse_type=body.warehouse_type,
        supplier_uuid=body.supplier_uuid,
    )
    create_kwargs: dict = {
        "tenant_id": tenant_id,
        "warehouse_code": code,
        "warehouse_name": body.warehouse_name.strip(),
        "warehouse_type": body.warehouse_type,
        "supplier_uuid": suid,
        "supplier_code": scode,
        "supplier_name": sname,
        "workshop_id": None,
        "workshop_code": None,
        "workshop_name": None,
    }
    if body.workshop_id is not None:
        workshop = await _resolve_workshop(tenant_id, body.workshop_id)
        create_kwargs["workshop_id"] = workshop.id
        create_kwargs["workshop_code"] = (workshop.code or "").strip()
        create_kwargs["workshop_name"] = (workshop.name or "").strip()
    row = await HaoligoMoldWarehouse.create(**create_kwargs)
    return _serialize_warehouse(row)


@router.get("/{row_id}", response_model=MoldWarehouseOut, summary="模具仓库详情")
async def get_mold_warehouse(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return _serialize_warehouse(row)


@router.patch("/{row_id}", response_model=MoldWarehouseOut, summary="更新模具仓库")
async def update_mold_warehouse(
    row_id: int,
    body: MoldWarehouseUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.warehouse_code is not None:
        new_code = body.warehouse_code.strip()
        old_code = (row.warehouse_code or "").strip()
        if new_code != old_code:
            dup = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(warehouse_code=new_code).first()
            if dup and int(dup.id) != int(row.id):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="仓库编号已存在")
            row.warehouse_code = new_code
            await tenant_alive(HaoligoMold, tenant_id).filter(mold_warehouse_id=row.id).update(
                mold_warehouse_code=new_code
            )
    if body.warehouse_name is not None:
        row.warehouse_name = body.warehouse_name.strip()
    update_data = body.model_dump(exclude_unset=True)
    if "workshop_id" in update_data:
        if update_data["workshop_id"] is None:
            _clear_workshop_fields(row)
        else:
            workshop = await _resolve_workshop(tenant_id, int(update_data["workshop_id"]))
            _apply_workshop_fields(row, workshop)
    next_type = body.warehouse_type if body.warehouse_type is not None else row.warehouse_type
    next_supplier_uuid = body.supplier_uuid if body.supplier_uuid is not None else row.supplier_uuid
    if body.warehouse_type is not None or body.supplier_uuid is not None:
        suid, scode, sname = await _validate_type_and_supplier(
            tenant_id,
            warehouse_type=next_type,
            supplier_uuid=next_supplier_uuid,
        )
        _apply_supplier_fields(
            row,
            warehouse_type=next_type,
            supplier_uuid=suid,
            supplier_code=scode,
            supplier_name=sname,
        )
    if body.warehouse_type is not None:
        row.warehouse_type = next_type
    await row.save()
    return _serialize_warehouse(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除模具仓库")
async def delete_mold_warehouse(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
