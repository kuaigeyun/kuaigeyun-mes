"""好力 GO — 设备验收单 API（多轮调试/试产 + 台账结案）。"""

from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._creator import batch_lookup_user_names, resolve_creator_name
from apps.haoligo.api._equipment_sheet_code import generate_equipment_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from apps.haoligo.constants.equipment_acceptance_workflow import (
    LEDGER_ACTION_CREATED,
    LEDGER_ACTION_LINKED,
    LEDGER_ACTION_NONE,
    RESULT_FAIL,
    RESULT_PASS,
    RESULT_VALUES,
    WORKFLOW_ACCEPTED,
    WORKFLOW_CLOSED,
    WORKFLOW_COMMISSIONING,
    WORKFLOW_DRAFT,
    WORKFLOW_PENDING_TRIAL,
    WORKFLOW_TRIAL_RECORDING,
)
from apps.haoligo.constants.equipment_sheet_rule_codes import HAOLIGO_EQUIPMENT_ACCEPTANCE_NO
from apps.haoligo.models.equipment import HaoligoEquipment, HaoligoEquipmentCategory, HaoligoManufacturer, HaoligoWorkshop
from apps.haoligo.models.equipment_acceptance import HaoligoEquipmentAcceptanceRound, HaoligoEquipmentAcceptanceSheet
from apps.haoligo.services.equipment_acceptance_calc import calc_pass_rate
from apps.haoligo.services.equipment_acceptance_finalize import create_equipment_from_acceptance, link_acceptance_equipment
from apps.haoligo.services.equipment_acceptance_side_effects import (
    send_acceptance_accepted_messages,
    send_acceptance_trial_failed_messages,
    send_acceptance_trial_pending_messages,
)
from apps.haoligo.services.spot_check_side_effects import normalize_report_user_ids, validate_report_notify_users
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/equipment/acceptance-sheets",
    tags=["App - HaoliGO - 设备验收单"],
    dependencies=[Depends(require_haoligo_module_access("equipment-documents-acceptance"))],
)


def _parse_dt(v: Optional[str]) -> Optional[datetime]:
    if not v or not str(v).strip():
        return None
    s = str(v).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _strip_opt(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _norm_user_ids(v: Optional[List[int]]) -> List[int]:
    return normalize_report_user_ids(v)


def _norm_uuid_list(v: Optional[List[str]]) -> List[str]:
    if not v:
        return []
    out: List[str] = []
    for x in v:
        s = (x or "").strip()
        if s:
            out.append(s)
    return out


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


async def _load_sheet(tenant_id: int, row_id: int) -> HaoligoEquipmentAcceptanceSheet:
    row = await tenant_alive(HaoligoEquipmentAcceptanceSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return row


async def _load_round(
    tenant_id: int,
    header_id: int,
    round_no: int,
) -> HaoligoEquipmentAcceptanceRound:
    row = (
        await tenant_alive(HaoligoEquipmentAcceptanceRound, tenant_id)
        .filter(header_id=header_id, round_no=round_no)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="轮次不存在")
    return row


def _validate_result(value: Optional[str], *, field_label: str) -> str:
    s = (value or "").strip()
    if s not in RESULT_VALUES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"请选择{field_label}")
    return s


class AcceptanceRoundOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    round_no: int
    commissioning_content: Optional[str] = None
    commissioning_result: Optional[str] = None
    commissioning_submitted_at: Optional[datetime] = None
    product_name: Optional[str] = None
    material_no: Optional[str] = None
    quantity: Optional[Decimal] = None
    defect_qty: Optional[Decimal] = None
    defect_reason: Optional[str] = None
    running_time: Optional[Decimal] = None
    fault_time: Optional[Decimal] = None
    capacity_per_hour: Optional[Decimal] = None
    trial_result: Optional[str] = None
    pass_rate: Optional[Decimal] = None
    commissioning_attachment_file_uuids: List[str] = Field(default_factory=list)
    trial_attachment_file_uuids: List[str] = Field(default_factory=list)


class AcceptanceSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    manufacturer_id: Optional[int] = None
    manufacturer_name: Optional[str] = None
    arrived_at: Optional[datetime] = None
    install_location: Optional[str] = None
    equipment_name: Optional[str] = None
    remark: Optional[str] = None
    commissioning_user_ids: List[int] = Field(default_factory=list)
    submitted_notify_user_ids: List[int] = Field(default_factory=list)
    equipment_id: Optional[int] = None
    equipment_asset_code: Optional[str] = None
    workflow_status: str
    current_round: int
    accepted_at: Optional[datetime] = None
    accepted_by_user_id: Optional[int] = None
    ledger_action: str = LEDGER_ACTION_NONE
    reporter_user_id: int
    created_at: datetime
    creator_name: Optional[str] = None
    rounds: List[AcceptanceRoundOut] = Field(default_factory=list)


class AcceptanceSheetCreate(BaseModel):
    manufacturer_id: Optional[int] = Field(None, ge=1)
    manufacturer_name: Optional[str] = Field(None, max_length=200)
    arrived_at: Optional[datetime] = None
    install_location: Optional[str] = Field(None, max_length=500)
    equipment_name: str = Field(min_length=1, max_length=200)
    remark: Optional[str] = None
    commissioning_user_ids: List[int] = Field(default_factory=list)
    submitted_notify_user_ids: List[int] = Field(default_factory=list)

    @field_validator("equipment_name", mode="before")
    @classmethod
    def strip_equipment_name(cls, v):
        s = str(v or "").strip()
        if not s:
            raise ValueError("请填写设备名称")
        return s


class AcceptanceSheetUpdate(BaseModel):
    manufacturer_id: Optional[int] = Field(None, ge=1)
    manufacturer_name: Optional[str] = Field(None, max_length=200)
    arrived_at: Optional[datetime] = None
    install_location: Optional[str] = Field(None, max_length=500)
    equipment_name: Optional[str] = Field(None, max_length=200)
    remark: Optional[str] = None
    commissioning_user_ids: Optional[List[int]] = None
    submitted_notify_user_ids: Optional[List[int]] = None


class AcceptanceRoundCommissioningUpdate(BaseModel):
    commissioning_content: Optional[str] = None
    commissioning_result: Optional[str] = None
    commissioning_attachment_file_uuids: Optional[List[str]] = None

    @field_validator("commissioning_result", mode="before")
    @classmethod
    def strip_result(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class AcceptanceRoundTrialUpdate(BaseModel):
    product_name: Optional[str] = Field(None, max_length=200)
    material_no: Optional[str] = Field(None, max_length=128)
    quantity: Optional[Decimal] = Field(None, ge=0)
    defect_qty: Optional[Decimal] = Field(None, ge=0)
    defect_reason: Optional[str] = None
    running_time: Optional[Decimal] = Field(None, ge=0)
    fault_time: Optional[Decimal] = Field(None, ge=0)
    capacity_per_hour: Optional[Decimal] = Field(None, ge=0)
    trial_result: Optional[str] = None
    trial_attachment_file_uuids: Optional[List[str]] = None


class SubmitCommissioningBody(BaseModel):
    submitted_notify_user_ids: Optional[List[int]] = None


class CompleteTrialBody(BaseModel):
    submitted_notify_user_ids: Optional[List[int]] = None


class FinalizeLedgerBody(BaseModel):
    mode: Literal["create", "link"]
    equipment_id: Optional[int] = Field(None, ge=1, description="关联已有设备 ID（mode=link）")
    asset_code: Optional[str] = Field(None, max_length=64, description="创建设备资产编号（mode=create）")
    name: Optional[str] = Field(None, max_length=200, description="设备名称（mode=create）")
    category_id: Optional[int] = Field(None, ge=1)
    workshop_id: Optional[int] = Field(None, ge=1)
    manufacturer_id: Optional[int] = Field(None, ge=1)
    manufacture_date: Optional[date] = None
    inspection_param_set_ids: List[int] = Field(default_factory=list)
    upkeep_param_set_id: Optional[int] = Field(None, ge=1)
    criticality: Optional[str] = Field(None, max_length=8)
    operational_status: Optional[str] = Field(None, max_length=16)
    remark: Optional[str] = None
    image_file_uuids: Optional[List[str]] = None
    maintenance_cycle_by_yield: Optional[Decimal] = Field(None, ge=0)
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)


async def _resolve_manufacturer_snapshot(
    tenant_id: int,
    manufacturer_id: Optional[int],
    manufacturer_name: Optional[str],
) -> tuple[Optional[int], Optional[str]]:
    if manufacturer_id is not None:
        mfr = await tenant_alive(HaoligoManufacturer, tenant_id).filter(id=manufacturer_id).first()
        if not mfr:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="制造商不存在")
        return int(mfr.id), (mfr.name or "").strip() or None
    name = _strip_opt(manufacturer_name)
    return None, name


async def _serialize_round(row: HaoligoEquipmentAcceptanceRound) -> AcceptanceRoundOut:
    return AcceptanceRoundOut(
        id=row.id,
        uuid=str(row.uuid),
        round_no=row.round_no,
        commissioning_content=row.commissioning_content,
        commissioning_result=row.commissioning_result,
        commissioning_submitted_at=row.commissioning_submitted_at,
        product_name=row.product_name,
        material_no=row.material_no,
        quantity=row.quantity,
        defect_qty=row.defect_qty,
        defect_reason=row.defect_reason,
        running_time=row.running_time,
        fault_time=row.fault_time,
        capacity_per_hour=row.capacity_per_hour,
        trial_result=row.trial_result,
        pass_rate=calc_pass_rate(row.quantity, row.defect_qty),
        commissioning_attachment_file_uuids=_norm_uuid_list(row.commissioning_attachment_file_uuids),
        trial_attachment_file_uuids=_norm_uuid_list(row.trial_attachment_file_uuids),
    )


async def _serialize_sheet(
    row: HaoligoEquipmentAcceptanceSheet,
    *,
    user_names: dict[int, str] | None = None,
) -> AcceptanceSheetOut:
    if user_names is None:
        user_names = await batch_lookup_user_names(row.tenant_id, [row.reporter_user_id])
    await row.fetch_related("equipment", "rounds")
    eq = row.equipment
    rounds = sorted(row.rounds or [], key=lambda r: r.round_no)
    return AcceptanceSheetOut(
        id=row.id,
        uuid=str(row.uuid),
        sheet_no=row.sheet_no,
        manufacturer_id=row.manufacturer_id,
        manufacturer_name=row.manufacturer_name,
        arrived_at=row.arrived_at,
        install_location=row.install_location,
        equipment_name=row.equipment_name,
        remark=row.remark,
        commissioning_user_ids=_norm_user_ids(row.commissioning_user_ids),
        submitted_notify_user_ids=_norm_user_ids(row.submitted_notify_user_ids),
        equipment_id=row.equipment_id,
        equipment_asset_code=getattr(eq, "asset_code", None) if eq else None,
        workflow_status=row.workflow_status,
        current_round=row.current_round,
        accepted_at=row.accepted_at,
        accepted_by_user_id=row.accepted_by_user_id,
        ledger_action=(row.ledger_action or LEDGER_ACTION_NONE).strip(),
        reporter_user_id=row.reporter_user_id,
        created_at=row.created_at,
        creator_name=resolve_creator_name(reporter_user_id=row.reporter_user_id, user_names=user_names),
        rounds=[await _serialize_round(r) for r in rounds],
    )


def _assert_header_editable(row: HaoligoEquipmentAcceptanceSheet) -> None:
    if row.workflow_status not in {WORKFLOW_DRAFT, WORKFLOW_COMMISSIONING}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不可修改头信息")


@router.get("", summary="设备验收单分页列表")
async def list_acceptance_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    workflow_status: Optional[str] = None,
    keyword: Optional[str] = None,
    arrived_from: Optional[str] = None,
    arrived_to: Optional[str] = None,
):
    qs = tenant_alive(HaoligoEquipmentAcceptanceSheet, tenant_id).prefetch_related("equipment")
    if workflow_status and workflow_status.strip():
        qs = qs.filter(workflow_status=workflow_status.strip())
    rf = _parse_dt(arrived_from)
    rt = _parse_dt(arrived_to)
    if rf:
        qs = qs.filter(arrived_at__gte=rf)
    if rt:
        qs = qs.filter(arrived_at__lte=rt)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(sheet_no__icontains=k)
            | Q(equipment_name__icontains=k)
            | Q(install_location__icontains=k)
            | Q(remark__icontains=k)
            | Q(manufacturer_name__icontains=k)
            | Q(equipment__asset_code__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    user_names = await batch_lookup_user_names(tenant_id, [r.reporter_user_id for r in rows])
    return {
        "items": [await _serialize_sheet(r, user_names=user_names) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=AcceptanceSheetOut, summary="创建设备验收单")
async def create_acceptance_sheet(
    body: AcceptanceSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    mfr_id, mfr_name = await _resolve_manufacturer_snapshot(tenant_id, body.manufacturer_id, body.manufacturer_name)
    commissioning_ids = _norm_user_ids(body.commissioning_user_ids)

    async with in_transaction():
        sheet_no = await generate_equipment_sheet_no(tenant_id, HAOLIGO_EQUIPMENT_ACCEPTANCE_NO)
        row = await HaoligoEquipmentAcceptanceSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            manufacturer_id=mfr_id,
            manufacturer_name=mfr_name,
            arrived_at=body.arrived_at,
            install_location=_strip_opt(body.install_location),
            equipment_name=body.equipment_name.strip(),
            remark=_strip_opt(body.remark),
            commissioning_user_ids=commissioning_ids,
            submitted_notify_user_ids=[],
            workflow_status=WORKFLOW_COMMISSIONING,
            current_round=1,
            reporter_user_id=int(user.id),
        )
        await HaoligoEquipmentAcceptanceRound.create(
            tenant_id=tenant_id,
            header_id=row.id,
            round_no=1,
        )
    return await _serialize_sheet(row)


@router.get("/{row_id}", response_model=AcceptanceSheetOut, summary="设备验收单详情")
async def get_acceptance_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await _load_sheet(tenant_id, row_id)
    return await _serialize_sheet(row)


@router.patch("/{row_id}", response_model=AcceptanceSheetOut, summary="更新设备验收单头")
async def update_acceptance_sheet(
    row_id: int,
    body: AcceptanceSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await _load_sheet(tenant_id, row_id)
    _assert_header_editable(row)
    data = body.model_dump(exclude_unset=True)
    if "manufacturer_id" in data or "manufacturer_name" in data:
        mfr_id, mfr_name = await _resolve_manufacturer_snapshot(
            tenant_id,
            data.get("manufacturer_id", row.manufacturer_id),
            data.get("manufacturer_name", row.manufacturer_name),
        )
        data["manufacturer_id"] = mfr_id
        data["manufacturer_name"] = mfr_name
    if "equipment_name" in data and data["equipment_name"] is not None:
        data["equipment_name"] = str(data["equipment_name"]).strip()
    if "install_location" in data:
        data["install_location"] = _strip_opt(data.get("install_location"))
    if "remark" in data:
        data["remark"] = _strip_opt(data.get("remark"))
    if "commissioning_user_ids" in data and data["commissioning_user_ids"] is not None:
        data["commissioning_user_ids"] = _norm_user_ids(data["commissioning_user_ids"])
    if "submitted_notify_user_ids" in data and data["submitted_notify_user_ids"] is not None:
        notify_ids = _norm_user_ids(data["submitted_notify_user_ids"])
        if notify_ids:
            await validate_report_notify_users(tenant_id, notify_ids)
        data["submitted_notify_user_ids"] = notify_ids
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return await _serialize_sheet(row)


@router.delete("/{row_id}", summary="删除设备验收单")
async def delete_acceptance_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await _load_sheet(tenant_id, row_id)
    now = timezone.now()
    async with in_transaction():
        row.deleted_at = now
        await row.save()
        await (
            tenant_alive(HaoligoEquipmentAcceptanceRound, tenant_id)
            .filter(header_id=row.id)
            .update(deleted_at=now)
        )
    return {"ok": True}


@router.patch(
    "/{row_id}/rounds/{round_no}",
    response_model=AcceptanceSheetOut,
    summary="更新轮次调试信息",
)
async def update_round_commissioning(
    row_id: int,
    round_no: int,
    body: AcceptanceRoundCommissioningUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    header = await _load_sheet(tenant_id, row_id)
    if header.workflow_status not in {WORKFLOW_COMMISSIONING, WORKFLOW_DRAFT}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不可编辑调试信息")
    if round_no != header.current_round:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅可编辑当前轮次")
    rnd = await _load_round(tenant_id, row_id, round_no)
    data = body.model_dump(exclude_unset=True)
    if "commissioning_result" in data and data["commissioning_result"] is not None:
        data["commissioning_result"] = _validate_result(data["commissioning_result"], field_label="调试结果")
    if "commissioning_attachment_file_uuids" in data and data["commissioning_attachment_file_uuids"] is not None:
        data["commissioning_attachment_file_uuids"] = _norm_uuid_list(data["commissioning_attachment_file_uuids"])
    for k, v in data.items():
        setattr(rnd, k, v)
    await rnd.save()
    if header.workflow_status == WORKFLOW_DRAFT:
        header.workflow_status = WORKFLOW_COMMISSIONING
        await header.save()
    return await _serialize_sheet(header)


@router.post(
    "/{row_id}/submit-commissioning",
    response_model=AcceptanceSheetOut,
    summary="提交试产（调试合格）",
)
async def submit_commissioning(
    row_id: int,
    body: SubmitCommissioningBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    header = await _load_sheet(tenant_id, row_id)
    if header.workflow_status != WORKFLOW_COMMISSIONING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不可提交试产")
    rnd = await _load_round(tenant_id, row_id, header.current_round)
    result = _validate_result(rnd.commissioning_result, field_label="调试结果")
    if result != RESULT_PASS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="调试合格后方可提交试产")
    if header.current_round >= 2:
        content = (rnd.commissioning_content or "").strip()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="第2轮起请填写调试内容")
    if body.submitted_notify_user_ids is not None:
        notify_ids = _norm_user_ids(body.submitted_notify_user_ids)
        if notify_ids:
            await validate_report_notify_users(tenant_id, notify_ids)
        header.submitted_notify_user_ids = notify_ids
    rnd.commissioning_submitted_at = timezone.now()
    await rnd.save()
    header.workflow_status = WORKFLOW_PENDING_TRIAL
    await header.save()
    await send_acceptance_trial_pending_messages(tenant_id, header)
    return await _serialize_sheet(header)


@router.post(
    "/{row_id}/start-trial",
    response_model=AcceptanceSheetOut,
    summary="开始试产",
)
async def start_trial(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    header = await _load_sheet(tenant_id, row_id)
    if header.workflow_status != WORKFLOW_PENDING_TRIAL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不可开始试产")
    header.workflow_status = WORKFLOW_TRIAL_RECORDING
    await header.save()
    return await _serialize_sheet(header)


@router.patch(
    "/{row_id}/rounds/{round_no}/trial",
    response_model=AcceptanceSheetOut,
    summary="填写试产数据",
)
async def update_round_trial(
    row_id: int,
    round_no: int,
    body: AcceptanceRoundTrialUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    header = await _load_sheet(tenant_id, row_id)
    if header.workflow_status != WORKFLOW_TRIAL_RECORDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不可填写试产")
    if round_no != header.current_round:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅可编辑当前轮次试产")
    rnd = await _load_round(tenant_id, row_id, round_no)
    data = body.model_dump(exclude_unset=True)
    if "trial_result" in data and data["trial_result"] is not None:
        data["trial_result"] = _validate_result(data["trial_result"], field_label="试产结果")
    qty = data.get("quantity", rnd.quantity)
    defect = data.get("defect_qty", rnd.defect_qty)
    if qty is not None and Decimal(str(qty)) <= 0 and any(k in data for k in ("defect_qty", "trial_result")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="试产数量须大于 0")
    if defect is not None and qty is not None:
        if Decimal(str(defect)) > Decimal(str(qty)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不良数量不能大于试产数量")
    if "trial_attachment_file_uuids" in data and data["trial_attachment_file_uuids"] is not None:
        data["trial_attachment_file_uuids"] = _norm_uuid_list(data["trial_attachment_file_uuids"])
    for k, v in data.items():
        setattr(rnd, k, v)
    await rnd.save()
    return await _serialize_sheet(header)


@router.post(
    "/{row_id}/complete-trial",
    response_model=AcceptanceSheetOut,
    summary="提交试产结论",
)
async def complete_trial(
    row_id: int,
    body: CompleteTrialBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    header = await _load_sheet(tenant_id, row_id)
    if header.workflow_status != WORKFLOW_TRIAL_RECORDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前状态不可提交试产结论")
    rnd = await _load_round(tenant_id, row_id, header.current_round)
    trial_result = _validate_result(rnd.trial_result, field_label="试产结果")
    if rnd.quantity is None or Decimal(str(rnd.quantity)) <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写试产数量")
    if rnd.defect_qty is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写不良数量")

    if body.submitted_notify_user_ids is not None:
        notify_ids = _norm_user_ids(body.submitted_notify_user_ids)
        if notify_ids:
            await validate_report_notify_users(tenant_id, notify_ids)
        header.submitted_notify_user_ids = notify_ids

    if trial_result == RESULT_PASS:
        header.workflow_status = WORKFLOW_ACCEPTED
        header.accepted_at = timezone.now()
        header.accepted_by_user_id = int(user.id)
        await header.save()
        await send_acceptance_accepted_messages(tenant_id, header)
        return await _serialize_sheet(header)

    async with in_transaction():
        header.workflow_status = WORKFLOW_COMMISSIONING
        header.current_round = int(header.current_round) + 1
        await header.save()
        await HaoligoEquipmentAcceptanceRound.create(
            tenant_id=tenant_id,
            header_id=header.id,
            round_no=header.current_round,
        )
    await send_acceptance_trial_failed_messages(tenant_id, header, round_row=rnd)
    return await _serialize_sheet(header)


@router.post(
    "/{row_id}/finalize-ledger",
    response_model=AcceptanceSheetOut,
    summary="验收台账结案（创建或关联设备）",
)
async def finalize_ledger(
    row_id: int,
    body: FinalizeLedgerBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    header = await _load_sheet(tenant_id, row_id)
    if header.workflow_status != WORKFLOW_ACCEPTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验收合格后方可处理台账")
    if (header.ledger_action or LEDGER_ACTION_NONE) not in {LEDGER_ACTION_NONE, ""}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="台账已处理")

    if body.mode == "link":
        if body.equipment_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择要关联的设备")
        eq_id = await link_acceptance_equipment(tenant_id, header, body.equipment_id)
        header.equipment_id = eq_id
        header.ledger_action = LEDGER_ACTION_LINKED
    else:
        if not (body.asset_code or "").strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写设备资产编号")
        if not (body.name or header.equipment_name or "").strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请填写设备名称")
        if body.category_id is None or body.workshop_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择设备类别与车间")
        eq_id = await create_equipment_from_acceptance(
            tenant_id,
            header,
            asset_code=body.asset_code.strip(),
            name=(body.name or "").strip() or None,
            category_id=body.category_id,
            workshop_id=body.workshop_id,
            manufacturer_id=body.manufacturer_id,
            manufacture_date=body.manufacture_date,
            inspection_param_set_ids=body.inspection_param_set_ids,
            upkeep_param_set_id=body.upkeep_param_set_id,
            criticality=body.criticality,
            operational_status=body.operational_status,
            remark=body.remark,
            image_file_uuids=_norm_uuid_list(body.image_file_uuids),
            maintenance_cycle_by_yield=body.maintenance_cycle_by_yield,
            maintenance_cycle_by_days=body.maintenance_cycle_by_days,
        )
        header.equipment_id = eq_id
        header.ledger_action = LEDGER_ACTION_CREATED
    header.workflow_status = WORKFLOW_CLOSED
    await header.save()
    return await _serialize_sheet(header)
