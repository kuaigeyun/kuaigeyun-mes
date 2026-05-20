"""好力 GO — 设备维保完成单 API（关联设备维保单；维修/保养）。"""

import re
from datetime import datetime
from typing import Annotated, Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._equipment_sheet_code import generate_equipment_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api.equipment_maintenance_equipment_status import (
    refresh_equipment_status_after_maintenance_change,
)
from apps.haoligo.api.routes_mold_maintenance_sheet import _resolve_applicant_only, _validate_leaf_department
from apps.haoligo.constants.equipment_maintenance import (
    EQUIPMENT_MAINTENANCE_REPAIR_RESULTS,
    EQUIPMENT_MAINTENANCE_REPAIR_RESULT_SET,
    normalize_equipment_service_type,
)
from apps.haoligo.constants.equipment_sheet_rule_codes import HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_SHEET_NO
from apps.haoligo.models.equipment_upkeep import HaoligoEquipmentUpkeepCompleteSheet, HaoligoEquipmentUpkeepSheet
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/equipment/upkeep-complete-sheets",
    tags=["App · HaoliGO · 设备维保完成单"],
    dependencies=[Depends(require_module_access("haoligo", "equipment-documents-upkeep-complete"))],
)

ServiceTypeLiteral = Literal["维修", "保养"]
_COMPLETION_MAX = 4000
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _norm_uuid_list(v: Any) -> List[str]:
    if v is None:
        return []
    if isinstance(v, str):
        s = v.strip()
        return [s] if s and _UUID_RE.fullmatch(s) else []
    if isinstance(v, (list, tuple)):
        out: List[str] = []
        for item in v:
            out.extend(_norm_uuid_list(item))
        seen: set[str] = set()
        deduped: List[str] = []
        for u in out:
            if u not in seen:
                seen.add(u)
                deduped.append(u)
        return deduped
    s = str(v).strip()
    return [s] if s and _UUID_RE.fullmatch(s) else []


def _strip_opt(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _clip_text(v: Optional[str], *, label: str, required: bool) -> Optional[str]:
    if v is None:
        if required:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label}不能为空")
        return None
    s = str(v).strip()
    if not s:
        if required:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label}不能为空")
        return None
    if len(s) > _COMPLETION_MAX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label}最多 {_COMPLETION_MAX} 字",
        )
    return s


def _apply_complete_fields(
    *,
    service_type: str,
    completion_content: Optional[str],
    repair_content: Optional[str],
    repair_result: Optional[str],
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    st = normalize_equipment_service_type(service_type)
    if st == "保养":
        cc = _clip_text(completion_content, label="保养完成说明", required=True)
        return cc, None, None
    rc = _clip_text(repair_content, label="维修内容", required=True)
    rr = _strip_opt(repair_result)
    if not rr:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择维修结果")
    if rr not in EQUIPMENT_MAINTENANCE_REPAIR_RESULT_SET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"维修结果无效，须为：{'、'.join(EQUIPMENT_MAINTENANCE_REPAIR_RESULTS)}",
        )
    return None, rc, rr


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


class EquipmentUpkeepCompleteSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    service_type: str = "保养"
    source_upkeep_sheet_id: Optional[int] = None
    source_order_no: str
    applicant_user_id: Optional[int] = None
    applicant_name: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: Optional[str] = None
    header_attachment_file_uuids: List[str] = Field(default_factory=list, description="维保后附件")
    source_header_attachment_file_uuids: List[str] = Field(
        default_factory=list,
        description="来源维保单表头附件·维保前（只读对比）",
    )
    equipment_id: Optional[int] = None
    equipment_asset_code: Optional[str] = None
    equipment_name: Optional[str] = None
    source_description: Optional[str] = Field(None, description="来源维保单维修原因/保养要求（只读对比）")
    source_service_type: Optional[str] = Field(None, description="来源维保单类型")
    completion_content: Optional[str] = None
    repair_content: Optional[str] = None
    repair_result: Optional[str] = None
    reporter_user_id: int
    created_at: datetime

    @field_validator("header_attachment_file_uuids", "source_header_attachment_file_uuids", mode="before")
    @classmethod
    def _coerce_attachment_uuids(cls, v: Any) -> List[str]:
        return _norm_uuid_list(v)


class EquipmentUpkeepCompleteSheetCreate(BaseModel):
    source_upkeep_sheet_id: int = Field(ge=1, description="设备维保单主键")
    applicant_user_id: Optional[int] = Field(None, ge=1, description="缺省从来源维保单带出")
    department_uuid: Optional[str] = Field(None, max_length=36, description="缺省从来源维保单带出")
    header_attachment_file_uuids: Optional[List[str]] = Field(None, description="维保后附件")
    completion_content: Optional[str] = Field(None, description="保养完成说明")
    repair_content: Optional[str] = Field(None, description="维修内容")
    repair_result: Optional[str] = Field(None, max_length=32, description="维修结果")


class EquipmentUpkeepCompleteSheetUpdate(BaseModel):
    applicant_user_id: Optional[int] = Field(None, ge=1)
    department_uuid: Optional[str] = Field(None, max_length=36)
    header_attachment_file_uuids: Optional[List[str]] = None
    completion_content: Optional[str] = None
    repair_content: Optional[str] = None
    repair_result: Optional[str] = None


async def _serialize(row: HaoligoEquipmentUpkeepCompleteSheet) -> EquipmentUpkeepCompleteSheetOut:
    src_header: List[str] = []
    src_desc: Optional[str] = None
    src_svc: Optional[str] = None
    eq_id: Optional[int] = None
    eq_ac: Optional[str] = None
    eq_nm: Optional[str] = None
    sid = getattr(row, "source_upkeep_sheet_id", None)
    if sid:
        src_row = (
            await tenant_alive(HaoligoEquipmentUpkeepSheet, row.tenant_id)
            .filter(id=sid)
            .prefetch_related("equipment")
            .first()
        )
        if src_row:
            src_header = _norm_uuid_list(src_row.header_attachment_file_uuids)
            src_desc = src_row.description
            src_svc = (src_row.service_type or "保养").strip()
            await src_row.fetch_related("equipment")
            if src_row.equipment:
                eq_id = src_row.equipment_id
                eq_ac = getattr(src_row.equipment, "asset_code", None)
                eq_nm = getattr(src_row.equipment, "name", None)
    return EquipmentUpkeepCompleteSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        service_type=(row.service_type or "保养").strip(),
        source_upkeep_sheet_id=row.source_upkeep_sheet_id,
        source_order_no=row.source_order_no,
        applicant_user_id=row.applicant_user_id,
        applicant_name=row.applicant_name,
        department_uuid=row.department_uuid,
        department_name=row.department_name,
        header_attachment_file_uuids=_norm_uuid_list(row.header_attachment_file_uuids),
        source_header_attachment_file_uuids=src_header,
        equipment_id=eq_id,
        equipment_asset_code=eq_ac,
        equipment_name=eq_nm,
        source_description=src_desc,
        source_service_type=src_svc,
        completion_content=row.completion_content,
        repair_content=row.repair_content,
        repair_result=row.repair_result,
        reporter_user_id=row.reporter_user_id,
        created_at=row.created_at,
    )


@router.get("", summary="设备维保完成单分页列表")
async def list_upkeep_complete_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None, description="维修/保养"),
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
):
    qs = tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id)
    if service_type and str(service_type).strip():
        try:
            st = normalize_equipment_service_type(service_type)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        qs = qs.filter(service_type=st)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(source_order_no__icontains=k)
            | Q(sheet_no__icontains=k)
            | Q(applicant_name__icontains=k)
            | Q(department_name__icontains=k)
            | Q(service_type__icontains=k)
            | Q(completion_content__icontains=k)
            | Q(repair_content__icontains=k)
            | Q(repair_result__icontains=k)
        )
    if created_from is not None:
        qs = qs.filter(created_at__gte=created_from)
    if created_to is not None:
        qs = qs.filter(created_at__lte=created_to)
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items = [await _serialize(r) for r in rows]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("", response_model=EquipmentUpkeepCompleteSheetOut, summary="创建设备维保完成单")
async def create_upkeep_complete_sheet(
    body: EquipmentUpkeepCompleteSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    src = await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).filter(id=body.source_upkeep_sheet_id).first()
    if not src:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备维保单不存在")
    if await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id).filter(
        source_upkeep_sheet_id=src.id,
        deleted_at__isnull=True,
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该维保单已存在维保完成单，不可重复确认")
    svc = (src.service_type or "保养").strip()
    try:
        completion_content, repair_content, repair_result = _apply_complete_fields(
            service_type=svc,
            completion_content=body.completion_content,
            repair_content=body.repair_content,
            repair_result=body.repair_result,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    src_no = (str(src.sheet_no or "").strip() or f"维保单#{src.id}")
    applicant_id = body.applicant_user_id if body.applicant_user_id is not None else src.applicant_user_id
    if not applicant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写申请人")
    dept_raw = body.department_uuid if body.department_uuid is not None else src.department_uuid
    dept_uu = _strip_opt(str(dept_raw) if dept_raw is not None else None)
    if not dept_uu:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择申请部门")
    applicant_user_id_resolved, applicant_name = await _resolve_applicant_only(tenant_id, int(applicant_id))
    department_uuid_resolved, department_name = await _validate_leaf_department(tenant_id, dept_uu)
    equipment_id = src.equipment_id
    async with in_transaction():
        try:
            sheet_no = await generate_equipment_sheet_no(tenant_id, HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_SHEET_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoEquipmentUpkeepCompleteSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            service_type=svc,
            source_upkeep_sheet=src,
            source_order_no=src_no,
            applicant_user_id=applicant_user_id_resolved,
            applicant_name=applicant_name,
            department_uuid=department_uuid_resolved,
            department_name=department_name,
            header_attachment_file_uuids=_norm_uuid_list(body.header_attachment_file_uuids),
            completion_content=completion_content,
            repair_content=repair_content,
            repair_result=repair_result,
            reporter_user_id=user.id,
        )
        await refresh_equipment_status_after_maintenance_change(
            tenant_id,
            equipment_id,
            changed_by_user_id=user.id,
        )
    return await _serialize(row)


@router.get("/{row_id}", response_model=EquipmentUpkeepCompleteSheetOut, summary="设备维保完成单详情")
async def get_upkeep_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return await _serialize(row)


@router.patch("/{row_id}", response_model=EquipmentUpkeepCompleteSheetOut, summary="更新设备维保完成单")
async def update_upkeep_complete_sheet(
    row_id: int,
    body: EquipmentUpkeepCompleteSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    svc = (row.service_type or "保养").strip()
    data = body.model_dump(exclude_unset=True)
    if "header_attachment_file_uuids" in data and data["header_attachment_file_uuids"] is not None:
        data["header_attachment_file_uuids"] = _norm_uuid_list(data["header_attachment_file_uuids"])
    if any(k in data for k in ("completion_content", "repair_content", "repair_result")):
        cc = data.get("completion_content", row.completion_content)
        rc = data.get("repair_content", row.repair_content)
        rr = data.get("repair_result", row.repair_result)
        try:
            completion_content, repair_content, repair_result = _apply_complete_fields(
                service_type=svc,
                completion_content=cc,
                repair_content=rc,
                repair_result=rr,
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        data["completion_content"] = completion_content
        data["repair_content"] = repair_content
        data["repair_result"] = repair_result
    if "applicant_user_id" in data:
        aid = data.pop("applicant_user_id")
        if aid is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="申请人不能为空")
        uid, name = await _resolve_applicant_only(tenant_id, int(aid))
        data["applicant_user_id"] = uid
        data["applicant_name"] = name
    if "department_uuid" in data:
        du = data.pop("department_uuid")
        du_s = _strip_opt(str(du) if du is not None else None)
        if not du_s:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择申请部门")
        uu, dname = await _validate_leaf_department(tenant_id, du_s)
        data["department_uuid"] = uu
        data["department_name"] = dname
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    equipment_id: Optional[int] = None
    if row.source_upkeep_sheet_id:
        src = await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).filter(id=row.source_upkeep_sheet_id).first()
        if src:
            equipment_id = src.equipment_id
    if equipment_id:
        await refresh_equipment_status_after_maintenance_change(
            tenant_id,
            equipment_id,
            changed_by_user_id=user.id,
        )
    return await _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备维保完成单")
async def delete_upkeep_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    equipment_id: Optional[int] = None
    if row.source_upkeep_sheet_id:
        src = await tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id).filter(id=row.source_upkeep_sheet_id).first()
        if src:
            equipment_id = src.equipment_id
    row.deleted_at = timezone.now()
    await row.save()
    if equipment_id:
        await refresh_equipment_status_after_maintenance_change(
            tenant_id,
            equipment_id,
            changed_by_user_id=user.id,
        )
