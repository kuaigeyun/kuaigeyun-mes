"""好力 GO — 设备维保单 API（维修/保养；单台设备；对齐厂内维保单头表）。"""

from datetime import datetime
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._equipment_sheet_code import generate_equipment_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api._source_sheet_delete_guard import assert_no_active_child_sheet_by_fk
from apps.haoligo.api.equipment_maintenance_equipment_status import (
    apply_equipment_status_on_upkeep_sheet_created,
    refresh_equipment_status_after_maintenance_change,
)
from apps.haoligo.api.routes_mold_maintenance_sheet import _resolve_applicant_only, _validate_leaf_department
from apps.haoligo.constants.equipment_maintenance import normalize_equipment_service_type
from apps.haoligo.constants.equipment_sheet_rule_codes import (
    HAOLIGO_EQUIPMENT_MAINTENANCE_REPAIR_SHEET_NO,
    HAOLIGO_EQUIPMENT_UPKEEP_SHEET_NO,
)
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_upkeep import HaoligoEquipmentUpkeepCompleteSheet, HaoligoEquipmentUpkeepSheet
from apps.haoligo.models.equipment_upkeep_param import HaoligoEquipmentUpkeepParamSet
from apps.haoligo.services.equipment_upkeep_scheme import equipment_ledger_upkeep_param_set_id
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/equipment/upkeep-sheets",
    tags=["App · HaoliGO · 设备维保单"],
    dependencies=[Depends(require_module_access("haoligo", "equipment-documents-upkeep-sheet"))],
)

ServiceTypeLiteral = Literal["维修", "保养"]


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
    service_type: str = "保养"
    applicant_user_id: Optional[int] = None
    applicant_name: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: Optional[str] = None
    header_attachment_file_uuids: List[str] = Field(default_factory=list)
    equipment_id: int
    equipment_asset_code: Optional[str] = None
    equipment_name: Optional[str] = None
    description: Optional[str] = None
    upkeep_param_set_id: Optional[int] = None
    upkeep_param_set_code: Optional[str] = None
    upkeep_param_set_name: Optional[str] = None
    reporter_user_id: int
    created_at: datetime


class EquipmentUpkeepSheetCreate(BaseModel):
    applicant_user_id: int = Field(ge=1, description="申请人用户 ID")
    department_uuid: str = Field(max_length=36, description="申请部门 UUID（须为末级部门）")
    equipment_id: int = Field(ge=1)
    service_type: ServiceTypeLiteral = Field(description="维修/保养")
    description: Optional[str] = Field(default=None, description="维修原因/保养要求（可选）")
    upkeep_param_set_id: Optional[int] = Field(None, ge=1, description="保养方案（保养单必填；未传时用设备台账默认）")
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
            return None
        s = str(v).strip()
        return s or None


class EquipmentUpkeepSheetUpdate(BaseModel):
    applicant_user_id: Optional[int] = Field(None, ge=1)
    department_uuid: Optional[str] = Field(None, max_length=36)
    equipment_id: Optional[int] = Field(None, ge=1)
    service_type: Optional[ServiceTypeLiteral] = None
    description: Optional[str] = None
    upkeep_param_set_id: Optional[int] = Field(None, ge=1, description="保养方案")
    header_attachment_file_uuids: Optional[List[str]] = None


async def _resolve_upkeep_set_snapshot(
    tenant_id: int,
    equipment_id: int,
    service_type: str,
    upkeep_param_set_id: Optional[int],
) -> tuple[Optional[int], Optional[str], Optional[str]]:
    if service_type != "保养":
        return None, None, None
    eff = upkeep_param_set_id
    if eff is None:
        eff = await equipment_ledger_upkeep_param_set_id(tenant_id, equipment_id)
    if eff is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择保养方案")
    parent = await tenant_alive(HaoligoEquipmentUpkeepParamSet, tenant_id).filter(id=int(eff)).first()
    if not parent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="保养方案不存在")
    return int(eff), (parent.code or "").strip(), (parent.name or "").strip()


async def _serialize(row: HaoligoEquipmentUpkeepSheet) -> EquipmentUpkeepSheetOut:
    await row.fetch_related("equipment")
    eq = row.equipment
    ac = getattr(eq, "asset_code", None) if eq else None
    nm = getattr(eq, "name", None) if eq else None
    return EquipmentUpkeepSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        service_type=(row.service_type or "保养").strip(),
        applicant_user_id=row.applicant_user_id,
        applicant_name=row.applicant_name,
        department_uuid=row.department_uuid,
        department_name=row.department_name,
        header_attachment_file_uuids=_norm_uuid_list(row.header_attachment_file_uuids),
        equipment_id=row.equipment_id,
        equipment_asset_code=ac,
        equipment_name=nm,
        description=row.description,
        upkeep_param_set_id=row.upkeep_param_set_id,
        upkeep_param_set_code=row.upkeep_param_set_code,
        upkeep_param_set_name=row.upkeep_param_set_name,
        reporter_user_id=row.reporter_user_id,
        created_at=row.created_at,
    )


@router.get("", summary="设备维保单分页列表")
async def list_upkeep_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None, description="维修/保养"),
    open_for_complete: bool = Query(
        False,
        description="为 true 时仅返回尚未关联未删除维保完成单的维保单（用于完成单选源）",
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
    if service_type and str(service_type).strip():
        try:
            st = normalize_equipment_service_type(service_type)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        qs = qs.filter(service_type=st)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(department_name__icontains=k)
            | Q(applicant_name__icontains=k)
            | Q(sheet_no__icontains=k)
            | Q(service_type__icontains=k)
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


@router.post("", response_model=EquipmentUpkeepSheetOut, summary="创建设备维保单")
async def create_upkeep_sheet(
    body: EquipmentUpkeepSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        svc = normalize_equipment_service_type(body.service_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=body.equipment_id).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    app_uid, app_name = await _resolve_applicant_only(tenant_id, body.applicant_user_id)
    dept_uuid, dept_name = await _validate_leaf_department(tenant_id, body.department_uuid)
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=body.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    ups_id, ups_code, ups_name = await _resolve_upkeep_set_snapshot(
        tenant_id, body.equipment_id, svc, body.upkeep_param_set_id
    )
    rule_code = (
        HAOLIGO_EQUIPMENT_MAINTENANCE_REPAIR_SHEET_NO if svc == "维修" else HAOLIGO_EQUIPMENT_UPKEEP_SHEET_NO
    )
    async with in_transaction():
        try:
            sheet_no = await generate_equipment_sheet_no(tenant_id, rule_code)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoEquipmentUpkeepSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            service_type=svc,
            applicant_user_id=app_uid,
            applicant_name=app_name,
            department_uuid=dept_uuid,
            department_name=dept_name,
            header_attachment_file_uuids=_norm_uuid_list(body.header_attachment_file_uuids),
            equipment=eq,
            description=_strip_opt(body.description),
            upkeep_param_set_id=ups_id,
            upkeep_param_set_code=ups_code,
            upkeep_param_set_name=ups_name,
            reporter_user_id=user.id,
        )
        await apply_equipment_status_on_upkeep_sheet_created(
            tenant_id,
            eq.id,
            service_type=svc,
            changed_by_user_id=user.id,
        )
    from apps.haoligo.services.equipment_upkeep_side_effects import send_equipment_upkeep_sheet_created_messages

    await send_equipment_upkeep_sheet_created_messages(tenant_id, row)
    await row.fetch_related("equipment")
    return await _serialize(row)


@router.get("/{row_id}", response_model=EquipmentUpkeepSheetOut, summary="设备维保单详情")
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


@router.patch("/{row_id}", response_model=EquipmentUpkeepSheetOut, summary="更新设备维保单")
async def update_upkeep_sheet(
    row_id: int,
    body: EquipmentUpkeepSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    old_equipment_id = row.equipment_id
    data = body.model_dump(exclude_unset=True)
    if "service_type" in data and data["service_type"] is not None:
        try:
            data["service_type"] = normalize_equipment_service_type(data["service_type"])
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if "equipment_id" in data:
        eid = data.pop("equipment_id")
        if eid is not None:
            if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=int(eid)).exists():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
            row.equipment_id = int(eid)
    if "description" in data:
        raw = data["description"]
        data["description"] = _strip_opt(str(raw) if raw is not None else None)
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
    svc_after = (data.get("service_type") or row.service_type or "保养").strip()
    eid_after = int(data.get("equipment_id") or row.equipment_id)
    if "upkeep_param_set_id" in data or "service_type" in data or "equipment_id" in data:
        ups_in = data.pop("upkeep_param_set_id", None) if "upkeep_param_set_id" in data else row.upkeep_param_set_id
        ups_id, ups_code, ups_name = await _resolve_upkeep_set_snapshot(tenant_id, eid_after, svc_after, ups_in)
        data["upkeep_param_set_id"] = ups_id
        data["upkeep_param_set_code"] = ups_code
        data["upkeep_param_set_name"] = ups_name
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    await refresh_equipment_status_after_maintenance_change(
        tenant_id,
        row.equipment_id,
        changed_by_user_id=user.id,
    )
    if old_equipment_id != row.equipment_id:
        await refresh_equipment_status_after_maintenance_change(
            tenant_id,
            old_equipment_id,
            changed_by_user_id=user.id,
        )
    await row.fetch_related("equipment")
    return await _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备维保单")
async def delete_upkeep_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_no_active_child_sheet_by_fk(
        tenant_id,
        child_model=HaoligoEquipmentUpkeepCompleteSheet,
        source_fk_field="source_upkeep_sheet_id",
        source_id=row_id,
        source_doc_label="设备维保单",
        child_doc_label="维保完成单",
    )
    equipment_id = row.equipment_id
    row.deleted_at = timezone.now()
    await row.save()
    await refresh_equipment_status_after_maintenance_change(
        tenant_id,
        equipment_id,
        changed_by_user_id=user.id,
    )
