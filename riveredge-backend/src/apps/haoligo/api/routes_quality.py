"""好力 GO — 品质管理一期单据 API。"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated, Any, Callable, List, Optional, TypeVar
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._creator import resolve_creator_name
from apps.haoligo.api._erp_mold_code import parse_erp_mold_code
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api._users import resolve_tenant_user
from apps.haoligo.models.equipment import HaoligoEquipment, HaoligoWorkshop
from apps.haoligo.models.quality import (
    HaoligoCustomerComplaint,
    HaoligoLineStopFeedback,
    HaoligoQualityIssueTracking,
)
from apps.haoligo.models.quality_dataset_binding import HaoligoQualityDatasetBinding
from apps.haoligo.services.haoligo_business_notification import (
    ACTION_COMPLETED,
    ACTION_LONG_TERM_OVERDUE,
    ACTION_SUBMITTED,
    ACTION_TEMPORARY_OVERDUE,
    DOC_CUSTOMER_COMPLAINT,
    DOC_LINE_STOP_FEEDBACK,
    DOC_QUALITY_ISSUE_TRACKING,
    dispatch_haoligo_notification,
)
from apps.haoligo.services.quality_issue_calc import calc_defect_rate
from apps.haoligo.services.spot_check_side_effects import normalize_report_user_ids, validate_report_notify_users
from core.api.deps.deps import get_current_tenant, get_current_user
from core.schemas.dataset import ExecuteQueryRequest
from core.services.data.dataset_service import DatasetService
from infra.models.user import User

router = APIRouter(prefix="/quality", tags=["App · HaoliGO · 品质管理"])

_ALLOWED_STATUSES = {"registered", "assigned", "processing", "completed"}
_ALLOWED_ISSUE_KINDS = {"equipment", "product"}
_T = TypeVar("_T")


class QualityBaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    sheet_no: Optional[str] = None
    title: Optional[str] = None
    workshop_id: Optional[int] = None
    workshop_name: Optional[str] = None
    production_line: Optional[str] = None
    work_order_no: Optional[str] = None
    material_code_snapshot: Optional[str] = None
    model_snapshot: Optional[str] = None
    mold_code_snapshot: Optional[str] = None
    equipment_id: Optional[int] = None
    equipment_asset_code: Optional[str] = None
    equipment_name: Optional[str] = None
    problem_description: Optional[str] = None
    immediate_action: Optional[str] = None
    long_term_action: Optional[str] = None
    due_at: Optional[datetime] = None
    temporary_action: Optional[str] = None
    temporary_due_at: Optional[datetime] = None
    temporary_action_image_uuids: List[str] = Field(default_factory=list)
    temporary_submitted_at: Optional[datetime] = None
    long_term_due_at: Optional[datetime] = None
    long_term_action_image_uuids: List[str] = Field(default_factory=list)
    long_term_submitted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str
    attachment_file_uuids: List[str] = Field(default_factory=list)
    registrant_user_id: Optional[int] = None
    registrant_name: Optional[str] = None
    responsible_user_id: Optional[int] = None
    responsible_name: Optional[str] = None
    responsible_user_ids: List[int] = Field(default_factory=list)
    overdue_notify_user_ids: List[int] = Field(default_factory=list)
    notify_user_ids: List[int] = Field(default_factory=list)
    reported_at: Optional[datetime] = None
    close_note: Optional[str] = None
    close_confirmed_at: Optional[datetime] = None
    close_confirmer_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    creator_name: Optional[str] = None

    @field_validator("uuid", mode="before")
    @classmethod
    def _coerce_uuid_str(cls, v: Any) -> str:
        return str(v)

    @field_validator(
        "temporary_action_image_uuids",
        "long_term_action_image_uuids",
        "attachment_file_uuids",
        "responsible_user_ids",
        "overdue_notify_user_ids",
        "notify_user_ids",
        mode="before",
    )
    @classmethod
    def _coerce_json_list(cls, v: Any) -> List[Any]:
        return [] if v is None else v


class QualityIssueOut(QualityBaseOut):
    issue_type_codes: List[str] = Field(default_factory=list)
    issue_kind: Optional[str] = None
    temporary_overdue_notify_user_ids: List[int] = Field(default_factory=list)
    long_term_overdue_notify_user_ids: List[int] = Field(default_factory=list)
    planned_qty: Optional[Decimal] = None
    completed_qty: Optional[Decimal] = None
    defect_qty: Optional[Decimal] = None
    defect_rate: Optional[Decimal] = None

    @field_validator("issue_type_codes", mode="before")
    @classmethod
    def _coerce_issue_type_codes(cls, v: Any) -> List[Any]:
        return [] if v is None else v

    @field_validator(
        "temporary_overdue_notify_user_ids",
        "long_term_overdue_notify_user_ids",
        mode="before",
    )
    @classmethod
    def _coerce_issue_overdue_notify_ids(cls, v: Any) -> List[Any]:
        return [] if v is None else v


class CustomerComplaintOut(QualityBaseOut):
    customer_name: Optional[str] = None
    material_code: Optional[str] = None
    model: Optional[str] = None
    batch_no: Optional[str] = None
    quantity: Optional[Decimal] = None
    claim_amount: Optional[Decimal] = None
    temporary_overdue_notify_user_ids: List[int] = Field(default_factory=list)
    long_term_overdue_notify_user_ids: List[int] = Field(default_factory=list)

    @field_validator(
        "temporary_overdue_notify_user_ids",
        "long_term_overdue_notify_user_ids",
        mode="before",
    )
    @classmethod
    def _coerce_complaint_overdue_notify_ids(cls, v: Any) -> List[Any]:
        return [] if v is None else v


class LineStopOut(QualityBaseOut):
    stop_kind: str = "equipment"
    stop_reason: Optional[str] = None
    stop_started_at: Optional[datetime] = None
    recovered_at: Optional[datetime] = None
    temporary_overdue_notify_user_ids: List[int] = Field(default_factory=list)
    long_term_overdue_notify_user_ids: List[int] = Field(default_factory=list)

    @field_validator(
        "temporary_overdue_notify_user_ids",
        "long_term_overdue_notify_user_ids",
        mode="before",
    )
    @classmethod
    def _coerce_line_stop_overdue_notify_ids(cls, v: Any) -> List[Any]:
        return [] if v is None else v


class QualityBaseCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    workshop_id: Optional[int] = None
    production_line: Optional[str] = Field(None, max_length=200)
    work_order_no: Optional[str] = Field(None, max_length=128)
    material_code_snapshot: Optional[str] = Field(None, max_length=128)
    model_snapshot: Optional[str] = Field(None, max_length=128)
    mold_code_snapshot: Optional[str] = Field(None, max_length=128)
    equipment_id: Optional[int] = None
    problem_description: Optional[str] = None
    immediate_action: Optional[str] = None
    long_term_action: Optional[str] = None
    due_at: Optional[datetime] = None
    temporary_due_at: Optional[datetime] = None
    long_term_due_at: Optional[datetime] = None
    attachment_file_uuids: List[str] = Field(default_factory=list)
    registrant_user_id: Optional[int] = Field(None, ge=1)
    responsible_user_id: Optional[int] = Field(None, ge=1)
    responsible_user_ids: List[int] = Field(default_factory=list)
    overdue_notify_user_ids: List[int] = Field(default_factory=list)
    notify_user_ids: List[int] = Field(default_factory=list)
    reported_at: Optional[datetime] = None


class QualityBaseUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    workshop_id: Optional[int] = None
    production_line: Optional[str] = Field(None, max_length=200)
    work_order_no: Optional[str] = Field(None, max_length=128)
    material_code_snapshot: Optional[str] = Field(None, max_length=128)
    model_snapshot: Optional[str] = Field(None, max_length=128)
    mold_code_snapshot: Optional[str] = Field(None, max_length=128)
    equipment_id: Optional[int] = None
    problem_description: Optional[str] = None
    immediate_action: Optional[str] = None
    temporary_action: Optional[str] = None
    temporary_action_image_uuids: Optional[List[str]] = None
    long_term_action: Optional[str] = None
    long_term_action_image_uuids: Optional[List[str]] = None
    due_at: Optional[datetime] = None
    temporary_due_at: Optional[datetime] = None
    long_term_due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: Optional[str] = Field(None, max_length=32)
    attachment_file_uuids: Optional[List[str]] = None
    responsible_user_id: Optional[int] = Field(None, ge=1)
    responsible_user_ids: Optional[List[int]] = None
    overdue_notify_user_ids: Optional[List[int]] = None
    notify_user_ids: Optional[List[int]] = None
    reported_at: Optional[datetime] = None
    close_note: Optional[str] = None


class QualityIssueCreate(QualityBaseCreate):
    issue_type_codes: List[str] = Field(default_factory=list)
    issue_kind: Optional[str] = Field(None, max_length=32)
    planned_qty: Optional[Decimal] = None
    completed_qty: Optional[Decimal] = None
    defect_qty: Optional[Decimal] = None


class QualityIssueUpdate(QualityBaseUpdate):
    issue_type_codes: Optional[List[str]] = None
    issue_kind: Optional[str] = Field(None, max_length=32)
    temporary_overdue_notify_user_ids: Optional[List[int]] = None
    long_term_overdue_notify_user_ids: Optional[List[int]] = None
    planned_qty: Optional[Decimal] = None
    completed_qty: Optional[Decimal] = None
    defect_qty: Optional[Decimal] = None


class CustomerComplaintCreate(QualityBaseCreate):
    customer_name: Optional[str] = Field(None, max_length=200)
    material_code: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    batch_no: Optional[str] = Field(None, max_length=100)
    quantity: Optional[Decimal] = None
    claim_amount: Optional[Decimal] = None


class CustomerComplaintUpdate(QualityBaseUpdate):
    customer_name: Optional[str] = Field(None, max_length=200)
    material_code: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    batch_no: Optional[str] = Field(None, max_length=100)
    quantity: Optional[Decimal] = None
    claim_amount: Optional[Decimal] = None
    temporary_overdue_notify_user_ids: Optional[List[int]] = None
    long_term_overdue_notify_user_ids: Optional[List[int]] = None


class LineStopCreate(QualityBaseCreate):
    stop_kind: str = Field(default="equipment", max_length=32)
    stop_reason: Optional[str] = None
    stop_started_at: Optional[datetime] = None
    recovered_at: Optional[datetime] = None


class LineStopUpdate(QualityBaseUpdate):
    stop_kind: Optional[str] = Field(None, max_length=32)
    stop_reason: Optional[str] = None
    stop_started_at: Optional[datetime] = None
    recovered_at: Optional[datetime] = None
    temporary_overdue_notify_user_ids: Optional[List[int]] = None
    long_term_overdue_notify_user_ids: Optional[List[int]] = None


class RegisterSubmitPayload(BaseModel):
    responsible_user_ids: List[int] = Field(default_factory=list)
    overdue_notify_user_ids: List[int] = Field(default_factory=list)


class TemporaryActionPayload(BaseModel):
    responsible_user_ids: List[int] = Field(default_factory=list)
    overdue_notify_user_ids: List[int] = Field(default_factory=list)
    temporary_overdue_notify_user_ids: List[int] = Field(default_factory=list)
    temporary_action: str = Field(min_length=1)
    temporary_due_at: datetime
    temporary_action_image_uuids: List[str] = Field(default_factory=list)


class LongTermActionPayload(BaseModel):
    long_term_action: str = Field(min_length=1)
    long_term_due_at: datetime
    long_term_action_image_uuids: List[str] = Field(default_factory=list)


class HandleMeasuresPayload(BaseModel):
    """处理措施：临时与长期独立填写，至少提交其中一项。"""

    responsible_user_ids: List[int] = Field(min_length=1)
    overdue_notify_user_ids: List[int] = Field(default_factory=list)
    temporary_overdue_notify_user_ids: List[int] = Field(default_factory=list)
    long_term_overdue_notify_user_ids: List[int] = Field(default_factory=list)
    temporary_action: Optional[str] = None
    temporary_due_at: Optional[datetime] = None
    temporary_action_image_uuids: List[str] = Field(default_factory=list)
    long_term_action: Optional[str] = None
    long_term_due_at: Optional[datetime] = None
    long_term_action_image_uuids: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_at_least_one_measure(self) -> "HandleMeasuresPayload":
        temp_text = (self.temporary_action or "").strip()
        long_text = (self.long_term_action or "").strip()
        temp_ok = bool(temp_text) and self.temporary_due_at is not None
        long_ok = bool(long_text) and self.long_term_due_at is not None
        if temp_text and self.temporary_due_at is None:
            raise ValueError("请填写临时措施预计完成时间")
        if long_text and self.long_term_due_at is None:
            raise ValueError("请填写长期措施预计完成时间")
        if self.temporary_due_at is not None and not temp_text:
            raise ValueError("请填写临时措施")
        if self.long_term_due_at is not None and not long_text:
            raise ValueError("请填写长期措施")
        if not temp_ok and not long_ok:
            raise ValueError("请至少填写临时措施或长期措施（含预计完成时间）")
        return self


class CloseConfirmPayload(BaseModel):
    close_note: Optional[str] = None
    recovered_at: Optional[datetime] = None


class WorkOrderScanPayload(BaseModel):
    work_order_no: str = Field(min_length=1, max_length=128)


class WorkOrderScanOut(BaseModel):
    work_order_no: str
    workshop_id: Optional[int] = None
    production_line: Optional[str] = None
    equipment_id: Optional[int] = None
    material_code_snapshot: Optional[str] = None
    model_snapshot: Optional[str] = None
    mold_code_snapshot: Optional[str] = None


class QualityDatasetBindingOut(BaseModel):
    dataset_uuid: Optional[str] = None
    work_order_param_key: Optional[str] = None
    workshop_name_column: Optional[str] = None
    production_line_column: Optional[str] = None
    equipment_asset_code_column: Optional[str] = None
    mold_code_column: Optional[str] = None
    finished_product_code_column: Optional[str] = None
    finished_product_name_column: Optional[str] = None


class QualityDatasetBindingUpsert(BaseModel):
    dataset_uuid: Optional[str] = None
    work_order_param_key: Optional[str] = None
    workshop_name_column: Optional[str] = None
    production_line_column: Optional[str] = None
    equipment_asset_code_column: Optional[str] = None
    mold_code_column: Optional[str] = None
    finished_product_code_column: Optional[str] = None
    finished_product_name_column: Optional[str] = None


class OverdueDispatchResult(BaseModel):
    temporary_overdue: int = 0
    long_term_overdue: int = 0


class _PageOut(BaseModel):
    items: List[Any]
    total: int
    skip: int
    limit: int


def _gen_sheet_no(prefix: str) -> str:
    now = timezone.now().strftime("%Y%m%d%H%M%S")
    return f"{prefix}-{now}-{timezone.now().microsecond % 10000:04d}"


def _resolve_quality_record_title(
    *,
    title: Optional[str],
    problem_description: Optional[str] = None,
    stop_reason: Optional[str] = None,
    customer_name: Optional[str] = None,
    work_order_no: Optional[str] = None,
    sheet_no: Optional[str] = None,
) -> str:
    explicit = (title or "").strip()
    if explicit:
        return explicit[:200]
    for candidate in (
        problem_description,
        stop_reason,
        customer_name,
        f"制令单 {(work_order_no or '').strip()}" if (work_order_no or "").strip() else None,
        sheet_no,
    ):
        text = (candidate or "").strip()
        if text:
            return text[:200]
    return "品质单据"


async def _ensure_relations(tenant_id: int, workshop_id: Optional[int], equipment_id: Optional[int]) -> None:
    if workshop_id is not None and not await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=workshop_id).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
    if equipment_id is not None and not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")


async def _resolve_people(
    tenant_id: int,
    *,
    current_user: User,
    registrant_user_id: Optional[int],
    responsible_user_id: Optional[int],
) -> tuple[int, str, Optional[int], Optional[str]]:
    reg_uid, reg_name = await resolve_tenant_user(tenant_id, int(registrant_user_id or current_user.id))
    if responsible_user_id is None:
        return reg_uid, reg_name, None, None
    rsp_uid, rsp_name = await resolve_tenant_user(tenant_id, int(responsible_user_id))
    return reg_uid, reg_name, rsp_uid, rsp_name


async def _normalize_notify_users(tenant_id: int, user_ids: Optional[List[int]]) -> List[int]:
    ids = normalize_report_user_ids(user_ids)
    if ids:
        await validate_report_notify_users(tenant_id, ids)
    return ids


async def _normalize_responsible_users(tenant_id: int, user_ids: Optional[List[int]]) -> List[int]:
    ids = normalize_report_user_ids(user_ids)
    if ids:
        await validate_report_notify_users(tenant_id, ids)
    return ids


async def _normalize_overdue_notify_users(tenant_id: int, user_ids: Optional[List[int]]) -> List[int]:
    ids = normalize_report_user_ids(user_ids)
    if ids:
        await validate_report_notify_users(tenant_id, ids)
    return ids


def _merge_overdue_notify_user_ids(*groups: Optional[List[int]]) -> List[int]:
    merged: List[int] = []
    seen: set[int] = set()
    for group in groups:
        for raw in group or []:
            uid = int(raw)
            if uid > 0 and uid not in seen:
                seen.add(uid)
                merged.append(uid)
    return merged


def _temporary_measure_provided(body: HandleMeasuresPayload) -> bool:
    return bool((body.temporary_action or "").strip()) and body.temporary_due_at is not None


def _long_term_measure_provided(body: HandleMeasuresPayload) -> bool:
    return bool((body.long_term_action or "").strip()) and body.long_term_due_at is not None


def _apply_handle_measures(row: Any, body: HandleMeasuresPayload, now: datetime) -> None:
    if _temporary_measure_provided(body):
        row.temporary_action = body.temporary_action.strip()
        row.temporary_due_at = body.temporary_due_at
        row.temporary_action_image_uuids = [
            str(x).strip() for x in body.temporary_action_image_uuids if str(x).strip()
        ]
        row.temporary_submitted_at = row.temporary_submitted_at or now
        row.immediate_action = row.temporary_action
    if _long_term_measure_provided(body):
        row.long_term_action = body.long_term_action.strip()
        row.long_term_due_at = body.long_term_due_at
        row.long_term_action_image_uuids = [
            str(x).strip() for x in body.long_term_action_image_uuids if str(x).strip()
        ]
        row.long_term_submitted_at = now
    row.due_at = row.long_term_due_at or row.temporary_due_at


async def _prepare_split_overdue_notify_users(
    tenant_id: int,
    body: HandleMeasuresPayload,
) -> tuple[List[int], List[int], List[int]]:
    overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, body.overdue_notify_user_ids)
    temporary_overdue_notify_user_ids = await _normalize_overdue_notify_users(
        tenant_id,
        body.temporary_overdue_notify_user_ids or body.overdue_notify_user_ids,
    )
    long_term_overdue_notify_user_ids = await _normalize_overdue_notify_users(
        tenant_id,
        body.long_term_overdue_notify_user_ids or body.overdue_notify_user_ids,
    )
    merged = _merge_overdue_notify_user_ids(
        overdue_notify_user_ids,
        temporary_overdue_notify_user_ids,
        long_term_overdue_notify_user_ids,
    )
    return merged, temporary_overdue_notify_user_ids, long_term_overdue_notify_user_ids


def _row_temporary_overdue_notify_user_ids(row: Any) -> List[int]:
    if hasattr(row, "temporary_overdue_notify_user_ids"):
        ids = normalize_report_user_ids(row.temporary_overdue_notify_user_ids)
        if ids:
            return ids
    return normalize_report_user_ids(row.overdue_notify_user_ids)


def _row_long_term_overdue_notify_user_ids(row: Any) -> List[int]:
    if hasattr(row, "long_term_overdue_notify_user_ids"):
        ids = normalize_report_user_ids(row.long_term_overdue_notify_user_ids)
        if ids:
            return ids
    return normalize_report_user_ids(row.overdue_notify_user_ids)


def _normalize_issue_kind(value: Optional[str]) -> Optional[str]:
    kind = (value or "").strip().lower()
    if not kind:
        return None
    if kind not in _ALLOWED_ISSUE_KINDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="问题类型无效")
    return kind


def _require_issue_kind(issue_kind: Optional[str]) -> None:
    if not _normalize_issue_kind(issue_kind):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择问题类型")


def _require_register_fields(
    *,
    problem_description: Optional[str],
    workshop_id: Optional[int] = None,
    defect_qty: Optional[Decimal] = None,
    require_workshop: bool = True,
) -> None:
    if not (problem_description or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="问题描述必填")
    if require_workshop and workshop_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="责任车间必填")
    if defect_qty is not None and defect_qty <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不良数量必须大于 0")


def _validate_issue_qty_fields(
    *,
    planned_qty: Optional[Decimal] = None,
    completed_qty: Optional[Decimal] = None,
    defect_qty: Optional[Decimal] = None,
) -> None:
    if planned_qty is not None and planned_qty < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="计划数量不能为负")
    if completed_qty is not None and completed_qty < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="完成数量不能为负")
    if defect_qty is not None and defect_qty <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不良数量必须大于 0")


def _resolve_issue_defect_rate(
    *,
    completed_qty: Optional[Decimal],
    defect_qty: Optional[Decimal],
) -> Optional[Decimal]:
    return calc_defect_rate(completed_qty, defect_qty)


def _require_complaint_register_fields(
    *,
    customer_name: Optional[str],
    problem_description: Optional[str],
) -> None:
    if not (customer_name or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="客户信息必填")
    if not (problem_description or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="问题描述必填")


def _ensure_status(value: Optional[str]) -> str:
    status_val = (value or "registered").strip().lower()
    if status_val not in _ALLOWED_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="状态非法")
    return status_val


async def _equipment_map(tenant_id: int, equipment_ids: List[int]) -> dict[int, tuple[str, str]]:
    if not equipment_ids:
        return {}
    rows = await tenant_alive(HaoligoEquipment, tenant_id).filter(id__in=equipment_ids).all()
    return {r.id: (r.asset_code, r.name) for r in rows}


async def _workshop_map(tenant_id: int, workshop_ids: List[int]) -> dict[int, str]:
    if not workshop_ids:
        return {}
    rows = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id__in=workshop_ids).all()
    return {r.id: r.name for r in rows}


async def _serialize_common(row: Any, tenant_id: int, out_model: Callable[..., _T]) -> _T:
    eq_map = await _equipment_map(tenant_id, [row.equipment_id] if row.equipment_id else [])
    ws_map = await _workshop_map(tenant_id, [row.workshop_id] if row.workshop_id else [])
    data = out_model.model_validate(row).model_dump()
    if row.workshop_id:
        data["workshop_name"] = ws_map.get(row.workshop_id)
    if row.equipment_id:
        code, name = eq_map.get(row.equipment_id, (None, None))
        data["equipment_asset_code"] = code
        data["equipment_name"] = name
    data["notify_user_ids"] = normalize_report_user_ids(data.get("notify_user_ids"))
    data["creator_name"] = resolve_creator_name(registrant_name=data.get("registrant_name"))
    return out_model(**data)


def _dataset_cell_str(row: dict, key: Optional[str]) -> str:
    if not key:
        return ""
    v = row.get(key)
    if v is None:
        return ""
    return str(v).strip()


def _serialize_quality_dataset_binding(row: Optional[HaoligoQualityDatasetBinding]) -> QualityDatasetBindingOut:
    if not row:
        return QualityDatasetBindingOut()
    return QualityDatasetBindingOut(
        dataset_uuid=row.dataset_uuid,
        work_order_param_key=row.work_order_param_key,
        workshop_name_column=row.workshop_name_column,
        production_line_column=row.production_line_column,
        equipment_asset_code_column=row.equipment_asset_code_column,
        mold_code_column=row.mold_code_column,
        finished_product_code_column=row.finished_product_code_column,
        finished_product_name_column=row.finished_product_name_column,
    )


async def _resolve_workshop_id_by_name(tenant_id: int, workshop_name: str) -> Optional[int]:
    name = (workshop_name or "").strip()
    if not name:
        return None
    row = await tenant_alive(HaoligoWorkshop, tenant_id).filter(name=name).first()
    if row:
        return row.id
    row = await tenant_alive(HaoligoWorkshop, tenant_id).filter(code=name).first()
    return row.id if row else None


async def _resolve_equipment_id_by_asset_code(tenant_id: int, asset_code: str) -> Optional[int]:
    code = (asset_code or "").strip()
    if not code:
        return None
    row = await tenant_alive(HaoligoEquipment, tenant_id).filter(asset_code=code).first()
    return row.id if row else None


async def _scan_work_order_snapshot(tenant_id: int, work_order_no: str) -> WorkOrderScanOut:
    wo = (work_order_no or "").strip()
    if not wo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="制令单号不能为空")

    binding = await tenant_alive(HaoligoQualityDatasetBinding, tenant_id).first()
    if not binding or not (binding.dataset_uuid or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先在品质单据列表工具栏「数据集」中配置 ERP 制令单数据集",
        )
    ds_uuid = binding.dataset_uuid.strip()
    param_key = (binding.work_order_param_key or "").strip()
    if not param_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="数据集绑定缺少制令单号查询参数名")

    svc = DatasetService()
    res = await svc.execute_query(
        tenant_id,
        UUID(ds_uuid),
        ExecuteQueryRequest(parameters={param_key: wo}, limit=10, offset=0),
    )
    if not res.success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=res.error or "数据集查询失败",
        )
    rows = list(res.data or [])
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未查询到与制令单号匹配的 ERP 数据，请检查参数名与数据集 SQL",
        )
    raw = rows[0] if isinstance(rows[0], dict) else {}

    ws_name_c = (binding.workshop_name_column or "").strip() or None
    pl_c = (binding.production_line_column or "").strip() or None
    eq_c = (binding.equipment_asset_code_column or "").strip() or None
    mold_c = (binding.mold_code_column or "").strip() or None
    fcode_c = (binding.finished_product_code_column or "").strip() or None
    fname_c = (binding.finished_product_name_column or "").strip() or None

    workshop_id = await _resolve_workshop_id_by_name(tenant_id, _dataset_cell_str(raw, ws_name_c))
    equipment_id = await _resolve_equipment_id_by_asset_code(tenant_id, _dataset_cell_str(raw, eq_c))
    mold_code = parse_erp_mold_code(_dataset_cell_str(raw, mold_c)) if mold_c else ""
    material_code = _dataset_cell_str(raw, fcode_c) if fcode_c else ""
    model_name = _dataset_cell_str(raw, fname_c) if fname_c else ""
    production_line = _dataset_cell_str(raw, pl_c) if pl_c else ""

    return WorkOrderScanOut(
        work_order_no=wo,
        workshop_id=workshop_id,
        production_line=production_line[:200] if production_line else None,
        equipment_id=equipment_id,
        material_code_snapshot=material_code[:128] if material_code else None,
        model_snapshot=model_name[:128] if model_name else None,
        mold_code_snapshot=mold_code[:128] if mold_code else None,
    )


async def _dispatch_overdue_for_model(tenant_id: int, model: Any, doc_type: str) -> OverdueDispatchResult:
    now = timezone.now()
    overdue_before = now - timedelta(days=1)
    qs = tenant_alive(model, tenant_id).filter(status__in=["assigned", "processing"])
    temp_rows = await qs.filter(
        temporary_submitted_at__isnull=False,
        temporary_due_at__isnull=False,
        temporary_due_at__lt=overdue_before,
    ).all()
    long_rows = await qs.filter(
        long_term_submitted_at__isnull=False,
        long_term_due_at__isnull=False,
        long_term_due_at__lt=overdue_before,
    ).all()
    res = OverdueDispatchResult()
    for row in temp_rows:
        await _dispatch_quality_notification(
            tenant_id,
            doc_type=doc_type,
            action=ACTION_TEMPORARY_OVERDUE,
            row_id=row.id,
            sheet_no=row.sheet_no or "",
            title=row.title or "",
            recipient_user_id=None,
            user_specified_user_ids=_row_temporary_overdue_notify_user_ids(row),
        )
        res.temporary_overdue += 1
    for row in long_rows:
        await _dispatch_quality_notification(
            tenant_id,
            doc_type=doc_type,
            action=ACTION_LONG_TERM_OVERDUE,
            row_id=row.id,
            sheet_no=row.sheet_no or "",
            title=row.title or "",
            recipient_user_id=None,
            user_specified_user_ids=_row_long_term_overdue_notify_user_ids(row),
        )
        res.long_term_overdue += 1
    return res


async def _dispatch_quality_notification(
    tenant_id: int,
    *,
    doc_type: str,
    action: str,
    row_id: int,
    sheet_no: str,
    title: str,
    recipient_user_id: Optional[int],
    user_specified_user_ids: List[int],
) -> None:
    await dispatch_haoligo_notification(
        tenant_id,
        trigger_document=doc_type,
        trigger_action=action,
        variables={
            "sheet_no": sheet_no,
            "title": title or sheet_no,
            "detail_path": f"/apps/haoligo/quality/{row_id}",
        },
        context={
            "reporter_user_id": recipient_user_id,
            "user_specified": user_specified_user_ids,
        },
    )


@router.get("/work-order-dataset-binding", response_model=QualityDatasetBindingOut, summary="品质制令单 ERP 数据集配置")
async def get_quality_work_order_dataset_binding(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityDatasetBinding, tenant_id).first()
    return _serialize_quality_dataset_binding(row)


@router.put("/work-order-dataset-binding", response_model=QualityDatasetBindingOut, summary="保存品质制令单 ERP 数据集配置")
async def put_quality_work_order_dataset_binding(
    body: QualityDatasetBindingUpsert,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    ds = (body.dataset_uuid or "").strip()
    if not ds:
        await HaoligoQualityDatasetBinding.filter(tenant_id=tenant_id).delete()
        return QualityDatasetBindingOut()

    pk = (body.work_order_param_key or "").strip()
    if not pk:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="已选择数据集时，请填写制令单号对应的查询参数名（与 SQL 占位符一致）",
        )

    await HaoligoQualityDatasetBinding.filter(tenant_id=tenant_id).delete()
    row = await HaoligoQualityDatasetBinding.create(
        tenant_id=tenant_id,
        dataset_uuid=ds,
        work_order_param_key=pk,
        workshop_name_column=(body.workshop_name_column or "").strip() or None,
        production_line_column=(body.production_line_column or "").strip() or None,
        equipment_asset_code_column=(body.equipment_asset_code_column or "").strip() or None,
        mold_code_column=(body.mold_code_column or "").strip() or None,
        finished_product_code_column=(body.finished_product_code_column or "").strip() or None,
        finished_product_name_column=(body.finished_product_name_column or "").strip() or None,
    )
    return _serialize_quality_dataset_binding(row)


@router.post("/scan-work-order", response_model=WorkOrderScanOut, summary="扫描制令单从 ERP 数据集带出关联信息")
async def scan_work_order(
    body: WorkOrderScanPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    return await _scan_work_order_snapshot(tenant_id, body.work_order_no)


@router.post("/workflow/dispatch-overdue-reminders", response_model=OverdueDispatchResult, summary="触发逾期提醒分发")
async def dispatch_overdue_reminders(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    issue_res = await _dispatch_overdue_for_model(
        tenant_id,
        HaoligoQualityIssueTracking,
        DOC_QUALITY_ISSUE_TRACKING,
    )
    complaint_res = await _dispatch_overdue_for_model(
        tenant_id,
        HaoligoCustomerComplaint,
        DOC_CUSTOMER_COMPLAINT,
    )
    stop_res = await _dispatch_overdue_for_model(
        tenant_id,
        HaoligoLineStopFeedback,
        DOC_LINE_STOP_FEEDBACK,
    )
    return OverdueDispatchResult(
        temporary_overdue=issue_res.temporary_overdue + complaint_res.temporary_overdue + stop_res.temporary_overdue,
        long_term_overdue=issue_res.long_term_overdue + complaint_res.long_term_overdue + stop_res.long_term_overdue,
    )


issues_router = APIRouter(
    prefix="/issues",
    tags=["App · HaoliGO · 品质问题跟踪"],
    dependencies=[Depends(require_haoligo_module_access("quality-issue-tracking"))],
)


@issues_router.get("", response_model=_PageOut, summary="品质问题分页")
async def list_quality_issues(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None),
    assigned_to_me: bool = Query(
        False,
        description="仅个人待办队列（与 /mobile/todo-badges 口径一致）",
    ),
):
    qs = tenant_alive(HaoligoQualityIssueTracking, tenant_id)
    if status_filter:
        qs = qs.filter(status=_ensure_status(status_filter))
    k = (keyword or "").strip()
    if k:
        qs = qs.filter(Q(sheet_no__icontains=k) | Q(title__icontains=k) | Q(problem_description__icontains=k))
    if assigned_to_me:
        from apps.haoligo.services.mobile_assigned_to_me import apply_assigned_to_me_quality_handle

        if not status_filter:
            qs = qs.filter(status__in=["assigned", "processing"])
        qs = await apply_assigned_to_me_quality_handle(qs, user)
    total = await qs.count()
    rows = await qs.order_by("-reported_at", "-id").offset(skip).limit(limit)
    items = [await _serialize_common(r, tenant_id, QualityIssueOut) for r in rows]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@issues_router.post("", response_model=QualityIssueOut, summary="创建品质问题")
async def create_quality_issue(
    body: QualityIssueCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    await _ensure_relations(tenant_id, body.workshop_id, body.equipment_id)
    _require_register_fields(
        problem_description=body.problem_description,
        workshop_id=body.workshop_id,
        defect_qty=body.defect_qty,
    )
    _require_issue_kind(body.issue_kind)
    issue_kind = _normalize_issue_kind(body.issue_kind)
    _validate_issue_qty_fields(
        planned_qty=body.planned_qty,
        completed_qty=body.completed_qty,
        defect_qty=body.defect_qty,
    )
    defect_rate = _resolve_issue_defect_rate(completed_qty=body.completed_qty, defect_qty=body.defect_qty)
    notify_user_ids = await _normalize_notify_users(tenant_id, body.notify_user_ids)
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, body.overdue_notify_user_ids)
    reg_uid, reg_name, rsp_uid, rsp_name = await _resolve_people(
        tenant_id,
        current_user=user,
        registrant_user_id=body.registrant_user_id,
        responsible_user_id=body.responsible_user_id,
    )
    issue_codes = [str(x).strip() for x in body.issue_type_codes if str(x).strip()]
    sheet_no = _gen_sheet_no("QI")
    async with in_transaction():
        row = await HaoligoQualityIssueTracking.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            title=_resolve_quality_record_title(
                title=body.title,
                problem_description=body.problem_description,
                work_order_no=body.work_order_no,
                sheet_no=sheet_no,
            ),
            workshop_id=body.workshop_id,
            production_line=body.production_line,
            work_order_no=body.work_order_no,
            material_code_snapshot=body.material_code_snapshot,
            model_snapshot=body.model_snapshot,
            mold_code_snapshot=body.mold_code_snapshot,
            equipment_id=body.equipment_id,
            problem_description=body.problem_description,
            immediate_action=body.immediate_action,
            long_term_action=body.long_term_action,
            due_at=body.due_at,
            temporary_due_at=body.temporary_due_at,
            long_term_due_at=body.long_term_due_at,
            status="registered",
            attachment_file_uuids=body.attachment_file_uuids,
            registrant_user_id=reg_uid,
            registrant_name=reg_name,
            responsible_user_id=rsp_uid,
            responsible_name=rsp_name,
            responsible_user_ids=responsible_user_ids,
            overdue_notify_user_ids=overdue_notify_user_ids,
            notify_user_ids=notify_user_ids,
            reported_at=body.reported_at or timezone.now(),
            issue_type_codes=issue_codes,
            issue_kind=issue_kind,
            planned_qty=body.planned_qty,
            completed_qty=body.completed_qty,
            defect_qty=body.defect_qty,
            defect_rate=defect_rate,
        )
    return await _serialize_common(row, tenant_id, QualityIssueOut)


@issues_router.get("/{row_id}", response_model=QualityIssueOut, summary="品质问题详情")
async def get_quality_issue(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    return await _serialize_common(row, tenant_id, QualityIssueOut)


@issues_router.patch("/{row_id}", response_model=QualityIssueOut, summary="更新品质问题")
async def update_quality_issue(
    row_id: int,
    body: QualityIssueUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    data = body.model_dump(exclude_unset=True)
    await _ensure_relations(tenant_id, data.get("workshop_id"), data.get("equipment_id"))
    if "notify_user_ids" in data:
        data["notify_user_ids"] = await _normalize_notify_users(tenant_id, data["notify_user_ids"])
    if "responsible_user_ids" in data:
        data["responsible_user_ids"] = await _normalize_responsible_users(tenant_id, data["responsible_user_ids"])
    if "overdue_notify_user_ids" in data:
        data["overdue_notify_user_ids"] = await _normalize_overdue_notify_users(tenant_id, data["overdue_notify_user_ids"])
    if "temporary_overdue_notify_user_ids" in data:
        data["temporary_overdue_notify_user_ids"] = await _normalize_overdue_notify_users(
            tenant_id,
            data["temporary_overdue_notify_user_ids"],
        )
    if "long_term_overdue_notify_user_ids" in data:
        data["long_term_overdue_notify_user_ids"] = await _normalize_overdue_notify_users(
            tenant_id,
            data["long_term_overdue_notify_user_ids"],
        )
    if "responsible_user_id" in data and data["responsible_user_id"] is not None:
        uid, name = await resolve_tenant_user(tenant_id, int(data["responsible_user_id"]))
        data["responsible_user_id"] = uid
        data["responsible_name"] = name
    if "status" in data:
        data["status"] = _ensure_status(data["status"])
    if "issue_type_codes" in data and data["issue_type_codes"] is not None:
        data["issue_type_codes"] = [str(x).strip() for x in data["issue_type_codes"] if str(x).strip()]
    if "issue_kind" in data:
        data["issue_kind"] = _normalize_issue_kind(data.get("issue_kind"))
    if any(k in data for k in ("planned_qty", "completed_qty", "defect_qty")):
        _validate_issue_qty_fields(
            planned_qty=data.get("planned_qty", row.planned_qty),
            completed_qty=data.get("completed_qty", row.completed_qty),
            defect_qty=data.get("defect_qty", row.defect_qty),
        )
        completed_qty = data.get("completed_qty", row.completed_qty)
        defect_qty = data.get("defect_qty", row.defect_qty)
        data["defect_rate"] = _resolve_issue_defect_rate(completed_qty=completed_qty, defect_qty=defect_qty)
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return await _serialize_common(row, tenant_id, QualityIssueOut)


@issues_router.post("/{row_id}/workflow/register-submit", response_model=QualityIssueOut, summary="品质问题登记提交")
async def submit_quality_issue_register(
    row_id: int,
    body: RegisterSubmitPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"registered", "assigned", "processing"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能执行登记提交")
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    recipients = normalize_report_user_ids(responsible_user_ids)
    if not recipients:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先选择车间品质/工程负责人")
    row.responsible_user_ids = recipients
    row.responsible_user_id = recipients[0]
    row.status = "processing"
    await row.save()
    await _dispatch_quality_notification(
        tenant_id,
        doc_type=DOC_QUALITY_ISSUE_TRACKING,
        action=ACTION_SUBMITTED,
        row_id=row.id,
        sheet_no=row.sheet_no or "",
        title=row.title or "",
        recipient_user_id=row.responsible_user_id,
        user_specified_user_ids=recipients[1:] + normalize_report_user_ids(row.notify_user_ids),
    )
    return await _serialize_common(row, tenant_id, QualityIssueOut)


@issues_router.post("/{row_id}/workflow/temporary-action", response_model=QualityIssueOut, summary="提交临时措施")
async def submit_quality_issue_temporary_action(
    row_id: int,
    body: TemporaryActionPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"processing", "assigned"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能提交临时措施")
    if body.responsible_user_ids:
        responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
        if responsible_user_ids:
            row.responsible_user_ids = responsible_user_ids
            row.responsible_user_id = responsible_user_ids[0]
    if body.overdue_notify_user_ids:
        row.overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, body.overdue_notify_user_ids)
    temp_overdue_ids = body.temporary_overdue_notify_user_ids or body.overdue_notify_user_ids
    if temp_overdue_ids:
        row.temporary_overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, temp_overdue_ids)
    row.temporary_action = body.temporary_action.strip()
    row.temporary_due_at = body.temporary_due_at
    row.temporary_action_image_uuids = [str(x).strip() for x in body.temporary_action_image_uuids if str(x).strip()]
    row.temporary_submitted_at = timezone.now()
    row.immediate_action = row.temporary_action
    row.due_at = row.temporary_due_at
    await row.save()
    return await _serialize_common(row, tenant_id, QualityIssueOut)


@issues_router.post("/{row_id}/workflow/long-term-action", response_model=QualityIssueOut, summary="提交长期措施")
async def submit_quality_issue_long_term_action(
    row_id: int,
    body: LongTermActionPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if not row.temporary_submitted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先提交临时措施")
    row.long_term_action = body.long_term_action.strip()
    row.long_term_due_at = body.long_term_due_at
    row.long_term_action_image_uuids = [str(x).strip() for x in body.long_term_action_image_uuids if str(x).strip()]
    row.long_term_submitted_at = timezone.now()
    await row.save()
    return await _serialize_common(row, tenant_id, QualityIssueOut)


@issues_router.post("/{row_id}/workflow/handle-measures", response_model=QualityIssueOut, summary="提交处理措施（临时+长期）")
async def submit_quality_issue_handle_measures(
    row_id: int,
    body: HandleMeasuresPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"processing", "assigned"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能提交处理措施")
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    if not responsible_user_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先选择责任人")
    overdue_notify_user_ids, temporary_overdue_notify_user_ids, long_term_overdue_notify_user_ids = (
        await _prepare_split_overdue_notify_users(tenant_id, body)
    )
    now = timezone.now()
    row.responsible_user_ids = responsible_user_ids
    row.responsible_user_id = responsible_user_ids[0]
    row.overdue_notify_user_ids = overdue_notify_user_ids
    row.temporary_overdue_notify_user_ids = temporary_overdue_notify_user_ids
    row.long_term_overdue_notify_user_ids = long_term_overdue_notify_user_ids
    _apply_handle_measures(row, body, now)
    await row.save()
    return await _serialize_common(row, tenant_id, QualityIssueOut)


@issues_router.post("/{row_id}/workflow/confirm-close", response_model=QualityIssueOut, summary="问题结案确认")
async def confirm_quality_issue_close(
    row_id: int,
    body: CloseConfirmPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if not row.temporary_submitted_at or not row.long_term_submitted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="临时与长期措施完成后才能结案")
    row.status = "completed"
    row.completed_at = timezone.now()
    row.close_note = (body.close_note or "").strip() or None
    row.close_confirmer_user_id = int(user.id)
    row.close_confirmed_at = timezone.now()
    await row.save()
    await _dispatch_quality_notification(
        tenant_id,
        doc_type=DOC_QUALITY_ISSUE_TRACKING,
        action=ACTION_COMPLETED,
        row_id=row.id,
        sheet_no=row.sheet_no or "",
        title=row.title or "",
        recipient_user_id=row.registrant_user_id,
        user_specified_user_ids=[],
    )
    return await _serialize_common(row, tenant_id, QualityIssueOut)


@issues_router.post("/{row_id}/submit", response_model=QualityIssueOut, summary="兼容：登记提交")
async def submit_quality_issue(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    body = RegisterSubmitPayload(
        responsible_user_ids=normalize_report_user_ids(row.responsible_user_ids or ([row.responsible_user_id] if row.responsible_user_id else [])),
        overdue_notify_user_ids=normalize_report_user_ids(row.overdue_notify_user_ids),
    )
    return await submit_quality_issue_register(row_id, body, tenant_id, _)


@issues_router.post("/{row_id}/complete", response_model=QualityIssueOut, summary="兼容：结案确认")
async def complete_quality_issue(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    body = CloseConfirmPayload()
    return await confirm_quality_issue_close(row_id, body, tenant_id, user)


@issues_router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除品质问题")
async def delete_quality_issue(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoQualityIssueTracking, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    row.deleted_at = timezone.now()
    await row.save()


complaints_router = APIRouter(
    prefix="/complaints",
    tags=["App · HaoliGO · 客户投诉"],
    dependencies=[Depends(require_haoligo_module_access("customer-complaint"))],
)


@complaints_router.get("", response_model=_PageOut, summary="客户投诉分页")
async def list_customer_complaints(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None),
    assigned_to_me: bool = Query(
        False,
        description="仅个人待办队列（与 /mobile/todo-badges 口径一致）",
    ),
):
    qs = tenant_alive(HaoligoCustomerComplaint, tenant_id)
    if status_filter:
        qs = qs.filter(status=_ensure_status(status_filter))
    k = (keyword or "").strip()
    if k:
        qs = qs.filter(Q(sheet_no__icontains=k) | Q(title__icontains=k) | Q(customer_name__icontains=k))
    if assigned_to_me:
        from apps.haoligo.services.mobile_assigned_to_me import apply_assigned_to_me_quality_handle

        if not status_filter:
            qs = qs.filter(status__in=["assigned", "processing"])
        qs = await apply_assigned_to_me_quality_handle(qs, user)
    total = await qs.count()
    rows = await qs.order_by("-reported_at", "-id").offset(skip).limit(limit)
    items = [await _serialize_common(r, tenant_id, CustomerComplaintOut) for r in rows]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@complaints_router.post("", response_model=CustomerComplaintOut, summary="创建客户投诉")
async def create_customer_complaint(
    body: CustomerComplaintCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    await _ensure_relations(tenant_id, body.workshop_id, body.equipment_id)
    _require_complaint_register_fields(
        customer_name=body.customer_name,
        problem_description=body.problem_description,
    )
    notify_user_ids = await _normalize_notify_users(tenant_id, body.notify_user_ids)
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, body.overdue_notify_user_ids)
    reg_uid, reg_name, rsp_uid, rsp_name = await _resolve_people(
        tenant_id,
        current_user=user,
        registrant_user_id=body.registrant_user_id,
        responsible_user_id=body.responsible_user_id,
    )
    sheet_no = _gen_sheet_no("QC")
    row = await HaoligoCustomerComplaint.create(
        tenant_id=tenant_id,
        sheet_no=sheet_no,
        title=_resolve_quality_record_title(
            title=body.title,
            problem_description=body.problem_description,
            customer_name=body.customer_name,
            work_order_no=body.work_order_no,
            sheet_no=sheet_no,
        ),
        workshop_id=body.workshop_id,
        production_line=body.production_line,
        work_order_no=body.work_order_no,
        material_code_snapshot=body.material_code_snapshot or body.material_code,
        model_snapshot=body.model_snapshot or body.model,
        mold_code_snapshot=body.mold_code_snapshot,
        equipment_id=body.equipment_id,
        problem_description=body.problem_description,
        immediate_action=body.immediate_action,
        long_term_action=body.long_term_action,
        due_at=body.due_at,
        temporary_due_at=body.temporary_due_at,
        long_term_due_at=body.long_term_due_at,
        status="registered",
        attachment_file_uuids=body.attachment_file_uuids,
        registrant_user_id=reg_uid,
        registrant_name=reg_name,
        responsible_user_id=rsp_uid,
        responsible_name=rsp_name,
        responsible_user_ids=responsible_user_ids,
        overdue_notify_user_ids=overdue_notify_user_ids,
        notify_user_ids=notify_user_ids,
        reported_at=body.reported_at or timezone.now(),
        customer_name=body.customer_name,
        material_code=body.material_code,
        model=body.model,
        quantity=body.quantity,
        claim_amount=body.claim_amount,
    )
    return await _serialize_common(row, tenant_id, CustomerComplaintOut)


@complaints_router.get("/{row_id}", response_model=CustomerComplaintOut, summary="客户投诉详情")
async def get_customer_complaint(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    return await _serialize_common(row, tenant_id, CustomerComplaintOut)


@complaints_router.patch("/{row_id}", response_model=CustomerComplaintOut, summary="更新客户投诉")
async def update_customer_complaint(
    row_id: int,
    body: CustomerComplaintUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    data = body.model_dump(exclude_unset=True)
    await _ensure_relations(tenant_id, data.get("workshop_id"), data.get("equipment_id"))
    if "notify_user_ids" in data:
        data["notify_user_ids"] = await _normalize_notify_users(tenant_id, data["notify_user_ids"])
    if "responsible_user_ids" in data:
        data["responsible_user_ids"] = await _normalize_responsible_users(tenant_id, data["responsible_user_ids"])
    if "overdue_notify_user_ids" in data:
        data["overdue_notify_user_ids"] = await _normalize_overdue_notify_users(tenant_id, data["overdue_notify_user_ids"])
    if "temporary_overdue_notify_user_ids" in data:
        data["temporary_overdue_notify_user_ids"] = await _normalize_overdue_notify_users(
            tenant_id,
            data["temporary_overdue_notify_user_ids"],
        )
    if "long_term_overdue_notify_user_ids" in data:
        data["long_term_overdue_notify_user_ids"] = await _normalize_overdue_notify_users(
            tenant_id,
            data["long_term_overdue_notify_user_ids"],
        )
    if "responsible_user_id" in data and data["responsible_user_id"] is not None:
        uid, name = await resolve_tenant_user(tenant_id, int(data["responsible_user_id"]))
        data["responsible_user_id"] = uid
        data["responsible_name"] = name
    if "status" in data:
        data["status"] = _ensure_status(data["status"])
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return await _serialize_common(row, tenant_id, CustomerComplaintOut)


@complaints_router.post("/{row_id}/workflow/register-submit", response_model=CustomerComplaintOut, summary="客户投诉登记提交")
async def submit_customer_complaint_register(
    row_id: int,
    body: RegisterSubmitPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"registered", "assigned", "processing"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能执行登记提交")
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    recipients = normalize_report_user_ids(responsible_user_ids)
    if not recipients:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先选择责任人")
    row.responsible_user_ids = recipients
    row.responsible_user_id = recipients[0]
    row.status = "processing"
    await row.save()
    await _dispatch_quality_notification(
        tenant_id,
        doc_type=DOC_CUSTOMER_COMPLAINT,
        action=ACTION_SUBMITTED,
        row_id=row.id,
        sheet_no=row.sheet_no or "",
        title=row.title or "",
        recipient_user_id=row.responsible_user_id,
        user_specified_user_ids=recipients[1:] + normalize_report_user_ids(row.notify_user_ids),
    )
    return await _serialize_common(row, tenant_id, CustomerComplaintOut)


@complaints_router.post("/{row_id}/workflow/temporary-action", response_model=CustomerComplaintOut, summary="提交临时措施")
async def submit_customer_complaint_temporary_action(
    row_id: int,
    body: TemporaryActionPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"processing", "assigned"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能提交临时措施")
    if body.responsible_user_ids:
        responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
        if responsible_user_ids:
            row.responsible_user_ids = responsible_user_ids
            row.responsible_user_id = responsible_user_ids[0]
    if body.overdue_notify_user_ids:
        row.overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, body.overdue_notify_user_ids)
    temp_overdue_ids = body.temporary_overdue_notify_user_ids or body.overdue_notify_user_ids
    if temp_overdue_ids:
        row.temporary_overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, temp_overdue_ids)
    row.temporary_action = body.temporary_action.strip()
    row.temporary_due_at = body.temporary_due_at
    row.temporary_action_image_uuids = [str(x).strip() for x in body.temporary_action_image_uuids if str(x).strip()]
    row.temporary_submitted_at = timezone.now()
    row.immediate_action = row.temporary_action
    row.due_at = row.temporary_due_at
    await row.save()
    return await _serialize_common(row, tenant_id, CustomerComplaintOut)


@complaints_router.post("/{row_id}/workflow/long-term-action", response_model=CustomerComplaintOut, summary="提交长期措施")
async def submit_customer_complaint_long_term_action(
    row_id: int,
    body: LongTermActionPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if not row.temporary_submitted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先提交临时措施")
    row.long_term_action = body.long_term_action.strip()
    row.long_term_due_at = body.long_term_due_at
    row.long_term_action_image_uuids = [str(x).strip() for x in body.long_term_action_image_uuids if str(x).strip()]
    row.long_term_submitted_at = timezone.now()
    await row.save()
    return await _serialize_common(row, tenant_id, CustomerComplaintOut)


@complaints_router.post("/{row_id}/workflow/handle-measures", response_model=CustomerComplaintOut, summary="提交处理措施（临时+长期）")
async def submit_customer_complaint_handle_measures(
    row_id: int,
    body: HandleMeasuresPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"processing", "assigned"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能提交处理措施")
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    if not responsible_user_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先选择责任人")
    overdue_notify_user_ids, temporary_overdue_notify_user_ids, long_term_overdue_notify_user_ids = (
        await _prepare_split_overdue_notify_users(tenant_id, body)
    )
    now = timezone.now()
    row.responsible_user_ids = responsible_user_ids
    row.responsible_user_id = responsible_user_ids[0]
    row.overdue_notify_user_ids = overdue_notify_user_ids
    row.temporary_overdue_notify_user_ids = temporary_overdue_notify_user_ids
    row.long_term_overdue_notify_user_ids = long_term_overdue_notify_user_ids
    _apply_handle_measures(row, body, now)
    await row.save()
    return await _serialize_common(row, tenant_id, CustomerComplaintOut)


@complaints_router.post("/{row_id}/workflow/confirm-close", response_model=CustomerComplaintOut, summary="问题结案确认")
async def confirm_customer_complaint_close(
    row_id: int,
    body: CloseConfirmPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if not row.temporary_submitted_at or not row.long_term_submitted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="临时与长期措施完成后才能结案")
    row.status = "completed"
    row.completed_at = timezone.now()
    row.close_note = (body.close_note or "").strip() or None
    row.close_confirmer_user_id = int(user.id)
    row.close_confirmed_at = timezone.now()
    await row.save()
    await _dispatch_quality_notification(
        tenant_id,
        doc_type=DOC_CUSTOMER_COMPLAINT,
        action=ACTION_COMPLETED,
        row_id=row.id,
        sheet_no=row.sheet_no or "",
        title=row.title or "",
        recipient_user_id=row.registrant_user_id,
        user_specified_user_ids=[],
    )
    return await _serialize_common(row, tenant_id, CustomerComplaintOut)


@complaints_router.post("/{row_id}/submit", response_model=CustomerComplaintOut, summary="兼容：登记提交")
async def submit_customer_complaint(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    body = RegisterSubmitPayload(
        responsible_user_ids=normalize_report_user_ids(row.responsible_user_ids or ([row.responsible_user_id] if row.responsible_user_id else [])),
        overdue_notify_user_ids=normalize_report_user_ids(row.overdue_notify_user_ids),
    )
    return await submit_customer_complaint_register(row_id, body, tenant_id, _)


@complaints_router.post("/{row_id}/complete", response_model=CustomerComplaintOut, summary="兼容：结案确认")
async def complete_customer_complaint(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    body = CloseConfirmPayload()
    return await confirm_customer_complaint_close(row_id, body, tenant_id, user)


@complaints_router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除客户投诉")
async def delete_customer_complaint(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoCustomerComplaint, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    row.deleted_at = timezone.now()
    await row.save()


line_stops_router = APIRouter(
    prefix="/line-stops",
    tags=["App · HaoliGO · 停线反馈"],
    dependencies=[Depends(require_haoligo_module_access("line-stop-feedback"))],
)


@line_stops_router.get("", response_model=_PageOut, summary="停线反馈分页")
async def list_line_stop_feedbacks(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(None),
    assigned_to_me: bool = Query(
        False,
        description="仅个人待办队列（与 /mobile/todo-badges 口径一致）",
    ),
):
    qs = tenant_alive(HaoligoLineStopFeedback, tenant_id)
    if status_filter:
        qs = qs.filter(status=_ensure_status(status_filter))
    k = (keyword or "").strip()
    if k:
        qs = qs.filter(Q(sheet_no__icontains=k) | Q(title__icontains=k) | Q(stop_reason__icontains=k))
    if assigned_to_me:
        from apps.haoligo.services.mobile_assigned_to_me import apply_assigned_to_me_quality_handle

        if not status_filter:
            qs = qs.filter(status__in=["assigned", "processing"])
        qs = await apply_assigned_to_me_quality_handle(qs, user)
    total = await qs.count()
    rows = await qs.order_by("-reported_at", "-id").offset(skip).limit(limit)
    items = [await _serialize_common(r, tenant_id, LineStopOut) for r in rows]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@line_stops_router.post("", response_model=LineStopOut, summary="创建停线反馈")
async def create_line_stop_feedback(
    body: LineStopCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    await _ensure_relations(tenant_id, body.workshop_id, body.equipment_id)
    _require_register_fields(
        problem_description=body.stop_reason or body.problem_description,
        workshop_id=body.workshop_id,
    )
    notify_user_ids = await _normalize_notify_users(tenant_id, body.notify_user_ids)
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, body.overdue_notify_user_ids)
    reg_uid, reg_name, rsp_uid, rsp_name = await _resolve_people(
        tenant_id,
        current_user=user,
        registrant_user_id=body.registrant_user_id,
        responsible_user_id=body.responsible_user_id,
    )
    sheet_no = _gen_sheet_no("LS")
    row = await HaoligoLineStopFeedback.create(
        tenant_id=tenant_id,
        sheet_no=sheet_no,
        title=_resolve_quality_record_title(
            title=body.title,
            problem_description=body.problem_description,
            stop_reason=body.stop_reason,
            work_order_no=body.work_order_no,
            sheet_no=sheet_no,
        ),
        workshop_id=body.workshop_id,
        production_line=body.production_line,
        work_order_no=body.work_order_no,
        material_code_snapshot=body.material_code_snapshot,
        model_snapshot=body.model_snapshot,
        mold_code_snapshot=body.mold_code_snapshot,
        equipment_id=body.equipment_id,
        problem_description=body.problem_description,
        immediate_action=body.immediate_action,
        long_term_action=body.long_term_action,
        due_at=body.due_at,
        temporary_due_at=body.temporary_due_at,
        long_term_due_at=body.long_term_due_at,
        status="registered",
        attachment_file_uuids=body.attachment_file_uuids,
        registrant_user_id=reg_uid,
        registrant_name=reg_name,
        responsible_user_id=rsp_uid,
        responsible_name=rsp_name,
        responsible_user_ids=responsible_user_ids,
        overdue_notify_user_ids=overdue_notify_user_ids,
        notify_user_ids=notify_user_ids,
        reported_at=body.reported_at or timezone.now(),
        stop_kind=body.stop_kind,
        stop_reason=body.stop_reason,
        stop_started_at=body.stop_started_at,
        recovered_at=body.recovered_at,
    )
    return await _serialize_common(row, tenant_id, LineStopOut)


@line_stops_router.get("/{row_id}", response_model=LineStopOut, summary="停线反馈详情")
async def get_line_stop_feedback(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    return await _serialize_common(row, tenant_id, LineStopOut)


@line_stops_router.patch("/{row_id}", response_model=LineStopOut, summary="更新停线反馈")
async def update_line_stop_feedback(
    row_id: int,
    body: LineStopUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    data = body.model_dump(exclude_unset=True)
    await _ensure_relations(tenant_id, data.get("workshop_id"), data.get("equipment_id"))
    if "notify_user_ids" in data:
        data["notify_user_ids"] = await _normalize_notify_users(tenant_id, data["notify_user_ids"])
    if "responsible_user_ids" in data:
        data["responsible_user_ids"] = await _normalize_responsible_users(tenant_id, data["responsible_user_ids"])
    if "overdue_notify_user_ids" in data:
        data["overdue_notify_user_ids"] = await _normalize_overdue_notify_users(tenant_id, data["overdue_notify_user_ids"])
    if "temporary_overdue_notify_user_ids" in data:
        data["temporary_overdue_notify_user_ids"] = await _normalize_overdue_notify_users(
            tenant_id,
            data["temporary_overdue_notify_user_ids"],
        )
    if "long_term_overdue_notify_user_ids" in data:
        data["long_term_overdue_notify_user_ids"] = await _normalize_overdue_notify_users(
            tenant_id,
            data["long_term_overdue_notify_user_ids"],
        )
    if "responsible_user_id" in data and data["responsible_user_id"] is not None:
        uid, name = await resolve_tenant_user(tenant_id, int(data["responsible_user_id"]))
        data["responsible_user_id"] = uid
        data["responsible_name"] = name
    if "status" in data:
        data["status"] = _ensure_status(data["status"])
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return await _serialize_common(row, tenant_id, LineStopOut)


@line_stops_router.post("/{row_id}/workflow/register-submit", response_model=LineStopOut, summary="停线反馈登记提交")
async def submit_line_stop_feedback_register(
    row_id: int,
    body: RegisterSubmitPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"registered", "assigned", "processing"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能执行登记提交")
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    recipients = normalize_report_user_ids(responsible_user_ids)
    if not recipients:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先选择责任人")
    row.responsible_user_ids = recipients
    row.responsible_user_id = recipients[0]
    row.status = "processing"
    await row.save()
    await _dispatch_quality_notification(
        tenant_id,
        doc_type=DOC_LINE_STOP_FEEDBACK,
        action=ACTION_SUBMITTED,
        row_id=row.id,
        sheet_no=row.sheet_no or "",
        title=row.title or "",
        recipient_user_id=row.responsible_user_id,
        user_specified_user_ids=recipients[1:] + normalize_report_user_ids(row.notify_user_ids),
    )
    return await _serialize_common(row, tenant_id, LineStopOut)


@line_stops_router.post("/{row_id}/workflow/temporary-action", response_model=LineStopOut, summary="提交临时措施")
async def submit_line_stop_feedback_temporary_action(
    row_id: int,
    body: TemporaryActionPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"processing", "assigned"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能提交临时措施")
    if body.responsible_user_ids:
        responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
        if responsible_user_ids:
            row.responsible_user_ids = responsible_user_ids
            row.responsible_user_id = responsible_user_ids[0]
    if body.overdue_notify_user_ids:
        row.overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, body.overdue_notify_user_ids)
    temp_overdue_ids = body.temporary_overdue_notify_user_ids or body.overdue_notify_user_ids
    if temp_overdue_ids:
        row.temporary_overdue_notify_user_ids = await _normalize_overdue_notify_users(tenant_id, temp_overdue_ids)
    row.temporary_action = body.temporary_action.strip()
    row.temporary_due_at = body.temporary_due_at
    row.temporary_action_image_uuids = [str(x).strip() for x in body.temporary_action_image_uuids if str(x).strip()]
    row.temporary_submitted_at = timezone.now()
    row.immediate_action = row.temporary_action
    row.due_at = row.temporary_due_at
    await row.save()
    return await _serialize_common(row, tenant_id, LineStopOut)


@line_stops_router.post("/{row_id}/workflow/long-term-action", response_model=LineStopOut, summary="提交长期措施")
async def submit_line_stop_feedback_long_term_action(
    row_id: int,
    body: LongTermActionPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if not row.temporary_submitted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先提交临时措施")
    row.long_term_action = body.long_term_action.strip()
    row.long_term_due_at = body.long_term_due_at
    row.long_term_action_image_uuids = [str(x).strip() for x in body.long_term_action_image_uuids if str(x).strip()]
    row.long_term_submitted_at = timezone.now()
    await row.save()
    return await _serialize_common(row, tenant_id, LineStopOut)


@line_stops_router.post("/{row_id}/workflow/handle-measures", response_model=LineStopOut, summary="提交处理措施（临时+长期）")
async def submit_line_stop_feedback_handle_measures(
    row_id: int,
    body: HandleMeasuresPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if (row.status or "").strip().lower() not in {"processing", "assigned"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不能提交处理措施")
    responsible_user_ids = await _normalize_responsible_users(tenant_id, body.responsible_user_ids)
    if not responsible_user_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先选择责任人")
    overdue_notify_user_ids, temporary_overdue_notify_user_ids, long_term_overdue_notify_user_ids = (
        await _prepare_split_overdue_notify_users(tenant_id, body)
    )
    now = timezone.now()
    row.responsible_user_ids = responsible_user_ids
    row.responsible_user_id = responsible_user_ids[0]
    row.overdue_notify_user_ids = overdue_notify_user_ids
    row.temporary_overdue_notify_user_ids = temporary_overdue_notify_user_ids
    row.long_term_overdue_notify_user_ids = long_term_overdue_notify_user_ids
    _apply_handle_measures(row, body, now)
    await row.save()
    return await _serialize_common(row, tenant_id, LineStopOut)


@line_stops_router.post("/{row_id}/workflow/confirm-close", response_model=LineStopOut, summary="问题结案确认")
async def confirm_line_stop_feedback_close(
    row_id: int,
    body: CloseConfirmPayload,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    if not row.temporary_submitted_at or not row.long_term_submitted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="临时与长期措施完成后才能结案")
    row.status = "completed"
    row.completed_at = timezone.now()
    row.close_note = (body.close_note or "").strip() or None
    row.close_confirmer_user_id = int(user.id)
    row.close_confirmed_at = timezone.now()
    if body.recovered_at is not None:
        row.recovered_at = body.recovered_at
    await row.save()
    await _dispatch_quality_notification(
        tenant_id,
        doc_type=DOC_LINE_STOP_FEEDBACK,
        action=ACTION_COMPLETED,
        row_id=row.id,
        sheet_no=row.sheet_no or "",
        title=row.title or "",
        recipient_user_id=row.registrant_user_id,
        user_specified_user_ids=[],
    )
    return await _serialize_common(row, tenant_id, LineStopOut)


@line_stops_router.post("/{row_id}/submit", response_model=LineStopOut, summary="兼容：登记提交")
async def submit_line_stop_feedback(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    body = RegisterSubmitPayload(
        responsible_user_ids=normalize_report_user_ids(row.responsible_user_ids or ([row.responsible_user_id] if row.responsible_user_id else [])),
        overdue_notify_user_ids=normalize_report_user_ids(row.overdue_notify_user_ids),
    )
    return await submit_line_stop_feedback_register(row_id, body, tenant_id, _)


@line_stops_router.post("/{row_id}/complete", response_model=LineStopOut, summary="兼容：结案确认")
async def complete_line_stop_feedback(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    body = CloseConfirmPayload()
    return await confirm_line_stop_feedback_close(row_id, body, tenant_id, user)


@line_stops_router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除停线反馈")
async def delete_line_stop_feedback(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoLineStopFeedback, tenant_id).filter(id=row_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")
    row.deleted_at = timezone.now()
    await row.save()


router.include_router(issues_router)
router.include_router(complaints_router)
router.include_router(line_stops_router)
