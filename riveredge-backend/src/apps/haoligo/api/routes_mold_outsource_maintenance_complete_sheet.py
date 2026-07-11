"""好力 GO — 外协维保完修单 API（外协维保单仅维修；行为对齐厂内维保完修单）。"""

from datetime import datetime
from decimal import Decimal
import re
from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._creator import resolve_creator_name
from apps.haoligo.api._mold_sheet_keyword import (
    apply_mold_line_items_sheet_keyword_filter,
    outsource_complete_header_keyword_q,
)
from apps.haoligo.api._mold_maintenance_mold_status import (
    apply_upkeep_clear_from_outsource_complete_sheet_on_approve,
    refresh_mold_status_after_maintenance_completed,
    unique_mold_codes_from_stored_line_items,
)
from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api.routes_mold_maintenance_sheet import (
    _resolve_applicant_only,
    _validate_leaf_department,
)
from apps.haoligo.constants.mold_maintenance_complete import (
    MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULTS,
    MOLD_MAINTENANCE_COMPLETE_REPAIR_RESULT_SET,
)
from apps.haoligo.constants.mold_sheet_rule_codes import HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_NO
from apps.haoligo.constants.outsource_maintenance_complete import (
    OUTSOURCE_MAINTENANCE_COMPLETE_APPROVED_STATUS,
    OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_STATUS_SET,
)
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
from apps.haoligo.services.spot_check_side_effects import normalize_report_user_ids
from apps.haoligo.api._data_scope import (
    RESOURCE_OUTSOURCE_COMPLETE,
    RESOURCE_OUTSOURCE_MAINTENANCE,
    apply_outsource_sheet_scope,
    assert_outsource_row_visible,
)
from apps.haoligo.services.outsource_sheet_warehouse import (
    apply_warehouses_on_outsource_complete_approved,
    backfill_before_outsource_on_source_lines,
    format_mold_warehouse_label,
    mold_warehouse_snapshot_by_codes,
    resolve_complete_line_warehouse_fields,
    resolve_outsource_unit_fields,
    resolve_return_warehouse_id_for_complete_line,
    warehouse_snapshot_by_id,
)
from apps.haoligo.api._mold_sheet_audit import (
    assert_pending_for_audit as assert_pending_for_sheet_audit,
    load_sheet_row_for_audit,
)
from apps.haoligo.api._mold_sheet_audit import assert_approved_for_revoke as assert_approved_for_sheet_revoke
from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED, SHEET_STATUS_PENDING
from apps.haoligo.authorization.workflow_permissions import OUTSOURCE_COMPLETE_CREATE_PERMISSIONS
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from core.models.file import File as CoreFile
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/molds/outsource-maintenance-complete-sheets",
    tags=["App · HaoliGO · 外协维保完修单"],
    dependencies=[
        Depends(
            require_haoligo_module_access(
                "molds-documents-outsource-complete",
                collection_create_permissions=OUTSOURCE_COMPLETE_CREATE_PERMISSIONS,
            )
        )
    ],
)

_COMPLETION_TEXT_MAX = 4000
_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
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


class OutsourceCompleteLineIn(BaseModel):
    mold_code: str = Field(max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    repair_reason: Optional[str] = Field(None, max_length=500)
    repair_content: Optional[str] = Field(None, description="维修完修：该模具维修内容")
    repair_result: Optional[str] = Field(None, max_length=32, description="维修完修：该模具维修结果")
    repair_cost: Optional[Decimal] = None
    attachment_file_uuids: Optional[List[str]] = Field(
        None,
        description="模具图片附件·维修后（文件 UUID 列表）",
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

    @field_validator("mold_name", "repair_reason", "repair_content", "repair_result", mode="before")
    @classmethod
    def strip_opt_fields(cls, v):
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


class OutsourceCompleteLineOut(BaseModel):
    mold_code: str
    mold_name: Optional[str] = None
    repair_reason: Optional[str] = None
    repair_content: Optional[str] = None
    repair_result: Optional[str] = None
    repair_cost: Optional[Decimal] = None
    attachment_file_uuids: List[str] = Field(default_factory=list)
    source_attachment_file_uuids: List[str] = Field(
        default_factory=list,
        description="来源外协维保单该行模具图片·维修前（只读，用于对比）",
    )
    mold_warehouse_id: Optional[int] = Field(None, description="模具台账所在仓库 ID")
    mold_warehouse_code: Optional[str] = Field(None, description="所在仓库编码")
    mold_warehouse_name: Optional[str] = Field(None, description="所在仓库名称")
    return_before_outsource_warehouse_id: Optional[int] = Field(
        None,
        description="完修归还厂内仓库 ID（来自关联外协维保单 before_outsource_warehouse_id）",
    )
    return_before_outsource_warehouse_code: Optional[str] = Field(None, description="完修归还厂内仓库编码")
    return_before_outsource_warehouse_name: Optional[str] = Field(None, description="完修归还厂内仓库名称")


def _line_dict_for_sheet(line: OutsourceCompleteLineIn) -> dict[str, Any]:
    mc = line.mold_code.strip()
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
    cost_raw = line.repair_cost
    return {
        "mold_code": mc,
        "mold_name": line.mold_name,
        "repair_reason": line.repair_reason,
        "repair_content": rc,
        "repair_result": rr,
        "repair_cost": str(cost_raw) if cost_raw is not None else None,
        "attachment_file_uuids": _norm_uuid_list(line.attachment_file_uuids),
    }


def _line_from_store(raw: dict[str, Any]) -> OutsourceCompleteLineOut:
    cost_raw = raw.get("repair_cost")
    rc: Optional[Decimal] = None
    if cost_raw is not None and cost_raw != "":
        try:
            rc = Decimal(str(cost_raw))
        except Exception:  # noqa: BLE001
            rc = None
    return OutsourceCompleteLineOut(
        mold_code=str(raw.get("mold_code") or "").strip(),
        mold_name=_strip_opt(str(raw.get("mold_name") or "")),
        repair_reason=_strip_opt(str(raw.get("repair_reason") or "")),
        repair_content=_strip_opt(str(raw.get("repair_content") or "")),
        repair_result=_strip_opt(str(raw.get("repair_result") or "")),
        repair_cost=rc,
        attachment_file_uuids=_norm_uuid_list(raw.get("attachment_file_uuids")),
        source_attachment_file_uuids=[],
    )


class MoldOutsourceMaintenanceCompleteSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    source_outsource_maintenance_sheet_id: Optional[int] = None
    source_order_no: str
    applicant_user_id: Optional[int] = None
    applicant_name: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: Optional[str] = None
    outsourced_unit_code: Optional[str] = None
    outsourced_unit_name: str
    service_type: str
    clear_total_production: bool
    header_attachment_file_uuids: List[str] = Field(
        default_factory=list,
        description="附件照片·维修后",
    )
    source_header_attachment_file_uuids: List[str] = Field(
        default_factory=list,
        description="来源外协维保单表头附件·维修前（只读，用于对比）",
    )
    line_items: List[OutsourceCompleteLineOut] = Field(default_factory=list)
    primary_mold_code: Optional[str] = Field(None, description="首行模具代号")
    primary_mold_warehouse_name: Optional[str] = Field(
        None,
        description="列表摘要：首行模具所在仓库",
    )
    sheet_status: str = Field(description="审核状态：待审核/已通过/已驳回")
    audited_at: Optional[Any] = None
    audited_by_user_id: Optional[int] = None
    complete_notify_user_ids: List[int] = Field(default_factory=list)
    created_at: datetime
    creator_name: Optional[str] = None


def _effective_sheet_status(row: HaoligoMoldOutsourceMaintenanceCompleteSheet) -> str:
    raw = (getattr(row, "sheet_status", None) or "").strip()
    return raw if raw in OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_STATUS_SET else OUTSOURCE_MAINTENANCE_COMPLETE_APPROVED_STATUS


def _guard_mutation_allowed(row: HaoligoMoldOutsourceMaintenanceCompleteSheet) -> None:
    if _effective_sheet_status(row) == OUTSOURCE_MAINTENANCE_COMPLETE_APPROVED_STATUS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已通过审核的外协维保完修单不可修改或删除",
        )


class MoldOutsourceMaintenanceCompleteSheetCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    source_outsource_maintenance_sheet_id: int = Field(ge=1, description="外协维保单主键")
    applicant_user_id: Optional[int] = Field(None, ge=1, description="缺省从来源外协维保单带出")
    department_uuid: Optional[str] = Field(None, max_length=36, description="缺省从来源外协维保单带出；须为末级部门 UUID")
    header_attachment_file_uuids: Optional[List[str]] = Field(
        None,
        description="附件照片·维修后",
    )
    line_items: List[OutsourceCompleteLineIn] = Field(min_length=1, description="与外协维保单模具一一对应的完修明细")
    complete_notify_user_ids: Optional[List[int]] = None


class OutsourceCompleteReturnWarehouseOverride(BaseModel):
    """审核时手动指定某模具的归还厂内仓库（仅当无法自动推断发出前仓库时使用）。"""

    mold_code: str = Field(max_length=64)
    warehouse_id: int = Field(ge=1, description="归还的内部模具仓库 ID")

    @field_validator("mold_code", mode="before")
    @classmethod
    def _strip_code(cls, v):
        s = str(v or "").strip()
        if not s:
            raise ValueError("模具代号不能为空")
        return s


class OutsourceCompleteApproveIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    return_warehouse_overrides: Optional[List[OutsourceCompleteReturnWarehouseOverride]] = Field(
        None,
        description="审核时手动指定的归还厂内仓库（mold_code → warehouse_id），仅在自动推断失败时生效",
    )


class MoldOutsourceMaintenanceCompleteSheetUpdate(BaseModel):
    source_outsource_maintenance_sheet_id: Optional[int] = Field(None, ge=1)
    source_order_no: Optional[str] = Field(None, max_length=128)
    applicant_user_id: Optional[int] = Field(None, ge=1)
    department_uuid: Optional[str] = Field(None, max_length=36)
    outsourced_unit_code: Optional[str] = Field(None, max_length=64)
    outsourced_unit_name: Optional[str] = Field(None, max_length=200)
    header_attachment_file_uuids: Optional[List[str]] = None
    line_items: Optional[List[OutsourceCompleteLineIn]] = None
    complete_notify_user_ids: Optional[List[int]] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


async def _normalize_attachment_uuids_for_tenant(tenant_id: int, raw: Any) -> List[str]:
    """
    统一附件引用为 UUID：
    - 保留合法 UUID 字符串
    - 将历史遗留的 core_files.id（数字）转换为对应 UUID
    """
    if not raw:
        return []
    if not isinstance(raw, list):
        return []

    normalized: List[str] = []
    legacy_ids: List[int] = []
    for item in raw:
        s = str(item or "").strip()
        if not s:
            continue
        if _UUID_RE.match(s):
            normalized.append(s.lower())
            continue
        if s.isdigit():
            n = int(s)
            if n > 0:
                legacy_ids.append(n)

    if legacy_ids:
        rows = await CoreFile.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            id__in=legacy_ids,
        ).values("id", "uuid")
        uuid_by_id = {
            int(r["id"]): str(r["uuid"]).strip().lower()
            for r in rows
            if str(r.get("uuid") or "").strip()
        }
        for legacy_id in legacy_ids:
            mapped = uuid_by_id.get(legacy_id)
            if mapped:
                normalized.append(mapped)

    # 去重并保持顺序
    out: List[str] = []
    seen = set()
    for u in normalized:
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def _primary_mold(lines: List[OutsourceCompleteLineOut]) -> Optional[str]:
    if not lines:
        return None
    c = (lines[0].mold_code or "").strip()
    return c or None


async def _serialize(row: HaoligoMoldOutsourceMaintenanceCompleteSheet) -> MoldOutsourceMaintenanceCompleteSheetOut:
    raw_lines = row.line_items or []
    lines: List[OutsourceCompleteLineOut] = []
    if isinstance(raw_lines, list):
        for item in raw_lines:
            if isinstance(item, dict):
                lines.append(_line_from_store(item))

    src_header: List[str] = []
    src_by_mold: dict[str, List[str]] = {}
    src_line_raw_by_mold: dict[str, dict[str, Any]] = {}
    sid = row.source_outsource_maintenance_sheet_id
    tid = getattr(row, "tenant_id", None)
    if sid and tid is not None:
        src_row = await HaoligoMoldOutsourceMaintenanceSheet.filter(
            id=sid,
            tenant_id=tid,
            deleted_at__isnull=True,
        ).first()
        if src_row:
            src_header = await _normalize_attachment_uuids_for_tenant(
                int(tid), list(src_row.header_attachment_file_uuids or [])
            )
            src_raw = src_row.line_items or []
            src_lines_patched = False
            if isinstance(src_raw, list):
                for it in src_raw:
                    if not isinstance(it, dict):
                        continue
                    mc = str(it.get("mold_code") or "").strip()
                    if mc:
                        src_line_raw_by_mold[mc] = it
                        normalized_line_uuids = await _normalize_attachment_uuids_for_tenant(
                            int(tid), it.get("attachment_file_uuids")
                        )
                        src_by_mold[mc] = normalized_line_uuids
                        old_line_uuids = list(it.get("attachment_file_uuids") or [])
                        if old_line_uuids != normalized_line_uuids:
                            it["attachment_file_uuids"] = normalized_line_uuids
                            src_lines_patched = True
            if src_lines_patched:
                src_row.line_items = src_raw
                await src_row.save(update_fields=["line_items", "updated_at"])

    tid_int = int(tid) if tid is not None else 0
    codes = [(ln.mold_code or "").strip() for ln in lines if (ln.mold_code or "").strip()]
    snapshots = await mold_warehouse_snapshot_by_codes(tid_int, codes) if tid_int else {}
    is_approved = _effective_sheet_status(row) == SHEET_STATUS_APPROVED
    raw_dicts: List[dict[str, Any]] = []
    if isinstance(raw_lines, list):
        for item in raw_lines:
            if isinstance(item, dict):
                raw_dicts.append(item)
    enriched_lines: List[OutsourceCompleteLineOut] = []
    for ln, raw in zip(lines, raw_dicts):
        mc = (ln.mold_code or "").strip()
        snap = snapshots.get(mc, {})
        wh_fields = await resolve_complete_line_warehouse_fields(
            tid_int,
            raw,
            snap,
            src_line_raw_by_mold.get(mc),
            is_approved=is_approved,
        )
        return_wh_id = await resolve_return_warehouse_id_for_complete_line(
            tid_int,
            source_raw=src_line_raw_by_mold.get(mc),
            complete_raw=raw,
            mold_code=mc,
            src=src_row,
        )
        return_fields: dict[str, Any] = {
            "return_before_outsource_warehouse_id": return_wh_id,
            "return_before_outsource_warehouse_code": None,
            "return_before_outsource_warehouse_name": None,
        }
        if return_wh_id:
            return_snap = await warehouse_snapshot_by_id(tid_int, return_wh_id)
            if return_snap:
                return_fields["return_before_outsource_warehouse_code"] = return_snap.get("mold_warehouse_code")
                return_fields["return_before_outsource_warehouse_name"] = return_snap.get("mold_warehouse_name")
        enriched_lines.append(
            ln.model_copy(
                update={
                    **wh_fields,
                    **return_fields,
                    "source_attachment_file_uuids": src_by_mold.get(mc, []),
                }
            )
        )
    primary_wh: Optional[str] = None
    if enriched_lines:
        primary_wh = format_mold_warehouse_label(
            warehouse_name=enriched_lines[0].mold_warehouse_name,
            warehouse_code=enriched_lines[0].mold_warehouse_code,
        )

    return MoldOutsourceMaintenanceCompleteSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        source_outsource_maintenance_sheet_id=row.source_outsource_maintenance_sheet_id,
        source_order_no=row.source_order_no,
        applicant_user_id=getattr(row, "applicant_user_id", None),
        applicant_name=_strip_opt(getattr(row, "applicant_name", None)),
        department_uuid=_strip_opt(getattr(row, "department_uuid", None)),
        department_name=_strip_opt(getattr(row, "department_name", None)),
        outsourced_unit_code=row.outsourced_unit_code,
        outsourced_unit_name=row.outsourced_unit_name,
        service_type=row.service_type,
        clear_total_production=bool(row.clear_total_production),
        header_attachment_file_uuids=list(row.header_attachment_file_uuids or []),
        source_header_attachment_file_uuids=src_header,
        line_items=enriched_lines,
        primary_mold_code=_primary_mold(enriched_lines),
        primary_mold_warehouse_name=primary_wh,
        sheet_status=_effective_sheet_status(row),
        audited_at=getattr(row, "audited_at", None),
        audited_by_user_id=getattr(row, "audited_by_user_id", None),
        complete_notify_user_ids=normalize_report_user_ids(getattr(row, "complete_notify_user_ids", None)),
        created_at=row.created_at,
        creator_name=resolve_creator_name(applicant_name=_strip_opt(getattr(row, "applicant_name", None))),
    )


@router.get("", summary="外协维保完修单分页列表")
async def list_outsource_maintenance_complete_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    sheet_status: Optional[str] = Query(None, description="待审核 / 已通过 / 已驳回 等"),
    created_from: Optional[datetime] = Query(None, description="创建时间起（含）"),
    created_to: Optional[datetime] = Query(None, description="创建时间止（含）"),
):
    qs = tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id)
    qs = await apply_mold_line_items_sheet_keyword_filter(
        qs,
        tenant_id,
        keyword,
        outsource_complete_header_keyword_q,
        HaoligoMoldOutsourceMaintenanceCompleteSheet,
    )
    if sheet_status and sheet_status.strip():
        qs = qs.filter(sheet_status=sheet_status.strip())
    if created_from is not None:
        qs = qs.filter(created_at__gte=created_from)
    if created_to is not None:
        qs = qs.filter(created_at__lte=created_to)
    qs = await apply_outsource_sheet_scope(
        qs, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items = [await _serialize(r) for r in rows]
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=MoldOutsourceMaintenanceCompleteSheetOut, summary="创建外协维保完修单")
async def create_outsource_maintenance_complete_sheet(
    body: MoldOutsourceMaintenanceCompleteSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    src = await tenant_alive(HaoligoMoldOutsourceMaintenanceSheet, tenant_id).filter(
        id=body.source_outsource_maintenance_sheet_id,
    ).first()
    if not src:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协维保单不存在")
    if str(getattr(src, "sheet_status", "") or "").strip() != SHEET_STATUS_APPROVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅已审核通过的外协维保单可确认完修")
    await assert_outsource_row_visible(
        src, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_MAINTENANCE
    )
    if await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(
        source_outsource_maintenance_sheet_id=src.id,
        deleted_at__isnull=True,
    ).exclude(sheet_status="已驳回").exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该外协维保单已存在外协维保完修单，不可重复确认")
    raw_lines = src.line_items or []
    if not isinstance(raw_lines, list) or not raw_lines:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协维保单明细为空，无法确认完修")
    svc = str(src.service_type or "维修").strip()
    if svc != "维修":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协维保单仅支持维修类型")
    src_lines = [x for x in raw_lines if isinstance(x, dict)]
    src_codes = [str(x.get("mold_code") or "").strip() for x in src_lines]
    src_codes = [c for c in src_codes if c]
    if not src_codes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协维保单无有效模具明细")
    src_set = set(src_codes)
    if len(src_set) != len(src_codes):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协维保单存在重复模具代号")
    by_client: dict[str, OutsourceCompleteLineIn] = {}
    for ln in body.line_items:
        mc = ln.mold_code.strip()
        if mc in by_client:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"完修明细中模具「{mc}」重复")
        by_client[mc] = ln
    if set(by_client.keys()) != src_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="完修明细模具须与外协维保单明细一致（相同模具代号集合）",
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
            ln = OutsourceCompleteLineIn.model_validate(merged)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        stored.append(_line_dict_for_sheet(ln))
    if not stored:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协维保单无有效模具明细")
    await backfill_before_outsource_on_source_lines(
        tenant_id,
        src,
        complete_line_items=stored,
    )
    src_no = (
        str(src.source_order_no or "").strip()
        or str(src.sheet_no or "").strip()
        or f"外协维保单#{src.id}"
    )
    applicant_id = body.applicant_user_id if body.applicant_user_id is not None else getattr(src, "applicant_user_id", None)
    if not applicant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写申请人")
    dept_raw = body.department_uuid if body.department_uuid is not None else getattr(src, "department_uuid", None)
    dept_uu = _strip_opt(str(dept_raw) if dept_raw is not None else None)
    if not dept_uu:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择申请部门")
    applicant_user_id_resolved, applicant_name = await _resolve_applicant_only(tenant_id, int(applicant_id))
    department_uuid_resolved, department_name = await _validate_leaf_department(tenant_id, dept_uu)
    unit_name = (str(src.outsourced_unit_name or "").strip())
    if not unit_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协单位无效")
    try:
        unit_name, unit_code = await resolve_outsource_unit_fields(
            tenant_id, unit_name, src.outsourced_unit_code
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    async with in_transaction():
        try:
            sheet_no = await generate_mold_sheet_no(tenant_id, HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoMoldOutsourceMaintenanceCompleteSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            source_outsource_maintenance_sheet_id=src.id,
            source_order_no=src_no,
            applicant_user_id=applicant_user_id_resolved,
            applicant_name=applicant_name,
            department_uuid=department_uuid_resolved,
            department_name=department_name,
            outsourced_unit_code=_strip_opt(unit_code),
            outsourced_unit_name=unit_name,
            service_type="维修",
            clear_total_production=False,
            header_attachment_file_uuids=[],
            line_items=stored,
            sheet_status="待审核",
            complete_notify_user_ids=normalize_report_user_ids(body.complete_notify_user_ids),
        )
    from apps.haoligo.services.mold_outsource_complete_sheet_side_effects import (
        send_outsource_complete_submitted_messages,
    )

    await send_outsource_complete_submitted_messages(tenant_id, row)
    return await _serialize(row)


@router.get("/pending-audit", summary="外协维保完修单待审核列表（需审核权限；按数据范围）")
async def list_pending_audit_outsource_maintenance_complete_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
):
    qs = tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(
        sheet_status=SHEET_STATUS_PENDING
    )
    qs = await apply_outsource_sheet_scope(
        qs, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    qs = await apply_mold_line_items_sheet_keyword_filter(
        qs,
        tenant_id,
        keyword,
        outsource_complete_header_keyword_q,
        HaoligoMoldOutsourceMaintenanceCompleteSheet,
    )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items = [await _serialize(r) for r in rows]
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/audit-mine", summary="委外审核列表（当前用户为申请人；含待审核/已通过/已驳回）")
async def list_audit_outsource_maintenance_complete_sheets_mine(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    sheet_status: Optional[str] = Query(None, description="按审核状态筛选；不传则全部"),
):
    qs = tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(applicant_user_id=user.id)
    st = (sheet_status or "").strip()
    if st and st in OUTSOURCE_MAINTENANCE_COMPLETE_SHEET_STATUS_SET:
        qs = qs.filter(sheet_status=st)
    qs = await apply_mold_line_items_sheet_keyword_filter(
        qs,
        tenant_id,
        keyword,
        outsource_complete_header_keyword_q,
        HaoligoMoldOutsourceMaintenanceCompleteSheet,
    )
    qs = await apply_outsource_sheet_scope(
        qs, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items = [await _serialize(r) for r in rows]
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/pending-mine", summary="委外审核待办（当前用户为申请人且待审核）")
async def list_pending_outsource_maintenance_complete_sheets_mine(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
):
    qs = (
        tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id)
        .filter(applicant_user_id=user.id, sheet_status="待审核")
    )
    qs = await apply_outsource_sheet_scope(
        qs, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    qs = await apply_mold_line_items_sheet_keyword_filter(
        qs,
        tenant_id,
        keyword,
        outsource_complete_header_keyword_q,
        HaoligoMoldOutsourceMaintenanceCompleteSheet,
    )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items = [await _serialize(r) for r in rows]
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{row_id}", response_model=MoldOutsourceMaintenanceCompleteSheetOut, summary="外协维保完修单详情")
async def get_outsource_maintenance_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    return await _serialize(row)


@router.patch("/{row_id}", response_model=MoldOutsourceMaintenanceCompleteSheetOut, summary="更新外协维保完修单")
async def update_outsource_maintenance_complete_sheet(
    row_id: int,
    body: MoldOutsourceMaintenanceCompleteSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    _guard_mutation_allowed(row)
    data = body.model_dump(exclude_unset=True)
    if "complete_notify_user_ids" in data and data["complete_notify_user_ids"] is not None:
        data["complete_notify_user_ids"] = normalize_report_user_ids(data["complete_notify_user_ids"])
    if "source_order_no" in data and data["source_order_no"] is not None:
        s = str(data["source_order_no"]).strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="来源单号不能为空")
        data["source_order_no"] = s
    if "outsourced_unit_name" in data or "outsourced_unit_code" in data:
        new_name = data.get("outsourced_unit_name", row.outsourced_unit_name)
        new_code = data.get("outsourced_unit_code", row.outsourced_unit_code)
        try:
            unit_name, unit_code = await resolve_outsource_unit_fields(tenant_id, new_name, new_code)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        data["outsourced_unit_name"] = unit_name
        data["outsourced_unit_code"] = unit_code
    if "header_attachment_file_uuids" in data:
        data["header_attachment_file_uuids"] = []
    if "line_items" in data and data["line_items"] is not None:
        lines = [OutsourceCompleteLineIn.model_validate(x) for x in data["line_items"]]
        if not lines:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="至少保留一条模具信息")
        data["line_items"] = [_line_dict_for_sheet(x) for x in lines]
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
    if _effective_sheet_status(row) == "已驳回":
        data["sheet_status"] = "待审核"
        data["audited_at"] = None
        data["audited_by_user_id"] = None
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    for mc in codes:
        await refresh_mold_status_after_maintenance_completed(tenant_id, mc)
    return await _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除外协维保完修单")
async def delete_outsource_maintenance_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    _guard_mutation_allowed(row)
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    row.deleted_at = timezone.now()
    await row.save()
    for mc in codes:
        await refresh_mold_status_after_maintenance_completed(tenant_id, mc)


@router.post(
    "/{row_id}/approve",
    response_model=MoldOutsourceMaintenanceCompleteSheetOut,
    summary="审核通过外协维保完修单",
)
async def approve_outsource_maintenance_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    body: Optional[OutsourceCompleteApproveIn] = None,
):
    preview = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not preview:
        await _not_found()
    await assert_outsource_row_visible(
        preview, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    overrides: dict[str, int] = {}
    for ov in (body.return_warehouse_overrides if body else None) or []:
        overrides[ov.mold_code] = ov.warehouse_id
    codes: list[str] = []
    async with in_transaction():
        row = await load_sheet_row_for_audit(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id, row_id)
        assert_pending_for_sheet_audit(row)
        row.sheet_status = OUTSOURCE_MAINTENANCE_COMPLETE_APPROVED_STATUS
        row.audited_at = timezone.now()
        row.audited_by_user_id = user.id
        await row.save()
        await apply_warehouses_on_outsource_complete_approved(
            tenant_id, row, return_warehouse_overrides=overrides or None
        )
        await apply_upkeep_clear_from_outsource_complete_sheet_on_approve(tenant_id, row)
        codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
        for mc in codes:
            await refresh_mold_status_after_maintenance_completed(tenant_id, mc)
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    from apps.haoligo.services.mold_outsource_complete_sheet_side_effects import (
        send_outsource_complete_approved_messages,
    )

    await send_outsource_complete_approved_messages(tenant_id, row)
    return await _serialize(row)


@router.post(
    "/{row_id}/reject",
    response_model=MoldOutsourceMaintenanceCompleteSheetOut,
    summary="审核驳回外协维保完修单",
)
async def reject_outsource_maintenance_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    assert_pending_for_sheet_audit(row)
    row.sheet_status = "已驳回"
    row.audited_at = timezone.now()
    row.audited_by_user_id = user.id
    await row.save()
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    for mc in codes:
        await refresh_mold_status_after_maintenance_completed(tenant_id, mc)
    from apps.haoligo.services.mold_outsource_complete_sheet_side_effects import (
        send_outsource_complete_rejected_messages,
    )

    await send_outsource_complete_rejected_messages(tenant_id, row)
    return await _serialize(row)


@router.post(
    "/{row_id}/revoke-approval",
    response_model=MoldOutsourceMaintenanceCompleteSheetOut,
    summary="撤销外协维保完修单审核（已通过→待审核）",
)
async def revoke_approval_outsource_maintenance_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_outsource_row_visible(
        row, tenant_id=tenant_id, user=user, resource=RESOURCE_OUTSOURCE_COMPLETE
    )
    assert_approved_for_sheet_revoke(row)
    row.sheet_status = SHEET_STATUS_PENDING
    row.audited_at = None
    row.audited_by_user_id = None
    await row.save()
    codes = unique_mold_codes_from_stored_line_items(row.line_items or [])
    for mc in codes:
        await refresh_mold_status_after_maintenance_completed(tenant_id, mc)
    from apps.haoligo.services.mold_outsource_complete_sheet_side_effects import (
        send_outsource_complete_revoked_messages,
    )

    await send_outsource_complete_revoked_messages(tenant_id, row)
    return await _serialize(row)
