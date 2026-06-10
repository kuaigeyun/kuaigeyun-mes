"""好力 GO — 外协维保单 API。"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api._source_sheet_delete_guard import assert_no_active_child_sheet_by_fk
from apps.haoligo.api.routes_mold_maintenance_sheet import (
    _resolve_applicant_only,
    _validate_leaf_department,
    assert_maintenance_line_molds_are_standby,
)
from apps.haoligo.constants.mold_sheet_rule_codes import HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_SHEET_NO
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
from apps.haoligo.api._data_scope import (
    RESOURCE_OUTSOURCE_MAINTENANCE,
    apply_outsource_sheet_scope,
    assert_outsource_partner_code_writable,
    assert_outsource_row_visible,
)
from apps.haoligo.services.outsource_maintenance_sheet_side_effects import (
    send_outsource_maintenance_approved_messages,
    send_outsource_maintenance_pending_messages,
    send_outsource_maintenance_rejected_messages,
    send_outsource_maintenance_revoked_messages,
)
from apps.haoligo.services.spot_check_side_effects import normalize_report_user_ids
from apps.haoligo.services.outsource_sheet_warehouse import (
    apply_warehouses_on_outsource_maintenance_approved,
    format_mold_warehouse_label,
    mold_warehouse_snapshot_by_codes,
    resolve_maintenance_line_warehouse_fields,
)
from apps.master_data.models.supplier import Supplier
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/molds/outsource-maintenance-sheets",
    tags=["App · HaoliGO · 外协维保单"],
    dependencies=[Depends(require_haoligo_module_access("molds-documents-outsource-maintenance"))],
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


class OutsourceMaintLineIn(BaseModel):
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


class OutsourceMaintLineOut(BaseModel):
    mold_code: str
    mold_name: Optional[str] = None
    repair_reason: str
    repair_cost: Optional[Decimal] = None
    attachment_file_uuids: List[str] = Field(default_factory=list)
    mold_warehouse_id: Optional[int] = Field(None, description="模具台账所在仓库 ID")
    mold_warehouse_code: Optional[str] = Field(None, description="所在仓库编码")
    mold_warehouse_name: Optional[str] = Field(None, description="所在仓库名称")
    before_outsource_warehouse_id: Optional[int] = Field(
        None,
        description="外协审核通过前厂内仓库 ID（完修归还用）",
    )


def _line_to_store(line: OutsourceMaintLineIn) -> dict[str, Any]:
    return {
        "mold_code": line.mold_code.strip(),
        "mold_name": line.mold_name,
        "repair_reason": line.repair_reason.strip(),
        "repair_cost": str(line.repair_cost) if line.repair_cost is not None else None,
        "attachment_file_uuids": _norm_uuid_list(line.attachment_file_uuids),
    }


def _line_from_store(raw: dict[str, Any]) -> OutsourceMaintLineOut:
    cost_raw = raw.get("repair_cost")
    rc: Optional[Decimal] = None
    if cost_raw is not None and cost_raw != "":
        try:
            rc = Decimal(str(cost_raw))
        except Exception:  # noqa: BLE001
            rc = None
    return OutsourceMaintLineOut(
        mold_code=str(raw.get("mold_code") or "").strip(),
        mold_name=_strip_opt(str(raw.get("mold_name") or "")),
        repair_reason=str(raw.get("repair_reason") or "").strip(),
        repair_cost=rc,
        attachment_file_uuids=_norm_uuid_list(raw.get("attachment_file_uuids")),
    )


class MoldOutsourceMaintenanceSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    applicant_user_id: Optional[int] = None
    applicant_name: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: Optional[str] = None
    outsourced_unit_code: Optional[str] = None
    outsourced_unit_name: str
    service_type: str
    source_order_no: Optional[str] = None
    header_attachment_file_uuids: List[str] = Field(default_factory=list)
    line_items: List[OutsourceMaintLineOut] = Field(default_factory=list)
    primary_mold_code: Optional[str] = Field(None, description="列表摘要：首行模具代号")
    primary_mold_warehouse_name: Optional[str] = Field(
        None,
        description="列表摘要：首行模具所在仓库",
    )
    created_at: datetime
    sheet_status: str = Field(description="审核状态：待审核/已通过/已驳回")
    audited_at: Optional[datetime] = None
    audited_by_user_id: Optional[int] = None
    submitted_notify_user_ids: List[int] = Field(default_factory=list)
    can_complete: bool = Field(
        False,
        description="是否可发起完修：维修类且尚无未驳回的关联完修单",
    )


class MoldOutsourceMaintenanceSheetCreate(BaseModel):
    outsourced_unit_code: Optional[str] = Field(None, max_length=64)
    outsourced_unit_name: str = Field(max_length=200)
    applicant_user_id: int = Field(description="申请人用户 ID")
    department_uuid: str = Field(max_length=36, description="申请部门 UUID（须为末级部门）")
    service_type: ServiceTypeLiteral
    source_order_no: Optional[str] = Field(None, max_length=128)
    header_attachment_file_uuids: Optional[List[str]] = None
    submitted_notify_user_ids: Optional[List[int]] = None
    line_items: List[OutsourceMaintLineIn] = Field(min_length=1)

    @field_validator("outsourced_unit_name", mode="before")
    @classmethod
    def strip_unit_name(cls, v):
        if v is None:
            raise ValueError("外协单位不能为空")
        s = str(v).strip()
        if not s:
            raise ValueError("外协单位不能为空")
        return s

    @field_validator("department_uuid", mode="before")
    @classmethod
    def strip_dept_uuid(cls, v):
        if v is None:
            raise ValueError("请选择申请部门")
        s = str(v).strip()
        if not s:
            raise ValueError("请选择申请部门")
        return s


class MoldOutsourceMaintenanceSheetUpdate(BaseModel):
    outsourced_unit_code: Optional[str] = Field(None, max_length=64)
    outsourced_unit_name: Optional[str] = Field(None, max_length=200)
    applicant_user_id: Optional[int] = None
    department_uuid: Optional[str] = Field(None, max_length=36)
    department_name: Optional[str] = Field(None, max_length=200)
    service_type: Optional[ServiceTypeLiteral] = None
    source_order_no: Optional[str] = Field(None, max_length=128)
    header_attachment_file_uuids: Optional[List[str]] = None
    submitted_notify_user_ids: Optional[List[int]] = None
    line_items: Optional[List[OutsourceMaintLineIn]] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _primary_mold(lines: List[OutsourceMaintLineOut]) -> Optional[str]:
    if not lines:
        return None
    c = (lines[0].mold_code or "").strip()
    return c or None


async def _linked_maintenance_ids_with_active_complete(tenant_id: int) -> set[int]:
    linked_ids = (
        await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id)
        .filter(
            deleted_at__isnull=True,
            source_outsource_maintenance_sheet_id__not_isnull=True,
        )
        .exclude(sheet_status="已驳回")
        .values_list("source_outsource_maintenance_sheet_id", flat=True)
    )
    return {int(x) for x in linked_ids if x is not None}


def _row_can_complete(row: HaoligoMoldOutsourceMaintenanceSheet, *, linked_ids: set[int]) -> bool:
    if effective_sheet_status(row) != SHEET_STATUS_APPROVED:
        return False
    if (row.service_type or "").strip() != "维修":
        return False
    return int(row.id) not in linked_ids


async def _serialize(
    row: HaoligoMoldOutsourceMaintenanceSheet,
    *,
    tenant_id: int,
    linked_complete_ids: set[int] | None = None,
) -> MoldOutsourceMaintenanceSheetOut:
    raw_lines = row.line_items or []
    lines: List[OutsourceMaintLineOut] = []
    raw_dicts: List[dict[str, Any]] = []
    if isinstance(raw_lines, list):
        for item in raw_lines:
            if isinstance(item, dict):
                raw_dicts.append(item)
                lines.append(_line_from_store(item))
    codes = [(ln.mold_code or "").strip() for ln in lines if (ln.mold_code or "").strip()]
    snapshots = await mold_warehouse_snapshot_by_codes(tenant_id, codes)
    is_closed = int(row.id) in (linked_complete_ids or set())
    is_approved = effective_sheet_status(row) == SHEET_STATUS_APPROVED
    enriched: List[OutsourceMaintLineOut] = []
    for ln, raw in zip(lines, raw_dicts):
        snap = snapshots.get((ln.mold_code or "").strip(), {})
        wh_fields = await resolve_maintenance_line_warehouse_fields(
            tenant_id,
            raw,
            snap,
            is_closed=is_closed,
            is_approved=is_approved,
            outsourced_unit_name=row.outsourced_unit_name or "",
            outsourced_unit_code=row.outsourced_unit_code,
        )
        enriched.append(ln.model_copy(update=wh_fields))
    lines = enriched
    primary_wh: Optional[str] = None
    if lines:
        primary_wh = format_mold_warehouse_label(
            warehouse_name=lines[0].mold_warehouse_name,
            warehouse_code=lines[0].mold_warehouse_code,
        )
    linked = linked_complete_ids or set()
    return MoldOutsourceMaintenanceSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        applicant_user_id=row.applicant_user_id,
        applicant_name=row.applicant_name,
        department_uuid=row.department_uuid,
        department_name=row.department_name,
        outsourced_unit_code=row.outsourced_unit_code,
        outsourced_unit_name=row.outsourced_unit_name,
        service_type=row.service_type,
        source_order_no=row.source_order_no,
        header_attachment_file_uuids=list(row.header_attachment_file_uuids or []),
        line_items=lines,
        primary_mold_code=_primary_mold(lines),
        primary_mold_warehouse_name=primary_wh,
        sheet_status=effective_sheet_status(row),
        audited_at=getattr(row, "audited_at", None),
        audited_by_user_id=getattr(row, "audited_by_user_id", None),
        submitted_notify_user_ids=normalize_report_user_ids(getattr(row, "submitted_notify_user_ids", None)),
        created_at=row.created_at,
        can_complete=_row_can_complete(row, linked_ids=linked),
    )


@router.get("", summary="外协维保单分页列表")
async def list_outsource_maintenance_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    sheet_status: Optional[str] = Query(None, description="待审核 / 已通过 / 已驳回"),
    open_for_complete: bool = Query(
        False,
        description="为 true 时仅返回尚未关联未删除外协维保完修单的外协维保单（用于完修单选源）",
    ),
):
    linked_complete_ids = await _linked_maintenance_ids_with_active_complete(tenant_id)
    qs = tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id)
    st = (sheet_status or "").strip()
    if st and st in SHEET_AUDIT_STATUS_SET:
        qs = qs.filter(sheet_status=st)
    if open_for_complete:
        qs = qs.filter(sheet_status=SHEET_STATUS_APPROVED)
    if open_for_complete and linked_complete_ids:
        qs = qs.filter(~Q(id__in=list(linked_complete_ids)))
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(outsourced_unit_name__icontains=k)
            | Q(outsourced_unit_code__icontains=k)
            | Q(department_name__icontains=k)
            | Q(applicant_name__icontains=k)
            | Q(sheet_no__icontains=k)
            | Q(source_order_no__icontains=k)
            | Q(service_type__icontains=k)
        )
    qs = await apply_outsource_sheet_scope(
        qs, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_MAINTENANCE
    )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    return {
        "items": [
            await _serialize(r, tenant_id=tenant_id, linked_complete_ids=linked_complete_ids)
            for r in rows
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


class OutsourceSupplierOptionOut(BaseModel):
    """外协单位下拉项（主数据启用供应商；不做采购员 buyer 隔离）。"""

    uuid: str
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)


@router.get(
    "/supplier-options",
    response_model=List[OutsourceSupplierOptionOut],
    summary="外协单位下拉（启用供应商）",
)
async def list_outsource_supplier_options(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    limit: int = Query(1000, ge=1, le=2000),
):
    rows = (
        await Supplier.filter(
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True,
        )
        .order_by("code")
        .limit(limit)
        .all()
    )
    return [
        OutsourceSupplierOptionOut(
            uuid=r.uuid,
            code=(r.code or "").strip(),
            name=(r.name or "").strip(),
        )
        for r in rows
        if (r.name or "").strip()
    ]


@router.post("", response_model=MoldOutsourceMaintenanceSheetOut, summary="创建外协维保单")
async def create_outsource_maintenance_sheet(
    body: MoldOutsourceMaintenanceSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    await assert_outsource_partner_code_writable(
        tenant_id=tenant_id,
        user=user,
        resource=RESOURCE_OUTSOURCE_MAINTENANCE,
        partner_code=body.outsourced_unit_code,
    )
    stored = [_line_to_store(x) for x in body.line_items]
    await assert_maintenance_line_molds_are_standby(tenant_id, stored)
    app_uid, app_name = await _resolve_applicant_only(tenant_id, body.applicant_user_id)
    dept_uuid, dept_name = await _validate_leaf_department(tenant_id, body.department_uuid)
    async with in_transaction():
        try:
            sheet_no = await generate_mold_sheet_no(tenant_id, HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_SHEET_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoMoldOutsourceMaintenanceSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            applicant_user_id=app_uid,
            applicant_name=app_name,
            department_uuid=dept_uuid,
            department_name=dept_name,
            outsourced_unit_code=_strip_opt(body.outsourced_unit_code),
            outsourced_unit_name=body.outsourced_unit_name.strip(),
            service_type=body.service_type,
            source_order_no=_strip_opt(body.source_order_no),
            header_attachment_file_uuids=_norm_uuid_list(body.header_attachment_file_uuids),
            submitted_notify_user_ids=normalize_report_user_ids(body.submitted_notify_user_ids),
            line_items=stored,
            sheet_status=SHEET_STATUS_PENDING,
        )
    await send_outsource_maintenance_pending_messages(tenant_id, row)
    return await _serialize(row, tenant_id=tenant_id)


@router.get("/{row_id}", response_model=MoldOutsourceMaintenanceSheetOut, summary="外协维保单详情")
async def get_outsource_maintenance_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_MAINTENANCE
    )
    return await _serialize(row, tenant_id=tenant_id)


@router.patch("/{row_id}", response_model=MoldOutsourceMaintenanceSheetOut, summary="更新外协维保单")
async def update_outsource_maintenance_sheet(
    row_id: int,
    body: MoldOutsourceMaintenanceSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_MAINTENANCE
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
    if "outsourced_unit_name" in data and data["outsourced_unit_name"] is not None:
        s = str(data["outsourced_unit_name"]).strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协单位不能为空")
        data["outsourced_unit_name"] = s
    if "outsourced_unit_code" in data or "outsourced_unit_name" in data:
        code_for_scope = data.get("outsourced_unit_code", row.outsourced_unit_code)
        await assert_outsource_partner_code_writable(
            tenant_id=tenant_id,
            user=user,
            resource=RESOURCE_OUTSOURCE_MAINTENANCE,
            partner_code=code_for_scope,
        )
    for k in ("outsourced_unit_code", "source_order_no"):
        if k in data and data[k] is not None:
            data[k] = _strip_opt(str(data[k]))
    if "header_attachment_file_uuids" in data:
        data["header_attachment_file_uuids"] = _norm_uuid_list(data["header_attachment_file_uuids"])
    if "submitted_notify_user_ids" in data and data["submitted_notify_user_ids"] is not None:
        data["submitted_notify_user_ids"] = normalize_report_user_ids(data["submitted_notify_user_ids"])
    if "line_items" in data and data["line_items"] is not None:
        lines = [OutsourceMaintLineIn.model_validate(x) for x in data["line_items"]]
        if not lines:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="至少保留一条模具明细")
        stored = [_line_to_store(x) for x in lines]
        prev_codes = set(unique_mold_codes_from_stored_line_items(row.line_items or []))
        await assert_maintenance_line_molds_are_standby(tenant_id, stored, allow_mold_codes=prev_codes)
        data["line_items"] = stored
    resubmit_from_rejected = effective_sheet_status(row) == SHEET_STATUS_REJECTED
    apply_rejected_resubmit_fields(data, row)
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    if resubmit_from_rejected:
        await send_outsource_maintenance_pending_messages(tenant_id, row)
    return await _serialize(row, tenant_id=tenant_id)


@router.post("/{row_id}/approve", response_model=MoldOutsourceMaintenanceSheetOut, summary="审核通过外协维保单")
async def approve_outsource_maintenance_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    preview = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not preview:
        await _not_found()
    await assert_outsource_row_visible(
        preview, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_MAINTENANCE
    )
    async with in_transaction():
        row = await load_sheet_row_for_audit(HaoligoMoldOutsourceMaintenanceSheet, tenant_id, row_id)
        assert_pending_for_audit(row)
        row.sheet_status = SHEET_STATUS_APPROVED
        row.audited_at = timezone.now()
        row.audited_by_user_id = user.id
        await row.save()
        await apply_warehouses_on_outsource_maintenance_approved(tenant_id, row)
        await apply_mold_status_on_maintenance_sheet_created(
            tenant_id,
            is_outsource=True,
            service_type=row.service_type,
            stored_line_items=row.line_items or [],
        )
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await send_outsource_maintenance_approved_messages(tenant_id, row)
    return await _serialize(row, tenant_id=tenant_id)


@router.post("/{row_id}/reject", response_model=MoldOutsourceMaintenanceSheetOut, summary="审核驳回外协维保单")
async def reject_outsource_maintenance_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_MAINTENANCE
    )
    assert_pending_for_audit(row)
    row.sheet_status = SHEET_STATUS_REJECTED
    row.audited_at = timezone.now()
    row.audited_by_user_id = user.id
    await row.save()
    await send_outsource_maintenance_rejected_messages(tenant_id, row)
    return await _serialize(row, tenant_id=tenant_id)


@router.post(
    "/{row_id}/revoke-approval",
    response_model=MoldOutsourceMaintenanceSheetOut,
    summary="撤销外协维保单审核（已通过→待审核）",
)
async def revoke_outsource_maintenance_sheet_approval(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_MAINTENANCE
    )
    assert_approved_for_revoke(row)
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    row.sheet_status = SHEET_STATUS_PENDING
    row.audited_at = None
    row.audited_by_user_id = None
    await row.save()
    for mc in codes:
        await refresh_mold_status_if_no_open_maintenance_sheet(tenant_id, mc)
    await send_outsource_maintenance_revoked_messages(tenant_id, row)
    return await _serialize(row, tenant_id=tenant_id)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除外协维保单")
async def delete_outsource_maintenance_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_MAINTENANCE
    )
    assert_sheet_mutation_allowed(row)
    await assert_no_active_child_sheet_by_fk(
        tenant_id,
        child_model=HaoligoMoldOutsourceMaintenanceCompleteSheet,
        source_fk_field="source_outsource_maintenance_sheet_id",
        source_id=row_id,
        source_doc_label="外协维保单",
        child_doc_label="外协维保完修单",
    )
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    row.deleted_at = timezone.now()
    await row.save()
    for mc in codes:
        await refresh_mold_status_if_no_open_maintenance_sheet(tenant_id, mc)
