"""好力 GO — 设备保养单 API（仅保养；字段形态对齐厂内维保单头表 + 单台设备）。"""

from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._equipment_sheet_code import generate_equipment_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api.routes_mold_maintenance_sheet import _resolve_applicant_only, _validate_leaf_department
from apps.haoligo.constants.equipment_sheet_rule_codes import HAOLIGO_EQUIPMENT_UPKEEP_SHEET_NO
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_upkeep import HaoligoEquipmentUpkeepCompleteSheet, HaoligoEquipmentUpkeepSheet
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/equipment/upkeep-sheets",
    tags=["App · HaoliGO · 设备保养单"],
)


def _norm_uuid_list(v: Optional[List[str]]) -> List[str]:
    if not v:
        return []
    out: List[str] = []
    for x in v:
        s = (x or "").strip()
        if s:
            out.append(s)
    return out


def _strip_opt(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


class EquipmentUpkeepSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    applicant_user_id: Optional[int] = None
    applicant_name: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: Optional[str] = None
    header_attachment_file_uuids: List[str] = Field(default_factory=list)
    equipment_id: int
    equipment_asset_code: Optional[str] = None
    equipment_name: Optional[str] = None
    description: str
    reporter_user_id: int
    created_at: datetime


class EquipmentUpkeepSheetCreate(BaseModel):
    applicant_user_id: int = Field(ge=1, description="申请人用户 ID")
    department_uuid: str = Field(max_length=36, description="申请部门 UUID（须为末级部门）")
    equipment_id: int = Field(ge=1)
    description: str = Field(min_length=1, description="保养说明/计划")
    header_attachment_file_uuids: Optional[List[str]] = None

    @field_validator("department_uuid", mode="before")
    @classmethod
    def strip_dept_uuid(cls, v):
        if v is None:
            raise ValueError("请选择申请部门")
        s = str(v).strip()
        if not s:
            raise ValueError("请选择申请部门")
        return s

    @field_validator("description", mode="before")
    @classmethod
    def strip_desc(cls, v):
        if v is None:
            raise ValueError("请填写保养说明")
        s = str(v).strip()
        if not s:
            raise ValueError("请填写保养说明")
        return s


class EquipmentUpkeepSheetUpdate(BaseModel):
    applicant_user_id: Optional[int] = Field(None, ge=1)
    department_uuid: Optional[str] = Field(None, max_length=36)
    equipment_id: Optional[int] = Field(None, ge=1)
    description: Optional[str] = None
    header_attachment_file_uuids: Optional[List[str]] = None


async def _serialize(row: HaoligoEquipmentUpkeepSheet) -> EquipmentUpkeepSheetOut:
    await row.fetch_related("equipment")
    eq = row.equipment
    ac = getattr(eq, "asset_code", None) if eq else None
    nm = getattr(eq, "name", None) if eq else None
    return EquipmentUpkeepSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        applicant_user_id=row.applicant_user_id,
        applicant_name=row.applicant_name,
        department_uuid=row.department_uuid,
        department_name=row.department_name,
        header_attachment_file_uuids=list(row.header_attachment_file_uuids or []),
        equipment_id=row.equipment_id,
        equipment_asset_code=ac,
        equipment_name=nm,
        description=row.description,
        reporter_user_id=row.reporter_user_id,
        created_at=row.created_at,
    )


@router.get("", summary="设备保养单分页列表")
async def list_upkeep_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    open_for_complete: bool = Query(
        False,
        description="为 true 时仅返回尚未关联未删除保养完成单的保养单（用于完成单选源）",
    ),
):
    qs = tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).prefetch_related("equipment")
    if open_for_complete:
        linked_ids = (
            await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id)
            .filter(deleted_at__isnull=True, source_upkeep_sheet_id__not_isnull=True)
            .values_list("source_upkeep_sheet_id", flat=True)
        )
        lid = [int(x) for x in linked_ids if x is not None]
        if lid:
            qs = qs.filter(~Q(id__in=lid))
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(department_name__icontains=k)
            | Q(applicant_name__icontains=k)
            | Q(sheet_no__icontains=k)
            | Q(description__icontains=k)
            | Q(equipment__asset_code__icontains=k)
            | Q(equipment__name__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    return {
        "items": [await _serialize(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=EquipmentUpkeepSheetOut, summary="创建设备保养单")
async def create_upkeep_sheet(
    body: EquipmentUpkeepSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=body.equipment_id).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    app_uid, app_name = await _resolve_applicant_only(tenant_id, body.applicant_user_id)
    dept_uuid, dept_name = await _validate_leaf_department(tenant_id, body.department_uuid)
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=body.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    async with in_transaction():
        try:
            sheet_no = await generate_equipment_sheet_no(tenant_id, HAOLIGO_EQUIPMENT_UPKEEP_SHEET_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoEquipmentUpkeepSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            applicant_user_id=app_uid,
            applicant_name=app_name,
            department_uuid=dept_uuid,
            department_name=dept_name,
            header_attachment_file_uuids=_norm_uuid_list(body.header_attachment_file_uuids),
            equipment=eq,
            description=body.description.strip(),
            reporter_user_id=user.id,
        )
    await row.fetch_related("equipment")
    return await _serialize(row)


@router.get("/{row_id}", response_model=EquipmentUpkeepSheetOut, summary="设备保养单详情")
async def get_upkeep_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = (
        await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id)
        .filter(id=row_id)
        .prefetch_related("equipment")
        .first()
    )
    if not row:
        await _not_found()
    return await _serialize(row)


@router.patch("/{row_id}", response_model=EquipmentUpkeepSheetOut, summary="更新设备保养单")
async def update_upkeep_sheet(
    row_id: int,
    body: EquipmentUpkeepSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    if "equipment_id" in data:
        eid = data.pop("equipment_id")
        if eid is not None:
            if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=int(eid)).exists():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
            row.equipment_id = int(eid)
    if "description" in data and data["description"] is not None:
        s = str(data["description"]).strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="保养说明不能为空")
        data["description"] = s
    if "header_attachment_file_uuids" in data and data["header_attachment_file_uuids"] is not None:
        data["header_attachment_file_uuids"] = _norm_uuid_list(data["header_attachment_file_uuids"])
    if "applicant_user_id" in data:
        aid = data.pop("applicant_user_id")
        if aid is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="申请人不能为空")
        uid, name = await _resolve_applicant_only(tenant_id, int(aid))
        data["applicant_user_id"] = uid
        data["applicant_name"] = name
    if "department_uuid" in data:
        du = data.pop("department_uuid")
        if du is None or not str(du).strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择申请部门")
        uu, dname = await _validate_leaf_department(tenant_id, str(du).strip())
        data["department_uuid"] = uu
        data["department_name"] = dname
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    await row.fetch_related("equipment")
    return await _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备保养单")
async def delete_upkeep_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    if await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id).filter(
        source_upkeep_sheet_id=row_id,
        deleted_at__isnull=True,
    ).exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已存在关联的保养完成单，请先删除完成单后再删除保养单",
        )
    row.deleted_at = timezone.now()
    await row.save()
