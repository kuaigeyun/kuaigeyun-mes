"""好力 GO — 模具保养项与保养方案 API。"""

from __future__ import annotations

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone
from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_upkeep import (
    HaoligoMoldUpkeepParam,
    HaoligoMoldUpkeepParamSet,
    HaoligoMoldUpkeepParamSetItem,
)
from apps.haoligo.services.mold_upkeep_param_value import (
    normalize_multiselect_options,
    normalize_upkeep_value_type,
)
from apps.haoligo.services.mold_upkeep_scheme import (
    load_upkeep_scheme_for_mold_code,
    load_upkeep_scheme_template_lines,
    mold_ledger_upkeep_param_set_id,
)
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/molds",
    tags=["App · HaoliGO · 模具保养方案"],
)


async def _not_found() -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


# --- Pydantic ---


class MoldUpkeepParamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str
    requirement: Optional[str] = None
    value_type: str = "text"
    default_value: Optional[str] = None


class MoldUpkeepParamCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    requirement: Optional[str] = Field(None, description="保养要求")
    value_type: str = Field(default="text", max_length=32)
    default_value: Optional[str] = Field(
        None,
        description="多选时为候选项（逗号分隔）；文本型可选默认提示",
    )


class MoldUpkeepParamUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    requirement: Optional[str] = Field(None, description="保养要求；传空字符串表示清除")
    value_type: Optional[str] = Field(None, max_length=32)
    default_value: Optional[str] = Field(
        None,
        description="多选候选项或文本默认；传空字符串表示清除",
    )


class MoldUpkeepParamSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    name: str


class MoldUpkeepParamSetCreate(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)


class MoldUpkeepParamSetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)


class MoldUpkeepSetItemOut(BaseModel):
    id: int
    param_id: int
    set_id: int
    sort_order: int
    is_required: bool


class MoldUpkeepSetItemCreate(BaseModel):
    param_id: int
    sort_order: int = 0
    is_required: bool = True


class MoldUpkeepSetItemUpdate(BaseModel):
    sort_order: Optional[int] = None
    is_required: Optional[bool] = None


class MoldUpkeepSetItemCreateWithItems(BaseModel):
    code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    items: List[MoldUpkeepSetItemCreate] = Field(default_factory=list)


class MoldUpkeepSchemeLineOut(BaseModel):
    param_id: int
    param_code: str
    param_name: str
    requirement: Optional[str] = None
    value_type: str = "text"
    option_values: List[str] = Field(default_factory=list)
    is_required: bool = True
    sort_order: int = 0
    record_value: Optional[str] = None


class MoldUpkeepSchemeContextOut(BaseModel):
    mold_code: str
    ledger_upkeep_param_set_id: Optional[int] = Field(
        None,
        description="台账绑定的保养方案 id；有值时前端应自动带出且不可改",
    )
    lines: List[MoldUpkeepSchemeLineOut] = Field(
        default_factory=list,
        description="台账已绑方案时的方案行；未绑定时为空，由前端按所选方案另行拉取",
    )


# --- 保养项 ---


@router.get(
    "/upkeep-params",
    response_model=List[MoldUpkeepParamOut],
    summary="保养项列表",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-params"))],
)
async def list_mold_upkeep_params(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoMoldUpkeepParam, tenant_id).order_by("code")
    return [MoldUpkeepParamOut.model_validate(r) for r in rows]


@router.post(
    "/upkeep-params",
    response_model=MoldUpkeepParamOut,
    summary="创建保养项",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-params"))],
)
async def create_mold_upkeep_param(
    body: MoldUpkeepParamCreate,
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
    row = await HaoligoMoldUpkeepParam.create(
        tenant_id=tenant_id,
        code=body.code.strip(),
        name=body.name.strip(),
        requirement=(body.requirement or "").strip() or None,
        value_type=vt,
        default_value=dv,
    )
    return MoldUpkeepParamOut.model_validate(row)


@router.patch(
    "/upkeep-params/{row_id}",
    response_model=MoldUpkeepParamOut,
    summary="更新保养项",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-params"))],
)
async def update_mold_upkeep_param(
    row_id: int,
    body: MoldUpkeepParamUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldUpkeepParam, tenant_id).filter(id=row_id).first()
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
    return MoldUpkeepParamOut.model_validate(row)


@router.delete(
    "/upkeep-params/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="软删除保养项",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-params"))],
)
async def delete_mold_upkeep_param(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldUpkeepParam, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    used = await tenant_alive(HaoligoMoldUpkeepParamSetItem, tenant_id).filter(param_id=row_id).exists()
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
    response_model=List[MoldUpkeepParamSetOut],
    summary="保养方案列表",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def list_mold_upkeep_param_sets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    rows = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).order_by("code")
    return [MoldUpkeepParamSetOut.model_validate(r) for r in rows]


@router.post(
    "/upkeep-param-sets",
    response_model=MoldUpkeepParamSetOut,
    summary="创建保养方案",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def create_mold_upkeep_param_set(
    body: MoldUpkeepParamSetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoMoldUpkeepParamSet.create(
        tenant_id=tenant_id,
        code=body.code.strip(),
        name=body.name.strip(),
    )
    return MoldUpkeepParamSetOut.model_validate(row)


@router.post(
    "/upkeep-param-sets/with-items",
    response_model=MoldUpkeepParamSetOut,
    summary="创建保养方案及明细（事务）",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def create_mold_upkeep_param_set_with_items(
    body: MoldUpkeepSetItemCreateWithItems,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    seen: set[int] = set()
    deduped: list[MoldUpkeepSetItemCreate] = []
    for it in body.items:
        if it.param_id in seen:
            continue
        seen.add(it.param_id)
        deduped.append(it)
    async with in_transaction():
        parent = await HaoligoMoldUpkeepParamSet.create(
            tenant_id=tenant_id,
            code=body.code.strip(),
            name=body.name.strip(),
        )
        for it in deduped:
            param = await tenant_alive(HaoligoMoldUpkeepParam, tenant_id).filter(id=it.param_id).first()
            if not param:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"保养项不存在: {it.param_id}",
                )
            try:
                await HaoligoMoldUpkeepParamSetItem.create(
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
    row = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).filter(id=parent.id).first()
    if not row:
        await _not_found()
    return MoldUpkeepParamSetOut.model_validate(row)


@router.patch(
    "/upkeep-param-sets/{row_id}",
    response_model=MoldUpkeepParamSetOut,
    summary="更新保养方案",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def update_mold_upkeep_param_set(
    row_id: int,
    body: MoldUpkeepParamSetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if body.name is not None:
        row.name = body.name.strip()
    await row.save()
    return MoldUpkeepParamSetOut.model_validate(row)


@router.delete(
    "/upkeep-param-sets/{row_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="软删除保养方案",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def delete_mold_upkeep_param_set(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if await tenant_alive(HaoligoMold, tenant_id).filter(upkeep_param_set_id=row_id).exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该保养方案已被模具台账引用，无法删除",
        )
    await tenant_alive(HaoligoMoldUpkeepParamSetItem, tenant_id).filter(set_id=row_id, deleted_at__isnull=True).update(
        deleted_at=timezone.now()
    )
    row.deleted_at = timezone.now()
    await row.save()


@router.get(
    "/upkeep-param-sets/{set_id}/items",
    response_model=List[MoldUpkeepSetItemOut],
    summary="保养方案明细",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def list_mold_upkeep_set_items(
    set_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        await _not_found()
    rows = (
        await tenant_alive(HaoligoMoldUpkeepParamSetItem, tenant_id)
        .filter(set_id=set_id)
        .order_by("sort_order", "id")
    )
    return [
        MoldUpkeepSetItemOut(
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
    response_model=MoldUpkeepSetItemOut,
    summary="保养方案添加明细",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def add_mold_upkeep_set_item(
    set_id: int,
    body: MoldUpkeepSetItemCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        await _not_found()
    param = await tenant_alive(HaoligoMoldUpkeepParam, tenant_id).filter(id=body.param_id).first()
    if not param:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="保养项不存在")
    try:
        row = await HaoligoMoldUpkeepParamSetItem.create(
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
    return MoldUpkeepSetItemOut(
        id=row.id,
        param_id=row.param_id,
        set_id=row.set_id,
        sort_order=row.sort_order,
        is_required=row.is_required,
    )


@router.patch(
    "/upkeep-param-set-items/{item_id}",
    response_model=MoldUpkeepSetItemOut,
    summary="更新保养方案明细",
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def update_mold_upkeep_set_item(
    item_id: int,
    body: MoldUpkeepSetItemUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldUpkeepParamSetItem, tenant_id).filter(id=item_id).first()
    if not row:
        await _not_found()
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.is_required is not None:
        row.is_required = body.is_required
    await row.save()
    return MoldUpkeepSetItemOut(
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
    dependencies=[Depends(require_haoligo_module_access("molds-upkeep-param-sets"))],
)
async def delete_mold_upkeep_set_item(
    item_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldUpkeepParamSetItem, tenant_id).filter(id=item_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()


@router.get(
    "/upkeep-param-sets/{set_id}/scheme-lines",
    response_model=List[MoldUpkeepSchemeLineOut],
    summary="保养方案展开行（含保养项快照，供完修单填记录）",
)
async def list_mold_upkeep_scheme_lines_by_set(
    set_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    parent = await tenant_alive(HaoligoMoldUpkeepParamSet, tenant_id).filter(id=set_id).first()
    if not parent:
        await _not_found()
    lines = await load_upkeep_scheme_template_lines(tenant_id, set_id)
    return [MoldUpkeepSchemeLineOut.model_validate(x) for x in lines]


@router.get(
    "/upkeep-scheme-context",
    response_model=MoldUpkeepSchemeContextOut,
    summary="按模具代号解析保养方案（台账绑定 id + 方案行）",
)
async def get_mold_upkeep_scheme_context(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    mold_code: str = Query(..., description="模具代号"),
):
    mc = (mold_code or "").strip()
    if not mc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模具代号不能为空")
    ledger_id = await mold_ledger_upkeep_param_set_id(tenant_id, mc)
    lines: list[MoldUpkeepSchemeLineOut] = []
    if ledger_id is not None:
        raw = await load_upkeep_scheme_template_lines(tenant_id, ledger_id)
        lines = [MoldUpkeepSchemeLineOut.model_validate(x) for x in raw]
    return MoldUpkeepSchemeContextOut(mold_code=mc, ledger_upkeep_param_set_id=ledger_id, lines=lines)


@router.get(
    "/upkeep-scheme-by-code",
    response_model=List[MoldUpkeepSchemeLineOut],
    summary="按模具代号加载保养方案行（台账绑定方案）",
)
async def list_mold_upkeep_scheme_by_mold_code(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    mold_code: str = Query(..., description="模具代号"),
):
    mc = (mold_code or "").strip()
    if not mc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模具代号不能为空")
    lines = await load_upkeep_scheme_for_mold_code(tenant_id, mc)
    return [MoldUpkeepSchemeLineOut.model_validate(x) for x in lines]
