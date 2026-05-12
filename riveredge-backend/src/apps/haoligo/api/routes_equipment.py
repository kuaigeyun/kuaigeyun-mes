"""好力 GO — 设备主数据与巡检路线 API。"""

from __future__ import annotations

from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone
from tortoise.transactions import in_transaction

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import (
    HaoligoEquipment,
    HaoligoEquipmentCategory,
    HaoligoInspectionParam,
    HaoligoInspectionParamSet,
    HaoligoInspectionParamSetItem,
    HaoligoManufacturer,
    HaoligoPatrolRoute,
    HaoligoPatrolRouteStep,
    HaoligoWorkshop,
)
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/equipment", tags=["App · HaoliGO · 设备"])


# --- Pydantic ---


class WorkshopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str


class WorkshopCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)


class WorkshopUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)


class ManufacturerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str


class ManufacturerCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)


class ManufacturerUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)


class InspectionParamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str
    unit: Optional[str] = None
    value_type: str = "numeric"


class InspectionParamCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    unit: Optional[str] = Field(None, max_length=32)
    value_type: str = Field(default="numeric", max_length=32)


class InspectionParamSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str


class InspectionParamSetCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)


class SetItemCreate(BaseModel):
    param_id: int
    sort_order: int = 0
    is_required: bool = True


class SetItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    param_id: int
    set_id: int
    sort_order: int
    is_required: bool


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str
    default_inspection_param_set_id: Optional[int] = None


class CategoryCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    default_inspection_param_set_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    default_inspection_param_set_id: Optional[int] = None


class EquipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    asset_code: str
    name: str
    category_id: int
    workshop_id: int
    manufacturer_id: Optional[int] = None
    manufacture_date: Optional[date] = None
    inspection_param_set_id: Optional[int] = None
    remark: Optional[str] = None


class EquipmentCreate(BaseModel):
    asset_code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    category_id: int
    workshop_id: int
    manufacturer_id: Optional[int] = None
    manufacture_date: Optional[date] = None
    inspection_param_set_id: Optional[int] = None
    remark: Optional[str] = None


class EquipmentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    category_id: Optional[int] = None
    workshop_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    manufacture_date: Optional[date] = None
    inspection_param_set_id: Optional[int] = None
    remark: Optional[str] = None


class PatrolRouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str
    workshop_id: Optional[int] = None


class PatrolRouteCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    workshop_id: Optional[int] = None


class PatrolRouteUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    workshop_id: Optional[int] = None


class PatrolStepIn(BaseModel):
    equipment_id: int
    sequence: int = 0


class PatrolStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    equipment_id: int
    sequence: int


# --- helpers ---


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


# --- workshops ---


@router.get("/workshops", response_model=List[WorkshopOut], summary="车间列表")
async def list_workshops(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoWorkshop, tenant_id).order_by("code")
    return [WorkshopOut.model_validate(r) for r in rows]


@router.post("/workshops", response_model=WorkshopOut, summary="创建车间")
async def create_workshop(
    body: WorkshopCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoWorkshop.create(tenant_id=tenant_id, code=body.code.strip(), name=body.name.strip())
    return WorkshopOut.model_validate(row)


@router.patch("/workshops/{row_id}", response_model=WorkshopOut, summary="更新车间")
async def update_workshop(
    row_id: int,
    body: WorkshopUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.name is not None:
        row.name = body.name.strip()
    await row.save()
    return WorkshopOut.model_validate(row)


@router.delete("/workshops/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除车间")
async def delete_workshop(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()


# --- manufacturers ---


@router.get("/manufacturers", response_model=List[ManufacturerOut], summary="制造商列表")
async def list_manufacturers(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoManufacturer, tenant_id).order_by("code")
    return [ManufacturerOut.model_validate(r) for r in rows]


@router.post("/manufacturers", response_model=ManufacturerOut, summary="创建制造商")
async def create_manufacturer(
    body: ManufacturerCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoManufacturer.create(tenant_id=tenant_id, code=body.code.strip(), name=body.name.strip())
    return ManufacturerOut.model_validate(row)


@router.patch("/manufacturers/{row_id}", response_model=ManufacturerOut, summary="更新制造商")
async def update_manufacturer(
    row_id: int,
    body: ManufacturerUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoManufacturer, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.name is not None:
        row.name = body.name.strip()
    await row.save()
    return ManufacturerOut.model_validate(row)


@router.delete("/manufacturers/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除制造商")
async def delete_manufacturer(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoManufacturer, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()


# --- inspection params ---


@router.get("/inspection-params", response_model=List[InspectionParamOut], summary="点检参数列表")
async def list_inspection_params(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoInspectionParam, tenant_id).order_by("code")
    return [InspectionParamOut.model_validate(r) for r in rows]


@router.post("/inspection-params", response_model=InspectionParamOut, summary="创建点检参数")
async def create_inspection_param(
    body: InspectionParamCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoInspectionParam.create(
        tenant_id=tenant_id,
        code=body.code.strip(),
        name=body.name.strip(),
        unit=body.unit,
        value_type=body.value_type,
    )
    return InspectionParamOut.model_validate(row)


# --- inspection param sets ---


@router.get("/inspection-param-sets", response_model=List[InspectionParamSetOut], summary="点检参数集列表")
async def list_inspection_param_sets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoInspectionParamSet, tenant_id).order_by("code")
    return [InspectionParamSetOut.model_validate(r) for r in rows]


@router.post("/inspection-param-sets", response_model=InspectionParamSetOut, summary="创建点检参数集")
async def create_inspection_param_set(
    body: InspectionParamSetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoInspectionParamSet.create(
        tenant_id=tenant_id, code=body.code.strip(), name=body.name.strip()
    )
    return InspectionParamSetOut.model_validate(row)


@router.get(
    "/inspection-param-sets/{set_id}/items",
    response_model=List[SetItemOut],
    summary="参数集明细",
)
async def list_set_items(
    set_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        await _not_found()
    rows = (
        await tenant_alive(HaoligoInspectionParamSetItem, tenant_id)
        .filter(set_id=set_id)
        .order_by("sort_order", "id")
    )
    return [
        SetItemOut(
            id=r.id,
            param_id=r.param_id,
            set_id=r.set_id,
            sort_order=r.sort_order,
            is_required=r.is_required,
        )
        for r in rows
    ]


@router.post(
    "/inspection-param-sets/{set_id}/items",
    response_model=SetItemOut,
    summary="参数集添加明细",
)
async def add_set_item(
    set_id: int,
    body: SetItemCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        await _not_found()
    param = await tenant_alive(HaoligoInspectionParam, tenant_id).filter(id=body.param_id).first()
    if not param:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="点检参数不存在")
    row = await HaoligoInspectionParamSetItem.create(
        tenant_id=tenant_id,
        set_id=set_id,
        param_id=body.param_id,
        sort_order=body.sort_order,
        is_required=body.is_required,
    )
    return SetItemOut(
        id=row.id, param_id=row.param_id, set_id=row.set_id, sort_order=row.sort_order, is_required=row.is_required
    )


@router.delete(
    "/inspection-param-set-items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除参数集明细（软删除）",
)
async def delete_set_item(
    item_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoInspectionParamSetItem, tenant_id).filter(id=item_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()


# --- categories ---


@router.get("/categories", response_model=List[CategoryOut], summary="设备类别列表")
async def list_categories(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoEquipmentCategory, tenant_id).order_by("code")
    return [CategoryOut.model_validate(r) for r in rows]


@router.post("/categories", response_model=CategoryOut, summary="创建设备类别")
async def create_category(
    body: CategoryCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    if body.default_inspection_param_set_id is not None:
        ps = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(
            id=body.default_inspection_param_set_id
        ).first()
        if not ps:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="默认点检参数集不存在")
    row = await HaoligoEquipmentCategory.create(
        tenant_id=tenant_id,
        code=body.code.strip(),
        name=body.name.strip(),
        default_inspection_param_set_id=body.default_inspection_param_set_id,
    )
    return CategoryOut.model_validate(row)


@router.patch("/categories/{row_id}", response_model=CategoryOut, summary="更新设备类别")
async def update_category(
    row_id: int,
    body: CategoryUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentCategory, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.name is not None:
        row.name = body.name.strip()
    if body.default_inspection_param_set_id is not None:
        ps = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(
            id=body.default_inspection_param_set_id
        ).first()
        if not ps:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="默认点检参数集不存在")
        row.default_inspection_param_set_id = body.default_inspection_param_set_id
    await row.save()
    return CategoryOut.model_validate(row)


@router.delete("/categories/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备类别")
async def delete_category(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentCategory, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()


# --- equipment ledger ---


@router.get("/equipments", summary="设备台账分页")
async def list_equipments(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    workshop_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    qs = tenant_alive(HaoligoEquipment, tenant_id)
    if workshop_id is not None:
        qs = qs.filter(workshop_id=workshop_id)
    total = await qs.count()
    rows = await qs.order_by("asset_code").offset(skip).limit(limit)
    return {
        "items": [EquipmentOut.model_validate(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/equipments", response_model=EquipmentOut, summary="创建设备")
async def create_equipment(
    body: EquipmentCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    for mid, model in [
        (body.category_id, HaoligoEquipmentCategory),
        (body.workshop_id, HaoligoWorkshop),
    ]:
        if not await tenant_alive(model, tenant_id).filter(id=mid).exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联主数据不存在")
    if body.manufacturer_id is not None and not await tenant_alive(HaoligoManufacturer, tenant_id).filter(
        id=body.manufacturer_id
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="制造商不存在")
    if body.inspection_param_set_id is not None and not await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(
        id=body.inspection_param_set_id
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="点检参数集不存在")
    row = await HaoligoEquipment.create(
        tenant_id=tenant_id,
        asset_code=body.asset_code.strip(),
        name=body.name.strip(),
        category_id=body.category_id,
        workshop_id=body.workshop_id,
        manufacturer_id=body.manufacturer_id,
        manufacture_date=body.manufacture_date,
        inspection_param_set_id=body.inspection_param_set_id,
        remark=body.remark,
    )
    return EquipmentOut.model_validate(row)


@router.get("/equipments/{row_id}", response_model=EquipmentOut, summary="设备详情")
async def get_equipment(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return EquipmentOut.model_validate(row)


@router.patch("/equipments/{row_id}", response_model=EquipmentOut, summary="更新设备")
async def update_equipment(
    row_id: int,
    body: EquipmentUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] is not None:
        if not await tenant_alive(HaoligoEquipmentCategory, tenant_id).filter(id=data["category_id"]).exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备类别不存在")
    if "workshop_id" in data and data["workshop_id"] is not None:
        if not await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=data["workshop_id"]).exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
    if data.get("manufacturer_id") is not None and not await tenant_alive(HaoligoManufacturer, tenant_id).filter(
        id=data["manufacturer_id"]
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="制造商不存在")
    if data.get("inspection_param_set_id") is not None and not await tenant_alive(
        HaoligoInspectionParamSet, tenant_id
    ).filter(id=data["inspection_param_set_id"]).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="点检参数集不存在")
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return EquipmentOut.model_validate(row)


@router.delete("/equipments/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备")
async def delete_equipment(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()


# --- patrol routes ---


@router.get("/patrol-routes", response_model=List[PatrolRouteOut], summary="巡检路线列表")
async def list_patrol_routes(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoPatrolRoute, tenant_id).order_by("code")
    return [PatrolRouteOut.model_validate(r) for r in rows]


@router.post("/patrol-routes", response_model=PatrolRouteOut, summary="创建巡检路线")
async def create_patrol_route(
    body: PatrolRouteCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    if body.workshop_id is not None and not await tenant_alive(HaoligoWorkshop, tenant_id).filter(
        id=body.workshop_id
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
    row = await HaoligoPatrolRoute.create(
        tenant_id=tenant_id,
        code=body.code.strip(),
        name=body.name.strip(),
        workshop_id=body.workshop_id,
    )
    return PatrolRouteOut.model_validate(row)


@router.patch("/patrol-routes/{row_id}", response_model=PatrolRouteOut, summary="更新巡检路线")
async def update_patrol_route(
    row_id: int,
    body: PatrolRouteUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoPatrolRoute, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.name is not None:
        row.name = body.name.strip()
    if body.workshop_id is not None:
        if not await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=body.workshop_id).exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
        row.workshop_id = body.workshop_id
    await row.save()
    return PatrolRouteOut.model_validate(row)


@router.get(
    "/patrol-routes/{route_id}/steps",
    response_model=List[PatrolStepOut],
    summary="路线步骤列表",
)
async def list_patrol_steps(
    route_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoPatrolRoute, tenant_id).filter(id=route_id).first()
    if not parent:
        await _not_found()
    rows = await tenant_alive(HaoligoPatrolRouteStep, tenant_id).filter(route_id=route_id).order_by("sequence", "id")
    return [PatrolStepOut.model_validate(r) for r in rows]


@router.put(
    "/patrol-routes/{route_id}/steps",
    response_model=List[PatrolStepOut],
    summary="覆盖保存路线步骤",
)
async def replace_patrol_steps(
    route_id: int,
    steps: List[PatrolStepIn],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoPatrolRoute, tenant_id).filter(id=route_id).first()
    if not parent:
        await _not_found()
    eq_ids = {s.equipment_id for s in steps}
    for eid in eq_ids:
        if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=eid).exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"设备 id={eid} 不存在")

    async with in_transaction() as conn:
        await HaoligoPatrolRouteStep.filter(route_id=route_id, tenant_id=tenant_id).using_db(conn).delete()
        for s in sorted(steps, key=lambda x: x.sequence):
            await HaoligoPatrolRouteStep.create(
                tenant_id=tenant_id,
                route_id=route_id,
                equipment_id=s.equipment_id,
                sequence=s.sequence,
                using_db=conn,
            )
    rows = await tenant_alive(HaoligoPatrolRouteStep, tenant_id).filter(route_id=route_id).order_by("sequence", "id")
    return [PatrolStepOut.model_validate(r) for r in rows]
