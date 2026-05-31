"""好力 GO — 设备保养项与保养方案 API。"""

from __future__ import annotations

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone
from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_upkeep_param import (
    HaoligoEquipmentUpkeepParam,
    HaoligoEquipmentUpkeepParamSet,
    HaoligoEquipmentUpkeepParamSetItem,
)
from apps.haoligo.services.mold_upkeep_param_value import (
    normalize_multiselect_options,
    normalize_upkeep_value_type,
)
from apps.haoligo.services.equipment_upkeep_scheme import (
    equipment_ledger_upkeep_param_set_id,
    load_upkeep_scheme_for_equipment,
    load_upkeep_scheme_template_lines,
)
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/equipment",
    tags=["App · HaoliGO · 设备保养方案"],
)


async def _not_found() -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


# --- Pydantic ---


class EquipmentUpkeepParamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str
    requirement: Optional[str] = None
    value_type: str = "text"
    default_value: Optional[str] = None


class EquipmentUpkeepParamCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    requirement: Optional[str] = Field(None, description="保养要求")
    value_type: str = Field(default="text", max_length=32)
    default_value: Optional[str] = Field(
        None,
        description="多选时为候选项（逗号分隔）；文本型可选默认提示",
    )


class EquipmentUpkeepParamUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    requirement: Optional[str] = Field(None, description="保养要求；传空字符串表示清除")
    value_type: Optional[str] = Field(None, max_length=32)
    default_value: Optional[str] = Field(
        None,
        description="多选候选项或文本默认；传空字符串表示清除",
    )


class EquipmentUpkeepParamSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str


class EquipmentUpkeepParamSetCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)


class EquipmentUpkeepParamSetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)


class EquipmentUpkeepSetItemOut(BaseModel):
    id: int
    param_id: int
    set_id: int
    sort_order: int
    is_required: bool


class EquipmentUpkeepSetItemCreate(BaseModel):
    param_id: int
    sort_order: int = 0
    is_required: bool = True


class EquipmentUpkeepSetItemUpdate(BaseModel):
    sort_order: Optional[int] = None
    is_required: Optional[bool] = None


class EquipmentUpkeepSetItemCreateWithItems(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    items: List[EquipmentUpkeepSetItemCreate] = Field(default_factory=list)


class EquipmentUpkeepSchemeLineOut(BaseModel):
    param_id: int
    param_code: str
    param_name: str
    requirement: Optional[str] = None
    value_type: str = "text"
    option_values: List[str] = Field(default_factory=list)
    is_required: bool = True
    sort_order: int = 0
    record_value: Optional[str] = None


class EquipmentUpkeepSchemeContextOut(BaseModel):
    equipment_id: int
    ledger_upkeep_param_set_id: Optional[int] = Field(
        None,
        description="台账绑定的保养方案 id；有值时前端应自动带出",
    )
    lines: List[EquipmentUpkeepSchemeLineOut] = Field(
        default_factory=list,
        description="台账已绑方案时的方案行；未绑定时为空，由前端按所选方案另行拉取",
    )


# --- 保养项 ---


@router.get(
    "/upkeep-params",
    response_model=List[EquipmentUpkeepParamOut],
    summary="保养项列表",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-params"))],
)
async def list_equipment_upkeep_params(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoEquipmentUpkeepParam, tenant_id).order_by("code")
    return [EquipmentUpkeepParamOut.model_validate(r) for r in rows]


@router.post(
    "/upkeep-params",
    response_model=EquipmentUpkeepParamOut,
    summary="创建保养项",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-params"))],
)
async def create_equipment_upkeep_param(
    body: EquipmentUpkeepParamCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    vt = normalize_upkeep_value_type(body.value_type)
    try:
        dv = (
            normalize_multiselect_options(body.default_value)
            if vt == "multiselect"
            else ((body.default_value or "").strip() or None)
        )
        if vt == "multiselect" and not dv:
            raise ValueError("多选类型须至少配置一个候选项")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    row = await HaoligoEquipmentUpkeepParam.create(
        tenant_id=tenant_id,
        code=body.code.strip(),
        name=body.name.strip(),
        requirement=(body.requirement or "").strip() or None,
        value_type=vt,
        default_value=dv,
    )
    return EquipmentUpkeepParamOut.model_validate(row)


@router.patch(
    "/upkeep-params/{row_id}",
    response_model=EquipmentUpkeepParamOut,
    summary="更新保养项",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-params"))],
)
async def update_equipment_upkeep_param(
    row_id: int,
    body: EquipmentUpkeepParamUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepParam, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.name is not None:
        row.name = body.name.strip()
    if body.requirement is not None:
        req = body.requirement
        row.requirement = None if req is None else (str(req).strip() or None)
    if body.value_type is not None:
        row.value_type = normalize_upkeep_value_type(body.value_type)
    vt = row.value_type or "text"
    if body.default_value is not None:
        dv_raw = body.default_value
        try:
            if vt == "multiselect":
                row.default_value = normalize_multiselect_options(dv_raw)
                if not row.default_value:
                    raise ValueError("多选类型须至少配置一个候选项")
            else:
                row.default_value = None if dv_raw is None else (str(dv_raw).strip() or None)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    elif body.value_type is not None and vt == "multiselect":
        try:
            row.default_value = normalize_multiselect_options(row.default_value)
            if not row.default_value:
                raise ValueError("多选类型须至少配置一个候选项")
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    await row.save()
    return EquipmentUpkeepParamOut.model_validate(row)


@router.delete(
    "/upkeep-params/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="软删除保养项",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-params"))],
)
async def delete_equipment_upkeep_param(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepParam, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    used = await tenant_alive(HaoligoEquipmentUpkeepParamSetItem, tenant_id).filter(param_id=row_id).exists()
    if used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该保养项已被保养方案引用，请先从方案中移除后再删除",
        )
    row.deleted_at = timezone.now()
    await row.save()


# --- 保养方案 ---


@router.get(
    "/upkeep-param-sets",
    response_model=List[EquipmentUpkeepParamSetOut],
    summary="保养方案列表",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def list_equipment_upkeep_param_sets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).order_by("code")
    return [EquipmentUpkeepParamSetOut.model_validate(r) for r in rows]


@router.post(
    "/upkeep-param-sets",
    response_model=EquipmentUpkeepParamSetOut,
    summary="创建保养方案",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def create_equipment_upkeep_param_set(
    body: EquipmentUpkeepParamSetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoEquipmentUpkeepParamSet.create(
        tenant_id=tenant_id,
        code=body.code.strip(),
        name=body.name.strip(),
    )
    return EquipmentUpkeepParamSetOut.model_validate(row)


@router.post(
    "/upkeep-param-sets/with-items",
    response_model=EquipmentUpkeepParamSetOut,
    summary="创建保养方案及明细（事务）",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def create_equipment_upkeep_param_set_with_items(
    body: EquipmentUpkeepSetItemCreateWithItems,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    seen: set[int] = set()
    deduped: list[EquipmentUpkeepSetItemCreate] = []
    for it in body.items:
        if it.param_id in seen:
            continue
        seen.add(it.param_id)
        deduped.append(it)
    async with in_transaction():
        parent = await HaoligoEquipmentUpkeepParamSet.create(
            tenant_id=tenant_id,
            code=body.code.strip(),
            name=body.name.strip(),
        )
        for it in deduped:
            param = await tenant_alive(HaoligoEquipmentUpkeepParam, tenant_id).filter(id=it.param_id).first()
            if not param:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"保养项不存在: {it.param_id}",
                )
            try:
                await HaoligoEquipmentUpkeepParamSetItem.create(
                    tenant_id=tenant_id,
                    set_id=parent.id,
                    param_id=it.param_id,
                    sort_order=it.sort_order,
                    is_required=it.is_required,
                )
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="保养方案明细重复或非法",
                ) from exc
    row = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=parent.id).first()
    if not row:
        await _not_found()
    return EquipmentUpkeepParamSetOut.model_validate(row)


@router.patch(
    "/upkeep-param-sets/{row_id}",
    response_model=EquipmentUpkeepParamSetOut,
    summary="更新保养方案",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def update_equipment_upkeep_param_set(
    row_id: int,
    body: EquipmentUpkeepParamSetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.name is not None:
        row.name = body.name.strip()
    await row.save()
    return EquipmentUpkeepParamSetOut.model_validate(row)


@router.delete(
    "/upkeep-param-sets/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="软删除保养方案",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def delete_equipment_upkeep_param_set(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if await tenant_alive(HaoligoEquipment, tenant_id).filter(upkeep_param_set_id=row_id).exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该保养方案已被模具台账引用，无法删除",
        )
    await tenant_alive(HaoligoEquipmentUpkeepParamSetItem, tenant_id).filter(set_id=row_id, deleted_at__isnull=True).update(
        deleted_at=timezone.now()
    )
    row.deleted_at = timezone.now()
    await row.save()


@router.get(
    "/upkeep-param-sets/{set_id}/items",
    response_model=List[EquipmentUpkeepSetItemOut],
    summary="保养方案明细",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def list_equipment_upkeep_set_items(
    set_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        await _not_found()
    rows = (
        await tenant_alive(HaoligoEquipmentUpkeepParamSetItem, tenant_id)
        .filter(set_id=set_id)
        .order_by("sort_order", "id")
    )
    return [
        EquipmentUpkeepSetItemOut(
            id=r.id,
            param_id=r.param_id,
            set_id=r.set_id,
            sort_order=r.sort_order,
            is_required=r.is_required,
        )
        for r in rows
    ]


@router.post(
    "/upkeep-param-sets/{set_id}/items",
    response_model=EquipmentUpkeepSetItemOut,
    summary="保养方案添加明细",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def add_equipment_upkeep_set_item(
    set_id: int,
    body: EquipmentUpkeepSetItemCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        await _not_found()
    param = await tenant_alive(HaoligoEquipmentUpkeepParam, tenant_id).filter(id=body.param_id).first()
    if not param:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="保养项不存在")
    try:
        row = await HaoligoEquipmentUpkeepParamSetItem.create(
            tenant_id=tenant_id,
            set_id=set_id,
            param_id=body.param_id,
            sort_order=body.sort_order,
            is_required=body.is_required,
        )
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该保养项已在本方案中存在，请勿重复添加",
        ) from None
    return EquipmentUpkeepSetItemOut(
        id=row.id,
        param_id=row.param_id,
        set_id=row.set_id,
        sort_order=row.sort_order,
        is_required=row.is_required,
    )


@router.patch(
    "/upkeep-param-set-items/{item_id}",
    response_model=EquipmentUpkeepSetItemOut,
    summary="更新保养方案明细",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def update_equipment_upkeep_set_item(
    item_id: int,
    body: EquipmentUpkeepSetItemUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepParamSetItem, tenant_id).filter(id=item_id).first()
    if not row:
        await _not_found()
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.is_required is not None:
        row.is_required = body.is_required
    await row.save()
    return EquipmentUpkeepSetItemOut(
        id=row.id,
        param_id=row.param_id,
        set_id=row.set_id,
        sort_order=row.sort_order,
        is_required=row.is_required,
    )


@router.delete(
    "/upkeep-param-set-items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除保养方案明细",
    dependencies=[Depends(require_module_access("haoligo", "equipment-upkeep-param-sets"))],
)
async def delete_equipment_upkeep_set_item(
    item_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepParamSetItem, tenant_id).filter(id=item_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()


@router.get(
    "/upkeep-param-sets/{set_id}/scheme-lines",
    response_model=List[EquipmentUpkeepSchemeLineOut],
    summary="保养方案展开行（含保养项快照，供完修单填记录）",
)
async def list_equipment_upkeep_scheme_lines_by_set(
    set_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        await _not_found()
    lines = await load_upkeep_scheme_template_lines(tenant_id, set_id)
    return [EquipmentUpkeepSchemeLineOut.model_validate(x) for x in lines]


@router.get(
    "/upkeep-scheme-context",
    response_model=EquipmentUpkeepSchemeContextOut,
    summary="按设备解析保养方案（台账绑定 id + 方案行）",
)
async def get_equipment_upkeep_scheme_context(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    equipment_id: int = Query(..., ge=1, description="设备台账 id"),
):
    if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    ledger_id = await equipment_ledger_upkeep_param_set_id(tenant_id, equipment_id)
    lines: list[EquipmentUpkeepSchemeLineOut] = []
    if ledger_id is not None:
        raw = await load_upkeep_scheme_template_lines(tenant_id, ledger_id)
        lines = [EquipmentUpkeepSchemeLineOut.model_validate(x) for x in raw]
    return EquipmentUpkeepSchemeContextOut(
        equipment_id=equipment_id,
        ledger_upkeep_param_set_id=ledger_id,
        lines=lines,
    )


@router.get(
    "/upkeep-scheme-by-equipment",
    response_model=List[EquipmentUpkeepSchemeLineOut],
    summary="按设备台账加载保养方案行（台账绑定方案）",
)
async def list_equipment_upkeep_scheme_by_equipment(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    equipment_id: int = Query(..., ge=1, description="设备台账 id"),
):
    if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    lines = await load_upkeep_scheme_for_equipment(tenant_id, equipment_id)
    return [EquipmentUpkeepSchemeLineOut.model_validate(x) for x in lines]
