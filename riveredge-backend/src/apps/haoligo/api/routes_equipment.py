"""好力 GO — 设备主数据与巡检路线 API。"""

from __future__ import annotations

from collections import OrderedDict
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api.routes_equipment_documents import _normalize_measured_value
from apps.haoligo.services.equipment_inspection_param_sets import (
    list_equipment_inspection_param_set_ids,
    sync_equipment_inspection_param_sets,
)
from apps.haoligo.services.equipment_operational_status import normalize_operational_status
from apps.haoligo.services.inspection_numeric_range import normalize_numeric_range_bounds
from apps.haoligo.services.workshop_sync import list_workshops_synced_from_master
from apps.haoligo.models.equipment import (
    HaoligoEquipment,
    HaoligoEquipmentCategory,
    HaoligoEquipmentInspectionParamSet,
    HaoligoInspectionParam,
    HaoligoInspectionParamSet,
    HaoligoInspectionParamSetItem,
    HaoligoManufacturer,
    HaoligoPatrolRoute,
    HaoligoPatrolRouteStep,
    HaoligoWorkshop,
)
from apps.haoligo.models.equipment_status_log import HaoligoEquipmentOperationalStatusLog
from apps.haoligo.models.equipment_upkeep_param import HaoligoEquipmentUpkeepParamSet
from apps.haoligo.services.equipment_operational_status_since import operational_status_since_by_equipment
from apps.haoligo.api._haoligo_route_access import (
    require_haoligo_module_access,
    require_haoligo_shared_workshops_read,
)
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/equipment",
    tags=["App - HaoliGO - 设备"],
)

_workshops_router = APIRouter()
_manufacturers_router = APIRouter(
    dependencies=[Depends(require_haoligo_module_access("equipment-manufacturers"))],
)
_inspection_params_router = APIRouter(
    dependencies=[Depends(require_haoligo_module_access("equipment-inspection-params"))],
)
_inspection_param_sets_router = APIRouter(
    dependencies=[Depends(require_haoligo_module_access("equipment-inspection-param-sets"))],
)
_categories_router = APIRouter(
    dependencies=[Depends(require_haoligo_module_access("equipment-categories"))],
)
_equipment_ledger_router = APIRouter(
    dependencies=[Depends(require_haoligo_module_access("equipment-ledger"))],
)
_patrol_routes_router = APIRouter(
    dependencies=[Depends(require_haoligo_module_access("equipment-patrol-routes"))],
)


def _normalize_equipment_criticality(v: Optional[str]) -> Optional[str]:
    if v is None or not str(v).strip():
        return None
    s = str(v).strip().upper()
    if s not in ("A", "B", "C"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="设备重要等级必须为 A、B、C 之一或留空",
        )
    return s


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
    level1_category: Optional[str] = None
    requirement: Optional[str] = None
    unit: Optional[str] = None
    value_type: str = "numeric"
    default_value: Optional[str] = None
    numeric_min: Optional[Decimal] = Field(None, description="数值型取值下限（含）")
    numeric_max: Optional[Decimal] = Field(None, description="数值型取值上限（含）")


class InspectionParamCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    level1_category: Optional[str] = Field(None, description="设备类别一级分类名称")
    requirement: Optional[str] = Field(None, description="点检要求")
    unit: Optional[str] = Field(None, max_length=32)
    value_type: str = Field(default="numeric", max_length=32)
    default_value: Optional[str] = Field(None, description="默认值；空表示不预填")
    numeric_min: Optional[Decimal] = Field(None, description="数值型取值下限（含）")
    numeric_max: Optional[Decimal] = Field(None, description="数值型取值上限（含）")


class InspectionParamUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    level1_category: Optional[str] = Field(None, description="设备类别一级分类；传 null 或空字符串清除")
    requirement: Optional[str] = Field(None, description="点检要求；传空字符串表示清除")
    unit: Optional[str] = Field(None, max_length=32)
    value_type: Optional[str] = Field(None, max_length=32)
    default_value: Optional[str] = Field(None, description="默认值；传空字符串表示清除")
    numeric_min: Optional[Decimal] = Field(None, description="数值型取值下限（含）；传 null 清除")
    numeric_max: Optional[Decimal] = Field(None, description="数值型取值上限（含）；传 null 清除")


class InspectionParamBatchLevel1Body(BaseModel):
    ids: List[int] = Field(min_length=1, description="点检项 id 列表")
    level1_category: Optional[str] = Field(None, description="一级分类；null 或空字符串表示清除为未分类")


class InspectionParamBatchLevel1Out(BaseModel):
    updated: int


def _normalize_inspection_param_default(value_type: str, raw: Optional[str]) -> Optional[str]:
    """规范化点检项默认值；空输入存 NULL。"""
    if raw is None:
        return None
    return _normalize_measured_value(value_type or "numeric", raw)


def _normalize_inspection_value_type(raw: Optional[str]) -> str:
    v = (raw or "numeric").strip().lower()
    if v in ("text", "文本"):
        return "text"
    if v in ("boolean", "bool", "是否"):
        return "boolean"
    if v in ("multiselect", "multi_select", "multi", "多选"):
        return "multiselect"
    if v in ("numeric", "number", "数值"):
        return "numeric"
    return "numeric"


async def _equipment_level1_category_names(tenant_id: int) -> set[str]:
    rows = await tenant_alive(HaoligoEquipmentCategory, tenant_id).all()
    return {(r.level1_category or "").strip() for r in rows if (r.level1_category or "").strip()}


async def _resolve_inspection_param_level1_category(
    tenant_id: int, raw: Optional[str]
) -> Optional[str]:
    if raw is None:
        return None
    v = str(raw).strip()
    if not v:
        return None
    allowed = await _equipment_level1_category_names(tenant_id)
    if v not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"一级分类「{v}」不存在，请先在设备类别中维护该一级分类",
        )
    return v


def _auto_inspection_param_code(set_code: str, seq: int) -> str:
    code = f"{set_code}-{seq:03d}"
    if len(code) > 64:
        raise ValueError(f"自动生成的点检编号过长（{code}），请缩短方案编码或手动填写点检编号")
    return code


async def _upsert_inspection_param_for_import(
    tenant_id: int,
    *,
    code: str,
    name: str,
    level1_category: Optional[str],
    requirement: Optional[str],
    unit: Optional[str],
    value_type: str,
    default_value: Optional[str],
    numeric_min: Optional[Decimal],
    numeric_max: Optional[Decimal],
) -> tuple[HaoligoInspectionParam, bool]:
    vt = _normalize_inspection_value_type(value_type)
    try:
        norm_default = _normalize_inspection_param_default(vt, default_value)
        lo, hi = normalize_numeric_range_bounds(vt, numeric_min, numeric_max)
    except ValueError as e:
        raise ValueError(str(e)) from e

    row = await tenant_alive(HaoligoInspectionParam, tenant_id).filter(code=code).first()
    if row:
        row.name = name.strip()
        row.level1_category = level1_category
        row.requirement = (requirement or "").strip() or None
        row.unit = None if unit is None else (str(unit).strip() or None)
        row.value_type = vt
        row.numeric_min, row.numeric_max = lo, hi
        row.default_value = norm_default
        await row.save()
        return row, False

    row = await HaoligoInspectionParam.create(
        tenant_id=tenant_id,
        code=code,
        name=name.strip(),
        level1_category=level1_category,
        requirement=(requirement or "").strip() or None,
        unit=None if unit is None else (str(unit).strip() or None),
        value_type=vt,
        default_value=norm_default,
        numeric_min=lo,
        numeric_max=hi,
    )
    return row, True


class InspectionParamSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str


class InspectionParamSetCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)


class InspectionParamSetCreateWithItems(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    items: List[SetItemCreate] = Field(default_factory=list)


class InspectionParamSetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)


class InspectionParamSetImportRow(BaseModel):
    set_code: str = Field(max_length=64, description="方案编码")
    set_name: str = Field(max_length=200, description="方案名称")
    param_code: Optional[str] = Field(None, max_length=64, description="点检编号；空则按 方案编码-001 自动生成")
    param_name: str = Field(max_length=200, description="点检项名称")
    level1_category: Optional[str] = Field(None, max_length=200, description="设备类别一级分类名称")
    requirement: Optional[str] = Field(None, description="点检要求")
    value_type: str = Field(default="numeric", max_length=32)
    default_value: Optional[str] = None
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None
    unit: Optional[str] = Field(None, max_length=32)
    is_required: bool = True


class InspectionParamSetImportBody(BaseModel):
    rows: List[InspectionParamSetImportRow] = Field(min_length=1)


class InspectionParamSetImportResult(BaseModel):
    plans_created: int
    plans_updated: int
    params_created: int
    params_updated: int
    plan_codes: List[str]


class SetItemCreate(BaseModel):
    param_id: int
    sort_order: int = 0
    is_required: bool = True


class SetItemUpdate(BaseModel):
    sort_order: Optional[int] = None
    is_required: Optional[bool] = None


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
    level1_category: str
    level2_category: str
    name: str
    default_inspection_param_set_id: Optional[int] = None


class CategoryCreate(BaseModel):
    code: str = Field(max_length=64)
    level1_category: Optional[str] = Field(default="", max_length=200)
    level2_category: str = Field(max_length=200)
    default_inspection_param_set_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    level1_category: Optional[str] = Field(None, max_length=200)
    level2_category: Optional[str] = Field(None, max_length=200)
    default_inspection_param_set_id: Optional[int] = None


def _category_display_name(level1: str, level2: str) -> str:
    l1 = (level1 or "").strip()
    l2 = (level2 or "").strip()
    if l1 and l2 and l1 != l2:
        return f"{l1} / {l2}"
    return l2 or l1


def _norm_uuid_list(v: Optional[List[str]]) -> List[str]:
    if not v:
        return []
    out: List[str] = []
    for x in v:
        s = (x or "").strip()
        if s:
            out.append(s)
    return out


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
    inspection_param_set_ids: List[int] = Field(default_factory=list, description="绑定的点检方案 id 列表")
    upkeep_param_set_id: Optional[int] = None
    criticality: Optional[str] = None
    operational_status: Optional[str] = None
    operational_status_since: Optional[datetime] = Field(
        None,
        description="进入当前运行状态的时间（状态调整单 recorded_at 或变更日志 created_at）",
    )
    remark: Optional[str] = None
    image_file_uuids: List[str] = Field(default_factory=list)
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)
    used_yield: Decimal = Decimal("0")


async def _equipment_out(tenant_id: int, row: HaoligoEquipment) -> EquipmentOut:
    ids = await list_equipment_inspection_param_set_ids(tenant_id, row.id)
    out = EquipmentOut.model_validate(row)
    return out.model_copy(update={"inspection_param_set_ids": ids})


class EquipmentCreate(BaseModel):
    asset_code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    category_id: int
    workshop_id: int
    manufacturer_id: Optional[int] = None
    manufacture_date: Optional[date] = None
    inspection_param_set_ids: List[int] = Field(default_factory=list, description="绑定的点检方案")
    upkeep_param_set_id: Optional[int] = None
    criticality: Optional[str] = Field(None, max_length=8, description="A/B/C")
    operational_status: Optional[str] = Field(
        None,
        max_length=16,
        description="running/repair/shutdown/standby",
    )
    remark: Optional[str] = None
    image_file_uuids: Optional[List[str]] = Field(default_factory=list, description="设备图片文件 uuid")
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)


class EquipmentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    category_id: Optional[int] = None
    workshop_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    manufacture_date: Optional[date] = None
    inspection_param_set_ids: Optional[List[int]] = Field(None, description="绑定的点检方案；传 [] 清空")
    upkeep_param_set_id: Optional[int] = None
    criticality: Optional[str] = Field(None, max_length=8)
    operational_status: Optional[str] = Field(
        None,
        max_length=16,
        description="running/repair/shutdown/standby；传 null 清空",
    )
    remark: Optional[str] = None
    image_file_uuids: Optional[List[str]] = None
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)


async def _validate_equipment_upkeep_param_set_id(tenant_id: int, upkeep_param_set_id: int | None) -> None:
    if upkeep_param_set_id is None:
        return
    exists = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=upkeep_param_set_id).exists()
    if not exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="保养方案不存在")


class EquipmentOperationalStatusLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    old_status: Optional[str] = None
    new_status: str
    changed_by_user_id: int


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


class PatrolRouteCreateWithSteps(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    workshop_id: Optional[int] = None
    steps: List[PatrolStepIn] = Field(default_factory=list)


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


@_workshops_router.get("/workshops", response_model=List[WorkshopOut], summary="车间列表（主数据启用车间，同步至好力侧）", dependencies=[Depends(require_haoligo_shared_workshops_read())])
async def list_workshops(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await list_workshops_synced_from_master(tenant_id)
    return [WorkshopOut.model_validate(r) for r in rows]


@_workshops_router.post("/workshops", response_model=WorkshopOut, summary="创建车间（已停用）", dependencies=[Depends(require_haoligo_module_access("master-data-factory-workshops"))])
async def create_workshop(
    body: WorkshopCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="车间请在「主数据 → 厂区数据 → 车间」中维护；保存后好力设备模块会自动同步可用车间。",
    )


@_workshops_router.patch("/workshops/{row_id}", response_model=WorkshopOut, summary="更新车间（已停用）", dependencies=[Depends(require_haoligo_module_access("master-data-factory-workshops"))])
async def update_workshop(
    row_id: int,
    body: WorkshopUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="车间名称请在「主数据 → 厂区数据 → 车间」中修改；列表接口会随主数据自动同步。",
    )


@_workshops_router.delete("/workshops/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除车间（已停用）", dependencies=[Depends(require_haoligo_module_access("master-data-factory-workshops"))])
async def delete_workshop(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="车间停用或删除请在「主数据 → 厂区数据 → 车间」中操作。",
    )


# --- manufacturers ---


@_manufacturers_router.get("/manufacturers", response_model=List[ManufacturerOut], summary="制造商列表")
async def list_manufacturers(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoManufacturer, tenant_id).order_by("code")
    return [ManufacturerOut.model_validate(r) for r in rows]


@_manufacturers_router.post("/manufacturers", response_model=ManufacturerOut, summary="创建制造商")
async def create_manufacturer(
    body: ManufacturerCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoManufacturer.create(tenant_id=tenant_id, code=body.code.strip(), name=body.name.strip())
    return ManufacturerOut.model_validate(row)


@_manufacturers_router.patch("/manufacturers/{row_id}", response_model=ManufacturerOut, summary="更新制造商")
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


@_manufacturers_router.delete("/manufacturers/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除制造商")
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


@_inspection_params_router.get("/inspection-params", response_model=List[InspectionParamOut], summary="点检参数列表")
async def list_inspection_params(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoInspectionParam, tenant_id).order_by("code")
    return [InspectionParamOut.model_validate(r) for r in rows]


@_inspection_params_router.post("/inspection-params", response_model=InspectionParamOut, summary="创建点检参数")
async def create_inspection_param(
    body: InspectionParamCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    vt = (body.value_type or "numeric").strip()
    try:
        default_value = _normalize_inspection_param_default(vt, body.default_value)
        numeric_min, numeric_max = normalize_numeric_range_bounds(vt, body.numeric_min, body.numeric_max)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    code = body.code.strip()
    if not code:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="点检编号不能为空")
    if await tenant_alive(HaoligoInspectionParam, tenant_id).filter(code=code).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="点检编号已存在")
    level1_category = await _resolve_inspection_param_level1_category(tenant_id, body.level1_category)
    try:
        row = await HaoligoInspectionParam.create(
            tenant_id=tenant_id,
            code=code,
            name=body.name.strip(),
            level1_category=level1_category,
            requirement=(body.requirement or "").strip() or None,
            unit=body.unit,
            value_type=vt,
            default_value=default_value,
            numeric_min=numeric_min,
            numeric_max=numeric_max,
        )
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="点检编号已存在") from exc
    return InspectionParamOut.model_validate(row)


@_inspection_params_router.patch("/inspection-params/{row_id}", response_model=InspectionParamOut, summary="更新点检参数")
async def update_inspection_param(
    row_id: int,
    body: InspectionParamUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoInspectionParam, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    patch = body.model_dump(exclude_unset=True)
    if "name" in patch:
        row.name = str(patch["name"] or "").strip()
    if "level1_category" in patch:
        row.level1_category = await _resolve_inspection_param_level1_category(
            tenant_id, patch["level1_category"]
        )
    if "requirement" in patch:
        req = patch["requirement"]
        row.requirement = None if req is None else (str(req).strip() or None)
    if "unit" in patch:
        u = patch["unit"]
        row.unit = None if u is None else (str(u).strip() or None)
    if "value_type" in patch and patch["value_type"] is not None:
        row.value_type = str(patch["value_type"]).strip()
    vt_for_range = row.value_type or "numeric"
    if "numeric_min" in patch or "numeric_max" in patch or "value_type" in patch:
        try:
            lo = patch["numeric_min"] if "numeric_min" in patch else row.numeric_min
            hi = patch["numeric_max"] if "numeric_max" in patch else row.numeric_max
            row.numeric_min, row.numeric_max = normalize_numeric_range_bounds(vt_for_range, lo, hi)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    if "default_value" in patch:
        vt = row.value_type or "numeric"
        try:
            row.default_value = _normalize_inspection_param_default(vt, patch["default_value"])
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    elif "value_type" in patch and row.default_value:
        try:
            row.default_value = _normalize_inspection_param_default(
                row.value_type or "numeric", row.default_value
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    await row.save()
    return InspectionParamOut.model_validate(row)


@_inspection_params_router.delete("/inspection-params/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除点检参数")
async def delete_inspection_param(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoInspectionParam, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    used = await tenant_alive(HaoligoInspectionParamSetItem, tenant_id).filter(param_id=row_id).exists()
    if used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该点检项已被点检方案引用，请先从方案中移除后再删除",
        )
    row.deleted_at = timezone.now()
    await row.save()


@_inspection_params_router.post(
    "/inspection-params/batch-level1-category",
    response_model=InspectionParamBatchLevel1Out,
    summary="批量修改点检项一级分类",
)
async def batch_update_inspection_param_level1(
    body: InspectionParamBatchLevel1Body,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    unique_ids = list(dict.fromkeys(body.ids))
    level1_category = await _resolve_inspection_param_level1_category(tenant_id, body.level1_category)
    qs = tenant_alive(HaoligoInspectionParam, tenant_id).filter(id__in=unique_ids)
    found = await qs.count()
    if found != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="部分点检项不存在或已删除",
        )
    updated = await qs.update(level1_category=level1_category)
    return InspectionParamBatchLevel1Out(updated=updated)


# --- inspection param sets ---


@_inspection_param_sets_router.get("/inspection-param-sets", response_model=List[InspectionParamSetOut], summary="点检参数集列表")
async def list_inspection_param_sets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoInspectionParamSet, tenant_id).order_by("code")
    return [InspectionParamSetOut.model_validate(r) for r in rows]


@_inspection_param_sets_router.post("/inspection-param-sets", response_model=InspectionParamSetOut, summary="创建点检参数集")
async def create_inspection_param_set(
    body: InspectionParamSetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoInspectionParamSet.create(
        tenant_id=tenant_id, code=body.code.strip(), name=body.name.strip()
    )
    return InspectionParamSetOut.model_validate(row)


@_inspection_param_sets_router.post(
    "/inspection-param-sets/with-items",
    response_model=InspectionParamSetOut,
    summary="创建点检参数集及明细（事务）",
)
async def create_inspection_param_set_with_items(
    body: InspectionParamSetCreateWithItems,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    """先建方案头再建明细；任一步失败则整单回滚，避免空头方案。"""
    seen: set[int] = set()
    deduped: list[SetItemCreate] = []
    for it in body.items:
        if it.param_id in seen:
            continue
        seen.add(it.param_id)
        deduped.append(it)
    async with in_transaction():
        parent = await HaoligoInspectionParamSet.create(
            tenant_id=tenant_id, code=body.code.strip(), name=body.name.strip()
        )
        for idx, it in enumerate(deduped):
            param = await tenant_alive(HaoligoInspectionParam, tenant_id).filter(id=it.param_id).first()
            if not param:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"点检参数不存在: {it.param_id}",
                )
            sort_order = it.sort_order
            try:
                await HaoligoInspectionParamSetItem.create(
                    tenant_id=tenant_id,
                    set_id=parent.id,
                    param_id=it.param_id,
                    sort_order=sort_order,
                    is_required=it.is_required,
                )
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="点检方案明细重复或非法",
                ) from exc
    row = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id=parent.id).first()
    if not row:
        await _not_found()
    return InspectionParamSetOut.model_validate(row)


@_inspection_param_sets_router.post(
    "/inspection-param-sets/import",
    response_model=InspectionParamSetImportResult,
    summary="导入点检方案（自动创建缺失点检项）",
)
async def import_inspection_param_sets(
    body: InspectionParamSetImportBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    """按方案编码分组导入；点检编号留空时自动生成「方案编码-001」格式；已存在方案则覆盖明细。"""
    groups: OrderedDict[str, list[InspectionParamSetImportRow]] = OrderedDict()
    for row in body.rows:
        set_code = row.set_code.strip()
        if not set_code:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="方案编码不能为空")
        param_name = row.param_name.strip()
        if not param_name:
            continue
        if set_code not in groups:
            groups[set_code] = []
        groups[set_code].append(row)

    if not groups:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="没有可导入的点检项行")

    plans_created = 0
    plans_updated = 0
    params_created = 0
    params_updated = 0
    plan_codes: list[str] = []

    async with in_transaction():
        for set_code, plan_rows in groups.items():
            set_name = next((r.set_name.strip() for r in plan_rows if r.set_name.strip()), "")
            if not set_name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"方案「{set_code}」缺少方案名称",
                )

            parent = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(code=set_code).first()
            if parent:
                parent.name = set_name
                await parent.save()
                await tenant_alive(HaoligoInspectionParamSetItem, tenant_id).filter(
                    set_id=parent.id, deleted_at__isnull=True
                ).update(deleted_at=timezone.now())
                plans_updated += 1
            else:
                parent = await HaoligoInspectionParamSet.create(
                    tenant_id=tenant_id, code=set_code, name=set_name
                )
                plans_created += 1

            plan_codes.append(set_code)
            seen_param_ids: set[int] = set()

            for idx, line in enumerate(plan_rows):
                raw_code = (line.param_code or "").strip()
                param_code = raw_code or _auto_inspection_param_code(set_code, idx + 1)
                if len(param_code) > 64:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"点检编号过长：{param_code}",
                    )

                level1_category: Optional[str] = None
                raw_level1 = (line.level1_category or "").strip()
                if raw_level1:
                    try:
                        level1_category = await _resolve_inspection_param_level1_category(
                            tenant_id, raw_level1
                        )
                    except HTTPException as exc:
                        raise HTTPException(
                            status_code=exc.status_code,
                            detail=f"方案「{set_code}」点检项「{line.param_name.strip()}」：{exc.detail}",
                        ) from exc

                try:
                    param, created = await _upsert_inspection_param_for_import(
                        tenant_id,
                        code=param_code,
                        name=line.param_name.strip(),
                        level1_category=level1_category,
                        requirement=line.requirement,
                        unit=line.unit,
                        value_type=line.value_type,
                        default_value=line.default_value,
                        numeric_min=line.numeric_min,
                        numeric_max=line.numeric_max,
                    )
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"方案「{set_code}」点检项「{line.param_name.strip()}」：{e}",
                    ) from e

                if created:
                    params_created += 1
                else:
                    params_updated += 1

                if param.id in seen_param_ids:
                    continue
                seen_param_ids.add(param.id)

                try:
                    await HaoligoInspectionParamSetItem.create(
                        tenant_id=tenant_id,
                        set_id=parent.id,
                        param_id=param.id,
                        sort_order=idx,
                        is_required=line.is_required,
                    )
                except IntegrityError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"方案「{set_code}」明细重复：{param_code}",
                    ) from exc

    return InspectionParamSetImportResult(
        plans_created=plans_created,
        plans_updated=plans_updated,
        params_created=params_created,
        params_updated=params_updated,
        plan_codes=plan_codes,
    )


@_inspection_param_sets_router.patch("/inspection-param-sets/{row_id}", response_model=InspectionParamSetOut, summary="更新点检参数集")
async def update_inspection_param_set(
    row_id: int,
    body: InspectionParamSetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.name is not None:
        row.name = body.name.strip()
    await row.save()
    return InspectionParamSetOut.model_validate(row)


@_inspection_param_sets_router.delete("/inspection-param-sets/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除点检参数集")
async def delete_inspection_param_set(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if await tenant_alive(HaoligoEquipment, tenant_id).filter(inspection_param_set_id=row_id).exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该点检方案已被设备台账引用，无法删除",
        )
    if await tenant_alive(HaoligoEquipmentInspectionParamSet, tenant_id).filter(set_id=row_id).exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该点检方案已被设备绑定，无法删除",
        )
    if await tenant_alive(HaoligoEquipmentCategory, tenant_id).filter(default_inspection_param_set_id=row_id).exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该点检方案已被设备类别作为默认方案引用，无法删除",
        )
    await tenant_alive(HaoligoInspectionParamSetItem, tenant_id).filter(set_id=row_id, deleted_at__isnull=True).update(
        deleted_at=timezone.now()
    )
    row.deleted_at = timezone.now()
    await row.save()


@_inspection_param_sets_router.get(
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


@_inspection_param_sets_router.post(
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
    try:
        row = await HaoligoInspectionParamSetItem.create(
            tenant_id=tenant_id,
            set_id=set_id,
            param_id=body.param_id,
            sort_order=body.sort_order,
            is_required=body.is_required,
        )
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该点检项已在本方案中存在，请勿重复添加",
        ) from None
    return SetItemOut(
        id=row.id, param_id=row.param_id, set_id=row.set_id, sort_order=row.sort_order, is_required=row.is_required
    )


@_inspection_param_sets_router.patch(
    "/inspection-param-set-items/{item_id}",
    response_model=SetItemOut,
    summary="更新参数集明细（排序、是否必检）",
)
async def update_set_item(
    item_id: int,
    body: SetItemUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoInspectionParamSetItem, tenant_id).filter(id=item_id).first()
    if not row:
        await _not_found()
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.is_required is not None:
        row.is_required = body.is_required
    await row.save()
    return SetItemOut(
        id=row.id, param_id=row.param_id, set_id=row.set_id, sort_order=row.sort_order, is_required=row.is_required
    )


@_inspection_param_sets_router.delete(
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


@_categories_router.get("/categories", response_model=List[CategoryOut], summary="设备类别列表")
async def list_categories(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoEquipmentCategory, tenant_id).order_by(
        "level1_category", "level2_category", "code"
    )
    return [CategoryOut.model_validate(r) for r in rows]


@_categories_router.post("/categories", response_model=CategoryOut, summary="创建设备类别")
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
        level1_category=(body.level1_category or "").strip(),
        level2_category=body.level2_category.strip(),
        name=_category_display_name(body.level1_category or "", body.level2_category),
        default_inspection_param_set_id=body.default_inspection_param_set_id,
    )
    return CategoryOut.model_validate(row)


@_categories_router.patch("/categories/{row_id}", response_model=CategoryOut, summary="更新设备类别")
async def update_category(
    row_id: int,
    body: CategoryUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentCategory, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.level1_category is not None:
        row.level1_category = body.level1_category.strip()
    if body.level2_category is not None:
        row.level2_category = body.level2_category.strip()
    if body.level1_category is not None or body.level2_category is not None:
        row.name = _category_display_name(row.level1_category, row.level2_category)
    if body.default_inspection_param_set_id is not None:
        ps = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(
            id=body.default_inspection_param_set_id
        ).first()
        if not ps:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="默认点检参数集不存在")
        row.default_inspection_param_set_id = body.default_inspection_param_set_id
    await row.save()
    return CategoryOut.model_validate(row)


@_categories_router.delete("/categories/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备类别")
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


@_equipment_ledger_router.get("/equipments", summary="设备台账分页")
async def list_equipments(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    workshop_id: Optional[int] = Query(None),
    level1_category: Optional[str] = Query(
        None,
        description="一级分类筛选；传 __none__ 表示仅未设置一级分类的设备",
    ),
    keyword: Optional[str] = Query(None, description="模糊匹配代号或名称"),
    asset_code: Optional[str] = Query(None, description="设备代号模糊匹配"),
    name: Optional[str] = Query(None, description="设备名称模糊匹配"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    qs = tenant_alive(HaoligoEquipment, tenant_id)
    if workshop_id is not None:
        qs = qs.filter(workshop_id=workshop_id)
    if level1_category is not None:
        lc = level1_category.strip()
        if lc == "__none__":
            cat_ids = await tenant_alive(HaoligoEquipmentCategory, tenant_id).filter(
                Q(level1_category="") | Q(level1_category__isnull=True)
            ).values_list("id", flat=True)
        elif lc:
            cat_ids = await tenant_alive(HaoligoEquipmentCategory, tenant_id).filter(
                level1_category=lc
            ).values_list("id", flat=True)
        else:
            cat_ids = []
        qs = qs.filter(category_id__in=list(cat_ids))
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(Q(asset_code__icontains=k) | Q(name__icontains=k))
    else:
        if asset_code:
            qs = qs.filter(asset_code__icontains=asset_code.strip())
        if name:
            qs = qs.filter(name__icontains=name.strip())
    total = await qs.count()
    rows = await qs.order_by("asset_code").offset(skip).limit(limit)
    status_since_map = await operational_status_since_by_equipment(tenant_id, rows)
    items: List[EquipmentOut] = []
    for r in rows:
        out = await _equipment_out(tenant_id, r)
        since = status_since_map.get(r.id)
        if since is not None:
            out = out.model_copy(update={"operational_status_since": since})
        items.append(out)
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@_equipment_ledger_router.post("/equipments", response_model=EquipmentOut, summary="创建设备")
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
    await _validate_equipment_upkeep_param_set_id(tenant_id, body.upkeep_param_set_id)
    row = await HaoligoEquipment.create(
        tenant_id=tenant_id,
        asset_code=body.asset_code.strip(),
        name=body.name.strip(),
        category_id=body.category_id,
        workshop_id=body.workshop_id,
        manufacturer_id=body.manufacturer_id,
        manufacture_date=body.manufacture_date,
        inspection_param_set_id=None,
        upkeep_param_set_id=body.upkeep_param_set_id,
        criticality=_normalize_equipment_criticality(body.criticality),
        operational_status=await normalize_operational_status(tenant_id, body.operational_status),
        remark=body.remark,
        image_file_uuids=_norm_uuid_list(body.image_file_uuids),
        maintenance_cycle_by_yield=body.maintenance_cycle_by_yield,
        maintenance_cycle_by_days=body.maintenance_cycle_by_days,
        used_yield=Decimal("0"),
    )
    await sync_equipment_inspection_param_sets(tenant_id, row.id, body.inspection_param_set_ids)
    return await _equipment_out(tenant_id, row)


@_equipment_ledger_router.get("/equipments/{row_id}", response_model=EquipmentOut, summary="设备详情")
async def get_equipment(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return await _equipment_out(tenant_id, row)


@_equipment_ledger_router.get(
    "/equipments/{row_id}/operational-status-history",
    response_model=List[EquipmentOperationalStatusLogOut],
    summary="设备运行状态变更历史",
)
async def list_equipment_operational_status_history(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    limit: int = Query(100, ge=1, le=500),
):
    if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=row_id).exists():
        await _not_found()
    rows = (
        await tenant_alive(HaoligoEquipmentOperationalStatusLog, tenant_id)
        .filter(equipment_id=row_id)
        .order_by("-created_at", "-id")
        .limit(limit)
    )
    return [EquipmentOperationalStatusLogOut.model_validate(r) for r in rows]


@_equipment_ledger_router.get(
    "/equipments/{row_id}/operation-records",
    summary="设备履历（点检/巡检/维保/产出/验收/状态变更）",
)
async def list_equipment_operation_records_api(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=row_id).exists():
        await _not_found()
    from apps.haoligo.services.equipment_operation_records import list_equipment_operation_records

    return await list_equipment_operation_records(tenant_id=tenant_id, equipment_id=row_id)


@_equipment_ledger_router.patch("/equipments/{row_id}", response_model=EquipmentOut, summary="更新设备")
async def update_equipment(
    row_id: int,
    body: EquipmentUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
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
    set_ids_payload = data.pop("inspection_param_set_ids", None)
    if "upkeep_param_set_id" in data:
        ups_id = data.pop("upkeep_param_set_id")
        await _validate_equipment_upkeep_param_set_id(tenant_id, ups_id)
        row.upkeep_param_set_id = ups_id
    if "criticality" in data:
        data["criticality"] = _normalize_equipment_criticality(data.get("criticality"))
    old_operational_status: Optional[str] = None
    new_operational_status: Optional[str] = None
    if "operational_status" in data:
        old_operational_status = row.operational_status
        new_operational_status = await normalize_operational_status(tenant_id, data.get("operational_status"))
        data["operational_status"] = new_operational_status
    if "image_file_uuids" in data and data["image_file_uuids"] is not None:
        data["image_file_uuids"] = _norm_uuid_list(data["image_file_uuids"])
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    if set_ids_payload is not None:
        await sync_equipment_inspection_param_sets(tenant_id, row.id, set_ids_payload)
    if "operational_status" in data and old_operational_status != new_operational_status:
        await HaoligoEquipmentOperationalStatusLog.create(
            tenant_id=tenant_id,
            equipment_id=row.id,
            old_status=old_operational_status,
            new_status=new_operational_status or "",
            changed_by_user_id=user.id,
        )
    return await _equipment_out(tenant_id, row)


@_equipment_ledger_router.delete("/equipments/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备")
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


@_patrol_routes_router.get("/patrol-routes", response_model=List[PatrolRouteOut], summary="巡检路线列表")
async def list_patrol_routes(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoPatrolRoute, tenant_id).order_by("code")
    return [PatrolRouteOut.model_validate(r) for r in rows]


@_patrol_routes_router.post("/patrol-routes", response_model=PatrolRouteOut, summary="创建巡检路线")
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


@_patrol_routes_router.post(
    "/patrol-routes/with-steps",
    response_model=PatrolRouteOut,
    summary="创建巡检路线及步骤（事务）",
)
async def create_patrol_route_with_steps(
    body: PatrolRouteCreateWithSteps,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    """先建路线头再建步骤；任一步失败则整单回滚，避免空路线。"""
    if body.workshop_id is not None and not await tenant_alive(HaoligoWorkshop, tenant_id).filter(
        id=body.workshop_id
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
    seen: set[int] = set()
    deduped: list[PatrolStepIn] = []
    for st in body.steps:
        if st.equipment_id in seen:
            continue
        seen.add(st.equipment_id)
        deduped.append(st)
    if not deduped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请至少添加一个巡检设备后再创建路线",
        )
    async with in_transaction() as conn:
        parent = await HaoligoPatrolRoute.create(
            tenant_id=tenant_id,
            code=body.code.strip(),
            name=body.name.strip(),
            workshop_id=body.workshop_id,
            using_db=conn,
        )
        for idx, st in enumerate(sorted(deduped, key=lambda x: x.sequence)):
            if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=st.equipment_id).exists():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"设备 id={st.equipment_id} 不存在",
                )
            try:
                await HaoligoPatrolRouteStep.create(
                    tenant_id=tenant_id,
                    route_id=parent.id,
                    equipment_id=st.equipment_id,
                    sequence=idx,
                    using_db=conn,
                )
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="巡检路线步骤重复或非法",
                ) from exc
    row = await tenant_alive(HaoligoPatrolRoute, tenant_id).filter(id=parent.id).first()
    if not row:
        await _not_found()
    return PatrolRouteOut.model_validate(row)


@_patrol_routes_router.patch("/patrol-routes/{row_id}", response_model=PatrolRouteOut, summary="更新巡检路线")
async def update_patrol_route(
    row_id: int,
    body: PatrolRouteUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoPatrolRoute, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    patch = body.model_dump(exclude_unset=True)
    if "name" in patch and patch["name"] is not None:
        row.name = patch["name"].strip()
    if "workshop_id" in patch:
        wid = patch["workshop_id"]
        if wid is not None:
            if not await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=wid).exists():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
            row.workshop_id = wid
        else:
            row.workshop_id = None
    await row.save()
    return PatrolRouteOut.model_validate(row)


@_patrol_routes_router.delete("/patrol-routes/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除巡检路线")
async def delete_patrol_route(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoPatrolRoute, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    now = timezone.now()
    row.deleted_at = now
    await row.save()
    await HaoligoPatrolRouteStep.filter(
        route_id=row_id, tenant_id=tenant_id, deleted_at__isnull=True
    ).update(deleted_at=now)


@_patrol_routes_router.get(
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


@_patrol_routes_router.put(
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

router.include_router(_workshops_router)
router.include_router(_manufacturers_router)
router.include_router(_inspection_params_router)
router.include_router(_inspection_param_sets_router)
router.include_router(_categories_router)
router.include_router(_equipment_ledger_router)
router.include_router(_patrol_routes_router)

