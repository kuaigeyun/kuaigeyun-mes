"""好力 GO — 厂内维保单 API（模具明细 JSON 与外协维保单行结构一致）。"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, List, Literal, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._mold_maintenance_mold_status import (
    apply_mold_status_on_maintenance_sheet_created,
    refresh_mold_status_if_no_open_maintenance_sheet,
    unique_mold_codes_from_stored_line_items,
)
from apps.haoligo.api._mold_sheet_audit import (
    apply_rejected_resubmit_fields,
    assert_approved_for_revoke,
    assert_pending_for_audit,
    assert_sheet_mutation_allowed,
    effective_sheet_status,
    load_sheet_row_for_audit,
)
from apps.haoligo.constants.mold_sheet_audit import (
    SHEET_AUDIT_STATUS_SET,
    SHEET_STATUS_APPROVED,
    SHEET_STATUS_PENDING,
    SHEET_STATUS_REJECTED,
)
from apps.haoligo.api._mold_inhouse_maintenance_access import (
    assert_inhouse_sheet_access_for_service_type,
    require_inhouse_maintenance_sheet_list_access,
)
from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api._source_sheet_delete_guard import assert_no_active_child_sheet_by_fk
from apps.haoligo.constants.mold_inhouse_maintenance_permissions import INHOUSE_SERVICE_TYPES
from apps.haoligo.constants.mold_sheet_rule_codes import (
    HAOLIGO_MOLD_MAINTENANCE_REPAIR_SHEET_NO,
    HAOLIGO_MOLD_MAINTENANCE_UPKEEP_SHEET_NO,
)
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_maintenance_sheet import HaoligoMoldMaintenanceSheet
from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant, get_current_user
from core.models.department import Department
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/molds/maintenance-sheets",
    tags=["App · HaoliGO · 维保单"],
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


async def _resolve_applicant_only(tenant_id: int, applicant_user_id: int) -> tuple[int, str]:
    """校验申请人属于当前租户，返回冗余显示名。"""
    u = await User.filter(
        id=applicant_user_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).first()
    if not u:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="申请人不存在或不属于当前组织",
        )
    display = ((u.full_name or "").strip() or (u.username or "").strip() or str(u.id))
    return applicant_user_id, display


async def _validate_leaf_department(tenant_id: int, department_uuid: str) -> tuple[str, str]:
    """校验申请部门为当前租户下启用、未删除的末级部门，返回 uuid 与名称。"""
    uu = _strip_opt(department_uuid)
    if not uu:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请选择申请部门",
        )
    d = await Department.filter(
        uuid=uu,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        is_active=True,
    ).first()
    if not d:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="申请部门不存在、已停用或已删除",
        )
    has_children = await Department.filter(
        parent_id=d.id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).exists()
    if has_children:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="申请部门必须为末级部门",
        )
    name = (d.name or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="申请部门名称无效",
        )
    return uu, name


async def assert_maintenance_line_molds_are_standby(
    tenant_id: int,
    stored_line_items: list,
    *,
    allow_mold_codes: Optional[Set[str]] = None,
) -> None:
    """明细模具须存在；新建或新加入行的代号须为「待用」。更新时原单已含代号可放行（本单占用后状态可能已不是待用）。"""
    allowed = {str(c).strip() for c in (allow_mold_codes or set()) if c and str(c).strip()}
    seen: set[str] = set()
    for raw in stored_line_items or []:
        if not isinstance(raw, dict):
            continue
        code = str(raw.get("mold_code") or "").strip()
        if not code or code in seen:
            continue
        seen.add(code)
        if code in allowed:
            continue
        mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=code).first()
        if not mold:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"模具「{code}」不存在",
            )
        st = (mold.status or "").strip()
        if st != "待用":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"模具「{code}」当前状态为「{st}」，仅「待用」可加入维保明细；"
                    "若模具正在生产领用（「在用」等），请先办理还入单，将状态变为「待用」后再选择。"
                ),
            )


class MoldMaintLineIn(BaseModel):
    mold_code: str = Field(max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    repair_reason: str = Field(max_length=64)
    repair_cost: Optional[Decimal] = None
    attachment_file_uuids: Optional[List[str]] = None

    @field_validator("mold_code", "repair_reason", mode="before")
    @classmethod
    def strip_req(cls, v):
        if v is None:
            raise ValueError("不能为空")
        s = str(v).strip()
        if not s:
            raise ValueError("不能为空")
        return s

    @field_validator("mold_name", mode="before")
    @classmethod
    def strip_opt_name(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("repair_cost", mode="before")
    @classmethod
    def coerce_cost(cls, v):
        if v is None or v == "":
            return None
        try:
            d = Decimal(str(v))
        except Exception as e:  # noqa: BLE001
            raise ValueError("维修费用格式无效") from e
        if d < 0:
            raise ValueError("维修费用不能为负")
        return d


class MoldMaintLineOut(BaseModel):
    mold_code: str
    mold_name: Optional[str] = None
    repair_reason: str
    repair_cost: Optional[Decimal] = None
    attachment_file_uuids: List[str] = Field(default_factory=list)


def _line_to_store(line: MoldMaintLineIn) -> dict[str, Any]:
    return {
        "mold_code": line.mold_code.strip(),
        "mold_name": line.mold_name,
        "repair_reason": line.repair_reason.strip(),
        "repair_cost": str(line.repair_cost) if line.repair_cost is not None else None,
        "attachment_file_uuids": _norm_uuid_list(line.attachment_file_uuids),
    }


def _line_from_store(raw: dict[str, Any]) -> MoldMaintLineOut:
    cost_raw = raw.get("repair_cost")
    rc: Optional[Decimal] = None
    if cost_raw is not None and cost_raw != "":
        try:
            rc = Decimal(str(cost_raw))
        except Exception:  # noqa: BLE001
            rc = None
    return MoldMaintLineOut(
        mold_code=str(raw.get("mold_code") or "").strip(),
        mold_name=_strip_opt(str(raw.get("mold_name") or "")),
        repair_reason=str(raw.get("repair_reason") or "").strip(),
        repair_cost=rc,
        attachment_file_uuids=_norm_uuid_list(raw.get("attachment_file_uuids")),
    )


class MoldMaintenanceSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    applicant_user_id: Optional[int] = None
    applicant_name: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: Optional[str] = None
    service_type: str
    source_order_no: Optional[str] = None
    header_attachment_file_uuids: List[str] = Field(default_factory=list)
    line_items: List[MoldMaintLineOut] = Field(default_factory=list)
    primary_mold_code: Optional[str] = Field(None, description="列表摘要：首行模具代号")
    sheet_status: str = Field(description="审核状态：待审核/已通过/已驳回")
    audited_at: Optional[datetime] = None
    audited_by_user_id: Optional[int] = None
    created_at: datetime


class MoldMaintenanceSheetCreate(BaseModel):
    applicant_user_id: int = Field(description="申请人用户 ID")
    department_uuid: str = Field(max_length=36, description="申请部门 UUID（须为末级部门）")
    service_type: ServiceTypeLiteral
    source_order_no: Optional[str] = Field(None, max_length=128)
    header_attachment_file_uuids: Optional[List[str]] = None
    line_items: List[MoldMaintLineIn] = Field(min_length=1)

    @field_validator("department_uuid", mode="before")
    @classmethod
    def strip_dept_uuid(cls, v):
        if v is None:
            raise ValueError("请选择申请部门")
        s = str(v).strip()
        if not s:
            raise ValueError("请选择申请部门")
        return s


class MoldMaintenanceSheetUpdate(BaseModel):
    applicant_user_id: Optional[int] = None
    department_uuid: Optional[str] = Field(None, max_length=36)
    department_name: Optional[str] = Field(None, max_length=200)
    service_type: Optional[ServiceTypeLiteral] = None
    source_order_no: Optional[str] = Field(None, max_length=128)
    header_attachment_file_uuids: Optional[List[str]] = None
    line_items: Optional[List[MoldMaintLineIn]] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _primary_mold(lines: List[MoldMaintLineOut]) -> Optional[str]:
    if not lines:
        return None
    c = (lines[0].mold_code or "").strip()
    return c or None


def _serialize(row: HaoligoMoldMaintenanceSheet) -> MoldMaintenanceSheetOut:
    raw_lines = row.line_items or []
    lines: List[MoldMaintLineOut] = []
    if isinstance(raw_lines, list):
        for item in raw_lines:
            if isinstance(item, dict):
                lines.append(_line_from_store(item))
    return MoldMaintenanceSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        applicant_user_id=row.applicant_user_id,
        applicant_name=row.applicant_name,
        department_uuid=row.department_uuid,
        department_name=row.department_name,
        service_type=row.service_type,
        source_order_no=row.source_order_no,
        header_attachment_file_uuids=list(row.header_attachment_file_uuids or []),
        line_items=lines,
        primary_mold_code=_primary_mold(lines),
        sheet_status=effective_sheet_status(row),
        audited_at=getattr(row, "audited_at", None),
        audited_by_user_id=getattr(row, "audited_by_user_id", None),
        created_at=row.created_at,
    )


@router.get("", summary="维保单分页列表")
async def list_maintenance_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[AuthContext, Depends(require_inhouse_maintenance_sheet_list_access())],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    sheet_status: Optional[str] = Query(None, description="待审核 / 已通过 / 已驳回"),
    open_for_complete: bool = Query(
        False,
        description="为 true 时仅返回尚未关联未删除维保完修单的维保单（用于完修单选源）",
    ),
    service_type: Optional[str] = Query(None, description="维修 / 保养"),
):
    qs = tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id)
    st = (sheet_status or "").strip()
    if st and st in SHEET_AUDIT_STATUS_SET:
        qs = qs.filter(sheet_status=st)
    svc = (service_type or "").strip()
    if svc in ("维修", "保养"):
        qs = qs.filter(service_type=svc)
    if open_for_complete:
        qs = qs.filter(sheet_status=SHEET_STATUS_APPROVED)
        linked_ids = (
            await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id)
            .filter(deleted_at__isnull=True, source_maintenance_sheet_id__not_isnull=True)
            .values_list("source_maintenance_sheet_id", flat=True)
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
            | Q(source_order_no__icontains=k)
            | Q(service_type__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    return {
        "items": [_serialize(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=MoldMaintenanceSheetOut, summary="创建维保单")
async def create_maintenance_sheet(
    body: MoldMaintenanceSheetCreate,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    if body.service_type not in INHOUSE_SERVICE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维修/保养类型无效")
    await assert_inhouse_sheet_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=body.service_type,
    )
    stored = [_line_to_store(x) for x in body.line_items]
    await assert_maintenance_line_molds_are_standby(tenant_id, stored)
    app_uid, app_name = await _resolve_applicant_only(tenant_id, body.applicant_user_id)
    dept_uuid, dept_name = await _validate_leaf_department(tenant_id, body.department_uuid)
    async with in_transaction():
        try:
            rule_code = (
                HAOLIGO_MOLD_MAINTENANCE_REPAIR_SHEET_NO
                if body.service_type == "维修"
                else HAOLIGO_MOLD_MAINTENANCE_UPKEEP_SHEET_NO
            )
            sheet_no = await generate_mold_sheet_no(tenant_id, rule_code)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoMoldMaintenanceSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            applicant_user_id=app_uid,
            applicant_name=app_name,
            department_uuid=dept_uuid,
            department_name=dept_name,
            service_type=body.service_type,
            source_order_no=_strip_opt(body.source_order_no),
            header_attachment_file_uuids=[],
            line_items=stored,
            sheet_status=SHEET_STATUS_PENDING,
        )
    return _serialize(row)


@router.get("/{row_id}", response_model=MoldMaintenanceSheetOut, summary="维保单详情")
async def get_maintenance_sheet(
    row_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    row = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_inhouse_sheet_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=row.service_type,
    )
    return _serialize(row)


@router.patch("/{row_id}", response_model=MoldMaintenanceSheetOut, summary="更新维保单")
async def update_maintenance_sheet(
    row_id: int,
    body: MoldMaintenanceSheetUpdate,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    row = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_inhouse_sheet_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=row.service_type,
    )
    assert_sheet_mutation_allowed(row)
    data = body.model_dump(exclude_unset=True)
    data.pop("sheet_status", None)
    if "applicant_user_id" in data and data["applicant_user_id"] is not None:
        app_uid, app_name = await _resolve_applicant_only(tenant_id, int(data["applicant_user_id"]))
        data["applicant_user_id"] = app_uid
        data["applicant_name"] = app_name
    if "department_uuid" in data and data["department_uuid"] is not None:
        du, dn = await _validate_leaf_department(tenant_id, str(data["department_uuid"]))
        data["department_uuid"] = du
        data["department_name"] = dn
    elif "department_name" in data and data["department_name"] is not None:
        s = str(data["department_name"]).strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="申请部门不能为空")
        data["department_name"] = s
    if "source_order_no" in data and data["source_order_no"] is not None:
        data["source_order_no"] = _strip_opt(str(data["source_order_no"]))
    if "header_attachment_file_uuids" in data:
        data["header_attachment_file_uuids"] = []
    if "line_items" in data and data["line_items"] is not None:
        lines = [MoldMaintLineIn.model_validate(x) for x in data["line_items"]]
        if not lines:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="至少保留一条模具明细")
        stored = [_line_to_store(x) for x in lines]
        prev_codes = set(unique_mold_codes_from_stored_line_items(row.line_items or []))
        await assert_maintenance_line_molds_are_standby(tenant_id, stored, allow_mold_codes=prev_codes)
        data["line_items"] = stored
    apply_rejected_resubmit_fields(data, row)
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return _serialize(row)


@router.post("/{row_id}/approve", response_model=MoldMaintenanceSheetOut, summary="审核通过维保单")
async def approve_maintenance_sheet(
    row_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    preview = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not preview:
        await _not_found()
    await assert_inhouse_sheet_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=preview.service_type,
    )
    async with in_transaction():
        row = await load_sheet_row_for_audit(HaoligoMoldMaintenanceSheet, tenant_id, row_id)
        assert_pending_for_audit(row)
        row.sheet_status = SHEET_STATUS_APPROVED
        row.audited_at = timezone.now()
        row.audited_by_user_id = user.id
        await row.save()
        await apply_mold_status_on_maintenance_sheet_created(
            tenant_id,
            is_outsource=False,
            service_type=row.service_type,
            stored_line_items=row.line_items or [],
        )
    row = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return await _serialize(row)


@router.post("/{row_id}/reject", response_model=MoldMaintenanceSheetOut, summary="审核驳回维保单")
async def reject_maintenance_sheet(
    row_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    row = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_inhouse_sheet_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=row.service_type,
    )
    assert_pending_for_audit(row)
    row.sheet_status = SHEET_STATUS_REJECTED
    row.audited_at = timezone.now()
    row.audited_by_user_id = user.id
    await row.save()
    return _serialize(row)


@router.post(
    "/{row_id}/revoke-approval",
    response_model=MoldMaintenanceSheetOut,
    summary="撤销维保单审核（已通过→待审核）",
)
async def revoke_maintenance_sheet_approval(
    row_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    row = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_inhouse_sheet_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=row.service_type,
    )
    assert_approved_for_revoke(row)
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    row.sheet_status = SHEET_STATUS_PENDING
    row.audited_at = None
    row.audited_by_user_id = None
    await row.save()
    for mc in codes:
        await refresh_mold_status_if_no_open_maintenance_sheet(tenant_id, mc)
    return _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除维保单")
async def delete_maintenance_sheet(
    row_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    row = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_inhouse_sheet_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=row.service_type,
    )
    assert_sheet_mutation_allowed(row)
    await assert_no_active_child_sheet_by_fk(
        tenant_id,
        child_model=HaoligoMoldMaintenanceCompleteSheet,
        source_fk_field="source_maintenance_sheet_id",
        source_id=row_id,
        source_doc_label="厂内维保单",
        child_doc_label="维保完修单",
    )
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    row.deleted_at = timezone.now()
    await row.save()
    for mc in codes:
        await refresh_mold_status_if_no_open_maintenance_sheet(tenant_id, mc)
