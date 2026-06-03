"""好力 GO — 巡查隐患单 API。"""

from datetime import datetime
from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._equipment_sheet_code import generate_equipment_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api._users import resolve_tenant_user
from apps.haoligo.constants.patrol_sheet_rule_codes import HAOLIGO_PATROL_HAZARD_REPORT_NO
from apps.haoligo.models.equipment import HaoligoEquipment, HaoligoWorkshop
from apps.haoligo.models.patrol import HaoligoHazardReport
from apps.haoligo.services.hazard_report_side_effects import (
    _hazard_report_already_sent,
    maybe_send_hazard_report_on_save,
)
from apps.haoligo.services.spot_check_side_effects import (
    normalize_report_user_ids,
    validate_report_notify_users,
)
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/patrol/hazard-reports",
    tags=["App · HaoliGO · 巡查"],
    dependencies=[Depends(require_module_access("haoligo", "patrol-hazards"))],
)


class HazardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    equipment_id: Optional[int] = None
    equipment_asset_code: Optional[str] = None
    equipment_name: Optional[str] = None
    workshop_id: Optional[int] = None
    workshop_name: Optional[str] = None
    workshop_area: Optional[str] = None
    reported_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    issue_type_code: Optional[str] = None
    issue_type_codes: List[str] = Field(default_factory=list)
    problem_summary: Optional[str] = None
    solution_note: Optional[str] = None
    status: str
    before_image_file_ids: Optional[Any] = None
    after_image_file_ids: Optional[Any] = None
    handler_name: Optional[str] = None
    handled_at: Optional[datetime] = None
    registrant_user_id: Optional[int] = None
    registrant_name: Optional[str] = None
    responsible_user_id: Optional[int] = None
    responsible_name: Optional[str] = None
    report_enabled: bool = False
    report_notify_user_ids: List[int] = Field(default_factory=list)


class HazardCreate(BaseModel):
    equipment_id: Optional[int] = None
    workshop_id: Optional[int] = None
    workshop_area: Optional[str] = Field(None, max_length=200)
    reported_at: Optional[datetime] = None
    issue_type_code: Optional[str] = Field(None, max_length=64)
    issue_type_codes: Optional[List[str]] = None
    problem_summary: Optional[str] = None
    solution_note: Optional[str] = None
    status: str = Field(default="已登记", max_length=32)
    before_image_file_ids: Optional[list] = None
    after_image_file_ids: Optional[list] = None
    handler_name: Optional[str] = Field(None, max_length=100)
    handled_at: Optional[datetime] = None
    registrant_user_id: Optional[int] = Field(None, ge=1)
    responsible_user_id: Optional[int] = Field(None, ge=1)
    report_enabled: bool = False
    report_notify_user_ids: List[int] = Field(default_factory=list)


class HazardUpdate(BaseModel):
    equipment_id: Optional[int] = None
    workshop_id: Optional[int] = None
    workshop_area: Optional[str] = Field(None, max_length=200)
    reported_at: Optional[datetime] = None
    issue_type_code: Optional[str] = Field(None, max_length=64)
    issue_type_codes: Optional[List[str]] = None
    problem_summary: Optional[str] = None
    solution_note: Optional[str] = None
    status: Optional[str] = Field(None, max_length=32)
    before_image_file_ids: Optional[list] = None
    after_image_file_ids: Optional[list] = None
    handler_name: Optional[str] = Field(None, max_length=100)
    handled_at: Optional[datetime] = None
    registrant_user_id: Optional[int] = Field(None, ge=1)
    responsible_user_id: Optional[int] = Field(None, ge=1)
    report_enabled: Optional[bool] = None
    report_notify_user_ids: Optional[List[int]] = None


async def _hazard_report_fields(
    tenant_id: int,
    *,
    report_enabled: bool,
    report_notify_user_ids: Optional[List[int]],
) -> tuple[bool, List[int]]:
    user_ids = normalize_report_user_ids(report_notify_user_ids)
    if user_ids:
        await validate_report_notify_users(tenant_id, user_ids)
    return report_enabled, user_ids


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _ensure_completed_requirements(
    solution_note: Optional[str],
    handler_name: Optional[str],
    handled_at: Optional[datetime],
) -> None:
    """办结（处理人 + 处理时间）时须填写解决方案；处理后照片为选填。"""
    hn = (handler_name or "").strip() if handler_name else ""
    if handled_at is None or not hn:
        return
    if not (solution_note or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="办结需填写解决方案（05）",
        )


async def _resolve_registrant_on_create(
    tenant_id: int,
    current_user: User,
    registrant_user_id: Optional[int],
) -> tuple[int, str]:
    reg_id = registrant_user_id if registrant_user_id is not None else current_user.id
    return await resolve_tenant_user(tenant_id, int(reg_id))


async def _apply_user_fields_patch(data: dict, tenant_id: int) -> None:
    """就地处理 PATCH 中的登记人字段（弹出 id，写入 id+name）。"""
    if "registrant_user_id" in data:
        rid = data.pop("registrant_user_id")
        if rid is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="登记人不能为空",
            )
        uid, name = await resolve_tenant_user(tenant_id, int(rid))
        data["registrant_user_id"] = uid
        data["registrant_name"] = name
    data.pop("responsible_user_id", None)


def _normalize_issue_type_codes(
    codes: Optional[List[str]],
    legacy_code: Optional[str] = None,
) -> List[str]:
    out: List[str] = []
    for raw in codes or []:
        s = str(raw).strip()
        if s and s not in out:
            out.append(s)
    if not out and legacy_code and str(legacy_code).strip():
        out.append(str(legacy_code).strip())
    return out


def _apply_issue_type_fields(data: dict) -> None:
    """写入 issue_type_codes，并同步 issue_type_code 为首项（报表/兼容）。"""
    codes: Optional[List[str]] = None
    legacy = data.pop("issue_type_code", None) if "issue_type_code" in data else None
    if "issue_type_codes" in data:
        codes = _normalize_issue_type_codes(data.pop("issue_type_codes"), legacy)
    elif legacy is not None:
        codes = _normalize_issue_type_codes(None, legacy)
    if codes is None:
        return
    data["issue_type_codes"] = codes
    data["issue_type_code"] = codes[0] if codes else None


async def _sync_responsible_from_recipients(
    tenant_id: int,
    user_ids: List[int],
) -> tuple[Optional[int], Optional[str]]:
    """上报接收人即责任人：首项写入 responsible_user_id，姓名以顿号拼接。"""
    if not user_ids:
        return None, None
    first_uid: Optional[int] = None
    names: List[str] = []
    for uid in user_ids:
        resolved_uid, name = await resolve_tenant_user(tenant_id, int(uid))
        if first_uid is None:
            first_uid = resolved_uid
        names.append(name)
    return first_uid, "、".join(names)


def _apply_hazard_status(row: HaoligoHazardReport) -> None:
    hn = (row.handler_name or "").strip()
    if row.handled_at is not None and hn:
        row.status = "已治理"
    elif row.status not in ("已登记", "已治理"):
        row.status = "已登记"


async def _serialize_hazard(
    row: HaoligoHazardReport,
    tenant_id: int,
    *,
    equipment_map: Optional[dict[int, tuple[str, str]]] = None,
) -> HazardOut:
    workshop_name: Optional[str] = None
    if row.workshop_id:
        ws = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=row.workshop_id).first()
        if ws:
            workshop_name = ws.name
    eq_code: Optional[str] = None
    eq_name: Optional[str] = None
    eid = getattr(row, "equipment_id", None)
    if eid:
        if equipment_map is not None and eid in equipment_map:
            eq_code, eq_name = equipment_map[eid]
        else:
            eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=eid).first()
            if eq:
                eq_code = eq.asset_code
                eq_name = eq.name
    data = HazardOut.model_validate(row).model_dump()
    data["workshop_name"] = workshop_name
    data["equipment_asset_code"] = eq_code
    data["equipment_name"] = eq_name
    data["report_notify_user_ids"] = normalize_report_user_ids(row.report_notify_user_ids)
    codes = _normalize_issue_type_codes(
        getattr(row, "issue_type_codes", None) or [],
        row.issue_type_code,
    )
    data["issue_type_codes"] = codes
    if codes and not data.get("issue_type_code"):
        data["issue_type_code"] = codes[0]
    return HazardOut(**data)


@router.get("", summary="隐患单分页")
async def list_hazards(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    equipment_id: Optional[int] = Query(None, description="按关联设备筛选"),
    for_remediation: Optional[bool] = Query(
        None,
        description="为 true 时仅返回待治理（已登记）；与 status 同时传入时以 status 为准",
    ),
    reported_from: Optional[datetime] = Query(None, description="巡查/反馈时间起（含）"),
    reported_to: Optional[datetime] = Query(None, description="巡查/反馈时间止（含）"),
    sheet_no: Optional[str] = Query(None, description="登记单号（模糊）"),
    keyword: Optional[str] = Query(None, description="单号/区域/登记人/责任人（模糊）"),
):
    qs = tenant_alive(HaoligoHazardReport, tenant_id)
    if status_filter:
        qs = qs.filter(status=status_filter)
    elif for_remediation:
        qs = qs.filter(status="已登记")
    if equipment_id is not None:
        qs = qs.filter(equipment_id=equipment_id)
    if reported_from is not None:
        qs = qs.filter(reported_at__gte=reported_from)
    if reported_to is not None:
        qs = qs.filter(reported_at__lte=reported_to)
    if sheet_no and sheet_no.strip():
        qs = qs.filter(sheet_no__icontains=sheet_no.strip())
    k = (keyword or "").strip()
    if k:
        qs = qs.filter(
            Q(sheet_no__icontains=k)
            | Q(workshop_area__icontains=k)
            | Q(registrant_name__icontains=k)
            | Q(responsible_name__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-reported_at", "-id").offset(skip).limit(limit)
    eq_ids = {r.equipment_id for r in rows if getattr(r, "equipment_id", None)}
    eq_map: dict[int, tuple[str, str]] = {}
    if eq_ids:
        for eq in await tenant_alive(HaoligoEquipment, tenant_id).filter(id__in=list(eq_ids)).all():
            eq_map[eq.id] = (eq.asset_code, eq.name)
    items = [await _serialize_hazard(r, tenant_id, equipment_map=eq_map) for r in rows]
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=HazardOut, summary="创建隐患单")
async def create_hazard(
    body: HazardCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    if body.workshop_id is not None and not await tenant_alive(HaoligoWorkshop, tenant_id).filter(
        id=body.workshop_id
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
    if body.equipment_id is not None and not await tenant_alive(HaoligoEquipment, tenant_id).filter(
        id=body.equipment_id
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    hn = (body.handler_name or "").strip()
    eff_status = body.status or "已登记"
    if body.handled_at is not None and hn:
        eff_status = "已治理"
    if eff_status == "已治理":
        _ensure_completed_requirements(
            body.solution_note,
            body.handler_name,
            body.handled_at,
        )
    reg_uid, reg_name = await _resolve_registrant_on_create(
        tenant_id, user, body.registrant_user_id
    )
    report_enabled, report_user_ids = await _hazard_report_fields(
        tenant_id,
        report_enabled=body.report_enabled,
        report_notify_user_ids=body.report_notify_user_ids,
    )
    res_uid, res_name = await _sync_responsible_from_recipients(tenant_id, report_user_ids)
    issue_codes = _normalize_issue_type_codes(body.issue_type_codes, body.issue_type_code)
    if not issue_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请至少选择一种问题类型",
        )
    async with in_transaction():
        try:
            sheet_no = await generate_equipment_sheet_no(tenant_id, HAOLIGO_PATROL_HAZARD_REPORT_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoHazardReport.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            equipment_id=body.equipment_id,
            workshop_id=body.workshop_id,
            workshop_area=body.workshop_area,
            reported_at=body.reported_at or timezone.now(),
            issue_type_code=issue_codes[0] if issue_codes else None,
            issue_type_codes=issue_codes,
            problem_summary=body.problem_summary,
            solution_note=body.solution_note,
            status=eff_status,
            before_image_file_ids=body.before_image_file_ids,
            after_image_file_ids=body.after_image_file_ids,
            handler_name=hn or None,
            handled_at=body.handled_at,
            registrant_user_id=reg_uid,
            registrant_name=reg_name,
            responsible_user_id=res_uid,
            responsible_name=res_name,
            report_enabled=report_enabled,
            report_notify_user_ids=report_user_ids,
        )
    await maybe_send_hazard_report_on_save(
        tenant_id,
        row,
        report_enabled=report_enabled,
        report_notify_user_ids=report_user_ids,
        send_report=report_enabled,
    )
    from apps.haoligo.services.hazard_report_side_effects import maybe_send_hazard_remediated_on_save

    if eff_status == "已治理":
        await maybe_send_hazard_remediated_on_save(
            tenant_id,
            row,
            old_status="已登记",
            new_status=eff_status,
        )
    return await _serialize_hazard(row, tenant_id)


@router.get("/{row_id}", response_model=HazardOut, summary="隐患单详情")
async def get_hazard(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoHazardReport, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return await _serialize_hazard(row, tenant_id)


@router.patch("/{row_id}", response_model=HazardOut, summary="更新隐患单")
async def update_hazard(
    row_id: int,
    body: HazardUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoHazardReport, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    body_set = body.model_dump(exclude_unset=True)
    old_status = (row.status or "").strip()
    old_report_enabled = row.report_enabled
    old_report_user_ids = normalize_report_user_ids(row.report_notify_user_ids)
    report_enabled = row.report_enabled
    report_user_ids = normalize_report_user_ids(row.report_notify_user_ids)
    data = dict(body_set)
    if "report_enabled" in data:
        report_enabled = bool(data.pop("report_enabled"))
    if "report_notify_user_ids" in data:
        report_user_ids = normalize_report_user_ids(data.pop("report_notify_user_ids"))
    report_enabled, report_user_ids = await _hazard_report_fields(
        tenant_id,
        report_enabled=report_enabled,
        report_notify_user_ids=report_user_ids,
    )
    report_fields_touched = "report_enabled" in body_set or "report_notify_user_ids" in body_set
    from apps.haoligo.services.report_dispatch import should_send_report_notification

    send_report = should_send_report_notification(
        report_enabled=report_enabled,
        old_report_enabled=old_report_enabled,
        report_fields_touched=report_fields_touched,
        old_notify_user_ids=old_report_user_ids,
        new_notify_user_ids=report_user_ids,
        already_sent=await _hazard_report_already_sent(tenant_id, row.id),
    )
    if "workshop_id" in data and data["workshop_id"] is not None:
        if not await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=data["workshop_id"]).exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
    if "equipment_id" in data and data["equipment_id"] is not None:
        if not await tenant_alive(HaoligoEquipment, tenant_id).filter(id=data["equipment_id"]).exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设备不存在")
    await _apply_user_fields_patch(data, tenant_id)
    _apply_issue_type_fields(data)
    row.report_enabled = report_enabled
    row.report_notify_user_ids = report_user_ids
    res_uid, res_name = await _sync_responsible_from_recipients(tenant_id, report_user_ids)
    row.responsible_user_id = res_uid
    row.responsible_name = res_name
    for k, v in data.items():
        setattr(row, k, v)
    _apply_hazard_status(row)
    if row.status == "已治理":
        _ensure_completed_requirements(
            row.solution_note,
            row.handler_name,
            row.handled_at,
        )
    await row.save()
    await maybe_send_hazard_report_on_save(
        tenant_id,
        row,
        report_enabled=report_enabled,
        report_notify_user_ids=report_user_ids,
        send_report=send_report,
    )
    from apps.haoligo.services.hazard_report_side_effects import maybe_send_hazard_remediated_on_save

    await maybe_send_hazard_remediated_on_save(
        tenant_id,
        row,
        old_status=old_status,
        new_status=(row.status or "").strip(),
    )
    return await _serialize_hazard(row, tenant_id)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除隐患单")
async def delete_hazard(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoHazardReport, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
