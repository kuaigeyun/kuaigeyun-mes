"""好力 GO — 维保完修单 API。"""

from datetime import datetime
from typing import Annotated, Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._mold_maintenance_mold_status import (
    apply_upkeep_clear_from_inhouse_complete_sheet,
    inhouse_complete_line_clears_total_for_mold,
    refresh_mold_status_after_maintenance_completed,
    unique_mold_codes_from_stored_line_items,
)
from apps.haoligo.api.routes_mold_maintenance_sheet import (
    _resolve_applicant_only,
    _validate_leaf_department,
)
from apps.haoligo.models.mold_maintenance_sheet import HaoligoMoldMaintenanceSheet
from apps.haoligo.api._mold_inhouse_maintenance_access import (
    assert_inhouse_complete_access_for_service_type,
    assert_inhouse_complete_create_access,
    require_inhouse_maintenance_complete_list_access,
)
from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_maintenance_complete import (
    MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULTS,
    MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_SET,
)
from apps.haoligo.constants.mold_sheet_rule_codes import HAOLIGO_MOLD_MAINTENANCE_COMPLETE_SHEET_NO
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.services.mold_upkeep_scheme import build_upkeep_line_storage
from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/molds/maintenance-complete-sheets",
    tags=["App · HaoliGO · 维保完修单"],
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


_COMPLETION_TEXT_MAX = 4000


def _clip_completion_text(v: Optional[str], *, label: str) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    if len(s) > _COMPLETION_TEXT_MAX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label}最多 {_COMPLETION_TEXT_MAX} 字",
        )
    return s


class MoldUpkeepRecordLineIn(BaseModel):
    param_id: int
    record_value: Optional[str] = Field(None, description="保养记录（按方案项填写）")

    @field_validator("record_value", mode="before")
    @classmethod
    def strip_record(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class MoldUpkeepRecordLineOut(BaseModel):
    param_id: int
    param_code: str
    param_name: str
    requirement: Optional[str] = None
    is_required: bool = True
    sort_order: int = 0
    record_value: Optional[str] = None


class MoldCompleteLineIn(BaseModel):
    mold_code: str = Field(max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    repair_reason: Optional[str] = Field(None, max_length=200)
    clear_total_production: Optional[bool] = Field(
        None,
        description="保养完修：是否重置该模具总产量；维修单恒为 false；未传时由接口按业务默认处理。",
    )
    upkeep_content: Optional[str] = Field(None, description="保养完修：该模具保养内容（无绑定方案时必填；有方案时由记录行汇总）")
    upkeep_param_set_id: Optional[int] = Field(
        None,
        description="保养完修：本次使用的保养方案（未绑台账时可由用户选择）",
    )
    upkeep_record_lines: Optional[List[MoldUpkeepRecordLineIn]] = Field(
        None,
        description="保养完修：按保养方案填写的记录行",
    )
    repair_content: Optional[str] = Field(None, description="维修完修：该模具维修内容")
    repair_result: Optional[str] = Field(None, max_length=32, description="维修完修：该模具维修结果")
    attachment_file_uuids: Optional[List[str]] = Field(
        None,
        description="模具图片附件·维护保养后（文件 UUID 列表）",
    )

    @field_validator("mold_code", mode="before")
    @classmethod
    def strip_code(cls, v):
        if v is None:
            raise ValueError("模具代号不能为空")
        s = str(v).strip()
        if not s:
            raise ValueError("模具代号不能为空")
        return s

    @field_validator("mold_name", "repair_reason", "upkeep_content", "repair_content", "repair_result", mode="before")
    @classmethod
    def strip_opt(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("attachment_file_uuids", mode="before")
    @classmethod
    def norm_line_attachments(cls, v):
        if v is None:
            return None
        if not isinstance(v, list):
            return None
        return _norm_uuid_list([str(x) for x in v if x is not None])


class MoldCompleteLineOut(BaseModel):
    mold_code: str
    mold_name: Optional[str] = None
    repair_reason: Optional[str] = None
    clear_total_production: bool = False
    upkeep_content: Optional[str] = None
    upkeep_param_set_id: Optional[int] = None
    upkeep_record_lines: List[MoldUpkeepRecordLineOut] = Field(default_factory=list)
    repair_content: Optional[str] = None
    repair_result: Optional[str] = None
    attachment_file_uuids: List[str] = Field(default_factory=list, description="模具图片·维护保养后")
    source_attachment_file_uuids: List[str] = Field(
        default_factory=list,
        description="对应厂内维保单该行模具图片·维护保养前（只读，用于对比）",
    )


async def _line_dict_for_sheet(
    tenant_id: int,
    line: MoldCompleteLineIn,
    *,
    svc: str,
) -> dict[str, Any]:
    st = (svc or "维修").strip()
    mc = line.mold_code.strip()
    row: dict[str, Any] = {
        "mold_code": mc,
        "mold_name": line.mold_name,
        "repair_reason": line.repair_reason,
    }
    if st == "保养":
        row["clear_total_production"] = True if line.clear_total_production is None else bool(line.clear_total_production)
        record_in = [x.model_dump() for x in (line.upkeep_record_lines or [])]
        set_id = line.upkeep_param_set_id
        upkeep_extra = await build_upkeep_line_storage(
            tenant_id,
            mc,
            upkeep_param_set_id=set_id,
            upkeep_content=line.upkeep_content,
            upkeep_record_lines=record_in,
        )
        row["upkeep_content"] = upkeep_extra["upkeep_content"]
        row["upkeep_record_lines"] = upkeep_extra.get("upkeep_record_lines") or []
        row["upkeep_param_set_id"] = upkeep_extra.get("upkeep_param_set_id")
        row["repair_content"] = None
        row["repair_result"] = None
    elif st == "维修":
        row["clear_total_production"] = False
        rc = _clip_completion_text(line.repair_content, label=f"模具「{mc}」维修内容")
        if not rc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"请填写模具「{mc}」的维修内容",
            )
        rr = (line.repair_result or "").strip()
        if not rr:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"请选择模具「{mc}」的维修结果",
            )
        if rr not in MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_SET:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"模具「{mc}」维修结果无效，须为：{'、'.join(MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULTS)}",
            )
        row["upkeep_content"] = None
        row["upkeep_record_lines"] = []
        row["repair_content"] = rc
        row["repair_result"] = rr
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维保单类型无效")
    row["attachment_file_uuids"] = _norm_uuid_list(line.attachment_file_uuids)
    return row


def _upkeep_record_lines_from_store(raw: Any) -> List[MoldUpkeepRecordLineOut]:
    if not isinstance(raw, list):
        return []
    out: List[MoldUpkeepRecordLineOut] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            pid = int(item.get("param_id"))
        except (TypeError, ValueError):
            continue
        out.append(
            MoldUpkeepRecordLineOut(
                param_id=pid,
                param_code=str(item.get("param_code") or "").strip(),
                param_name=str(item.get("param_name") or "").strip(),
                requirement=_strip_opt(str(item.get("requirement")) if item.get("requirement") is not None else None),
                is_required=bool(item.get("is_required", True)),
                sort_order=int(item.get("sort_order") or 0),
                record_value=_strip_opt(str(item.get("record_value")) if item.get("record_value") is not None else None),
            )
        )
    out.sort(key=lambda x: (x.sort_order, x.param_id))
    return out


def _line_from_store(
    raw: dict[str, Any],
    *,
    sheet_service_type: str,
    sheet_level_clear_fallback: bool,
) -> MoldCompleteLineOut:
    svc = (sheet_service_type or "维修").strip()
    raw_c = raw.get("clear_total_production")
    if svc != "保养":
        clear_b = False
    elif raw_c is None:
        clear_b = bool(sheet_level_clear_fallback)
    else:
        clear_b = bool(raw_c)
    return MoldCompleteLineOut(
        mold_code=str(raw.get("mold_code") or "").strip(),
        mold_name=_strip_opt(str(raw.get("mold_name") or "")),
        repair_reason=_strip_opt(str(raw.get("repair_reason") or "")),
        clear_total_production=clear_b,
        upkeep_content=_strip_opt(str(raw.get("upkeep_content") or "")),
        upkeep_param_set_id=raw.get("upkeep_param_set_id"),
        upkeep_record_lines=_upkeep_record_lines_from_store(raw.get("upkeep_record_lines")),
        repair_content=_strip_opt(str(raw.get("repair_content") or "")),
        repair_result=_strip_opt(str(raw.get("repair_result") or "")),
        attachment_file_uuids=_norm_uuid_list(raw.get("attachment_file_uuids")),
        source_attachment_file_uuids=[],
    )


class MoldMaintenanceCompleteSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    source_maintenance_sheet_id: Optional[int] = None
    source_order_no: str
    applicant_user_id: Optional[int] = None
    applicant_name: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: Optional[str] = None
    service_type: str
    clear_total_production: bool
    header_attachment_file_uuids: List[str] = Field(
        default_factory=list,
        description="附件照片·维护保养后",
    )
    source_header_attachment_file_uuids: List[str] = Field(
        default_factory=list,
        description="来源厂内维保单表头附件·维护保养前（只读，用于对比）",
    )
    line_items: List[MoldCompleteLineOut] = Field(default_factory=list)
    primary_mold_code: Optional[str] = Field(None, description="首行模具代号")
    created_at: datetime


class MoldMaintenanceCompleteSheetCreate(BaseModel):
    """新建完修单须指定厂内维保单；`line_items` 与维保单模具集合一致，每行含完修填写项。"""

    model_config = ConfigDict(extra="ignore")

    source_maintenance_sheet_id: int = Field(ge=1, description="厂内维保单主键")
    applicant_user_id: Optional[int] = Field(None, ge=1, description="缺省从来源维保单带出")
    department_uuid: Optional[str] = Field(None, max_length=36, description="缺省从来源维保单带出；须为末级部门 UUID")
    header_attachment_file_uuids: Optional[List[str]] = Field(
        None,
        description="附件照片·维护保养后",
    )
    line_items: List[MoldCompleteLineIn] = Field(min_length=1, description="与维保单模具一一对应的完修明细")


class MoldMaintenanceCompleteSheetUpdate(BaseModel):
    source_maintenance_sheet_id: Optional[int] = Field(None, ge=1)
    source_order_no: Optional[str] = Field(None, max_length=128)
    applicant_user_id: Optional[int] = Field(None, ge=1)
    department_uuid: Optional[str] = Field(None, max_length=36)
    service_type: Optional[ServiceTypeLiteral] = None
    header_attachment_file_uuids: Optional[List[str]] = Field(
        None,
        description="附件照片·维护保养后",
    )
    line_items: Optional[List[MoldCompleteLineIn]] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _primary_mold(lines: List[MoldCompleteLineOut]) -> Optional[str]:
    if not lines:
        return None
    c = (lines[0].mold_code or "").strip()
    return c or None


async def _serialize(row: HaoligoMoldMaintenanceCompleteSheet) -> MoldMaintenanceCompleteSheetOut:
    raw_lines = row.line_items or []
    lines: List[MoldCompleteLineOut] = []
    svc = str(row.service_type or "维修").strip()
    fb = bool(row.clear_total_production)
    if isinstance(raw_lines, list):
        for item in raw_lines:
            if isinstance(item, dict):
                lines.append(_line_from_store(item, sheet_service_type=svc, sheet_level_clear_fallback=fb))
    if svc != "保养":
        agg_clear = False
    elif lines:
        agg_clear = any(li.clear_total_production for li in lines)
    else:
        agg_clear = fb

    src_header: List[str] = []
    src_by_mold: dict[str, List[str]] = {}
    sid = row.source_maintenance_sheet_id
    tid = getattr(row, "tenant_id", None)
    if sid and tid is not None:
        src_row = await HaoligoMoldMaintenanceSheet.filter(
            id=sid,
            tenant_id=tid,
            deleted_at__isnull=True,
        ).first()
        if src_row:
            src_header = _norm_uuid_list(list(src_row.header_attachment_file_uuids or []))
            src_raw = src_row.line_items or []
            if isinstance(src_raw, list):
                for it in src_raw:
                    if not isinstance(it, dict):
                        continue
                    mc = str(it.get("mold_code") or "").strip()
                    if mc:
                        src_by_mold[mc] = _norm_uuid_list(it.get("attachment_file_uuids"))

    enriched_lines: List[MoldCompleteLineOut] = []
    for li in lines:
        mc = (li.mold_code or "").strip()
        enriched_lines.append(
            li.model_copy(
                update={"source_attachment_file_uuids": list(src_by_mold.get(mc, []))},
            )
        )

    return MoldMaintenanceCompleteSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        source_maintenance_sheet_id=row.source_maintenance_sheet_id,
        source_order_no=row.source_order_no,
        applicant_user_id=getattr(row, "applicant_user_id", None),
        applicant_name=_strip_opt(getattr(row, "applicant_name", None)),
        department_uuid=_strip_opt(getattr(row, "department_uuid", None)),
        department_name=_strip_opt(getattr(row, "department_name", None)),
        service_type=row.service_type,
        clear_total_production=agg_clear,
        header_attachment_file_uuids=list(row.header_attachment_file_uuids or []),
        source_header_attachment_file_uuids=src_header,
        line_items=enriched_lines,
        primary_mold_code=_primary_mold(enriched_lines),
        created_at=row.created_at,
    )


@router.get("", summary="维保完修单分页列表")
async def list_maintenance_complete_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[AuthContext, Depends(require_inhouse_maintenance_complete_list_access())],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None, description="维修 / 保养"),
    created_from: Optional[datetime] = Query(None, description="创建时间起（含）"),
    created_to: Optional[datetime] = Query(None, description="创建时间止（含）"),
):
    qs = tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(source_order_no__icontains=k)
            | Q(sheet_no__icontains=k)
            | Q(service_type__icontains=k)
            | Q(applicant_name__icontains=k)
            | Q(department_name__icontains=k)
        )
    if service_type and str(service_type).strip() in ("维修", "保养"):
        qs = qs.filter(service_type=str(service_type).strip())
    if created_from is not None:
        qs = qs.filter(created_at__gte=created_from)
    if created_to is not None:
        qs = qs.filter(created_at__lte=created_to)
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items = [await _serialize(r) for r in rows]
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=MoldMaintenanceCompleteSheetOut, summary="创建维保完修单")
async def create_maintenance_complete_sheet(
    body: MoldMaintenanceCompleteSheetCreate,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    src = await tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(id=body.source_maintenance_sheet_id).first()
    if not src:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维保单不存在")
    if await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id).filter(
        source_maintenance_sheet_id=src.id,
        deleted_at__isnull=True,
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该维保单已存在维保完修单，不可重复确认")
    raw_lines = src.line_items or []
    if not isinstance(raw_lines, list) or not raw_lines:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维保单明细为空，无法确认完修")
    svc = str(src.service_type or "维修").strip()
    if svc not in ("维修", "保养"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维保单类型无效")
    await assert_inhouse_complete_create_access(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=svc,
    )
    src_lines = [x for x in raw_lines if isinstance(x, dict)]
    src_codes = [str(x.get("mold_code") or "").strip() for x in src_lines]
    src_codes = [c for c in src_codes if c]
    if not src_codes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维保单无有效模具明细")
    src_set = set(src_codes)
    if len(src_set) != len(src_codes):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维保单存在重复模具代号")
    by_client: dict[str, MoldCompleteLineIn] = {}
    for ln in body.line_items:
        mc = ln.mold_code.strip()
        if mc in by_client:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"完修明细中模具「{mc}」重复")
        by_client[mc] = ln
    if set(by_client.keys()) != src_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="完修明细模具须与维保单明细一致（相同模具代号集合）",
        )
    stored: list[dict[str, Any]] = []
    for src_item in src_lines:
        mc = str(src_item.get("mold_code") or "").strip()
        if not mc:
            continue
        cli = by_client.get(mc)
        if cli is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"缺少模具「{mc}」的完修明细")
        src_wo_line_att = {k: v for k, v in src_item.items() if k != "attachment_file_uuids"}
        merged = {**src_wo_line_att, **cli.model_dump(exclude_unset=True)}
        try:
            ln = MoldCompleteLineIn.model_validate(merged)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        stored.append(await _line_dict_for_sheet(tenant_id, ln, svc=svc))
    if not stored:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="维保单无有效模具明细")
    sheet_clear_flag = svc == "保养" and any(bool(x.get("clear_total_production")) for x in stored)
    src_no = (str(src.source_order_no or "").strip() or str(src.sheet_no or "").strip() or f"维保单#{src.id}")
    applicant_id = body.applicant_user_id if body.applicant_user_id is not None else getattr(src, "applicant_user_id", None)
    if not applicant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写申请人")
    dept_raw = body.department_uuid if body.department_uuid is not None else getattr(src, "department_uuid", None)
    dept_uu = _strip_opt(str(dept_raw) if dept_raw is not None else None)
    if not dept_uu:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择申请部门")
    applicant_user_id_resolved, applicant_name = await _resolve_applicant_only(tenant_id, int(applicant_id))
    department_uuid_resolved, department_name = await _validate_leaf_department(tenant_id, dept_uu)
    async with in_transaction():
        try:
            sheet_no = await generate_mold_sheet_no(tenant_id, HAOLIGO_MOLD_MAINTENANCE_COMPLETE_SHEET_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoMoldMaintenanceCompleteSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            source_maintenance_sheet_id=src.id,
            source_order_no=src_no,
            applicant_user_id=applicant_user_id_resolved,
            applicant_name=applicant_name,
            department_uuid=department_uuid_resolved,
            department_name=department_name,
            service_type=svc,
            clear_total_production=sheet_clear_flag,
            header_attachment_file_uuids=[],
            line_items=stored,
        )
        for mc in unique_mold_codes_from_stored_line_items(stored):
            await refresh_mold_status_after_maintenance_completed(tenant_id, mc)
        await apply_upkeep_clear_from_inhouse_complete_sheet(tenant_id, row)
    from apps.haoligo.services.mold_maintenance_complete_sheet_side_effects import (
        send_mold_maintenance_complete_created_messages,
    )

    await send_mold_maintenance_complete_created_messages(tenant_id, row)
    return await _serialize(row)


@router.get("/{row_id}", response_model=MoldMaintenanceCompleteSheetOut, summary="维保完修单详情")
async def get_maintenance_complete_sheet(
    row_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    row = await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_inhouse_complete_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=row.service_type,
    )
    return await _serialize(row)


@router.patch("/{row_id}", response_model=MoldMaintenanceCompleteSheetOut, summary="更新维保完修单")
async def update_maintenance_complete_sheet(
    row_id: int,
    body: MoldMaintenanceCompleteSheetUpdate,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    row = await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_inhouse_complete_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=row.service_type,
    )
    data = body.model_dump(exclude_unset=True)
    if "service_type" in data and str(data.get("service_type") or "").strip() != str(row.service_type or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不可变更维修/保养类型")
    if "source_order_no" in data and data["source_order_no"] is not None:
        s = str(data["source_order_no"]).strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="来源单号不能为空")
        data["source_order_no"] = s
    if "header_attachment_file_uuids" in data:
        data["header_attachment_file_uuids"] = []
    if "line_items" in data and data["line_items"] is not None:
        lines = [MoldCompleteLineIn.model_validate(x) for x in data["line_items"]]
        if not lines:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="至少保留一条模具信息")
        eff_type = str(data.get("service_type") or row.service_type or "维修").strip()
        stored_lines: list[dict[str, Any]] = []
        for x in lines:
            stored_lines.append(await _line_dict_for_sheet(tenant_id, x, svc=eff_type))
        data["line_items"] = stored_lines
        data["clear_total_production"] = eff_type == "保养" and any(
            bool(x.get("clear_total_production")) for x in stored_lines
        )
    elif "service_type" in data and data["service_type"] == "维修":
        li = row.line_items or []
        if isinstance(li, list) and li:
            coerced = []
            for it in li:
                if isinstance(it, dict):
                    d = dict(it)
                    d["clear_total_production"] = False
                    coerced.append(d)
                else:
                    coerced.append(it)
            data["line_items"] = coerced
            data["clear_total_production"] = False
    if "applicant_user_id" in data:
        aid = data.pop("applicant_user_id")
        if aid is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="申请人不能为空")
        aid2, aname = await _resolve_applicant_only(tenant_id, int(aid))
        data["applicant_user_id"] = aid2
        data["applicant_name"] = aname
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
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    for mc in codes:
        await refresh_mold_status_after_maintenance_completed(tenant_id, mc)
    await apply_upkeep_clear_from_inhouse_complete_sheet(tenant_id, row)
    return await _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除维保完修单")
async def delete_maintenance_complete_sheet(
    row_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    row = await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_inhouse_complete_access_for_service_type(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        service_type=row.service_type,
    )
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    row.deleted_at = timezone.now()
    await row.save()
    for mc in codes:
        await refresh_mold_status_after_maintenance_completed(tenant_id, mc)
