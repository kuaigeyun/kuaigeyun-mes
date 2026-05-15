"""好力 GO — 巡查隐患单 API。"""

from datetime import datetime
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api._users import resolve_tenant_user
from apps.haoligo.models.equipment import HaoligoWorkshop
from apps.haoligo.models.patrol import HaoligoHazardReport
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/patrol/hazard-reports", tags=["App · HaoliGO · 巡查"])


class HazardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    workshop_id: Optional[int] = None
    workshop_name: Optional[str] = None
    workshop_area: Optional[str] = None
    reported_at: Optional[datetime] = None
    issue_type_code: Optional[str] = None
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


class HazardCreate(BaseModel):
    workshop_id: Optional[int] = None
    workshop_area: Optional[str] = Field(None, max_length=200)
    reported_at: Optional[datetime] = None
    issue_type_code: Optional[str] = Field(None, max_length=64)
    problem_summary: Optional[str] = None
    solution_note: Optional[str] = None
    status: str = Field(default="检查中", max_length=32)
    before_image_file_ids: Optional[list] = None
    after_image_file_ids: Optional[list] = None
    handler_name: Optional[str] = Field(None, max_length=100)
    handled_at: Optional[datetime] = None
    registrant_user_id: Optional[int] = Field(None, ge=1)
    responsible_user_id: Optional[int] = Field(None, ge=1)


class HazardUpdate(BaseModel):
    workshop_id: Optional[int] = None
    workshop_area: Optional[str] = Field(None, max_length=200)
    reported_at: Optional[datetime] = None
    issue_type_code: Optional[str] = Field(None, max_length=64)
    problem_summary: Optional[str] = None
    solution_note: Optional[str] = None
    status: Optional[str] = Field(None, max_length=32)
    before_image_file_ids: Optional[list] = None
    after_image_file_ids: Optional[list] = None
    handler_name: Optional[str] = Field(None, max_length=100)
    handled_at: Optional[datetime] = None
    registrant_user_id: Optional[int] = Field(None, ge=1)
    responsible_user_id: Optional[int] = Field(None, ge=1)


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
    """就地处理 PATCH 中的登记人/责任人字段（弹出 id，写入 id+name）。"""
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
    if "responsible_user_id" in data:
        rid = data.pop("responsible_user_id")
        if rid is None:
            data["responsible_user_id"] = None
            data["responsible_name"] = None
        else:
            uid, name = await resolve_tenant_user(tenant_id, int(rid))
            data["responsible_user_id"] = uid
            data["responsible_name"] = name


def _apply_hazard_status(row: HaoligoHazardReport) -> None:
    hn = (row.handler_name or "").strip()
    if row.handled_at is not None and hn:
        row.status = "已完成"
    elif (row.solution_note or "").strip():
        row.status = "维修中"
    elif row.status not in ("检查中", "维修中", "已完成"):
        row.status = "检查中"


async def _serialize_hazard(row: HaoligoHazardReport, tenant_id: int) -> HazardOut:
    workshop_name: Optional[str] = None
    if row.workshop_id:
        ws = await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=row.workshop_id).first()
        if ws:
            workshop_name = ws.name
    data = HazardOut.model_validate(row).model_dump()
    data["workshop_name"] = workshop_name
    return HazardOut(**data)


@router.get("", summary="隐患单分页")
async def list_hazards(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    for_remediation: Optional[bool] = Query(
        None,
        description="为 true 时仅返回待治理（检查中/维修中）；与 status 同时传入时以 status 为准",
    ),
):
    qs = tenant_alive(HaoligoHazardReport, tenant_id)
    if status_filter:
        qs = qs.filter(status=status_filter)
    elif for_remediation:
        qs = qs.filter(status__in=["检查中", "维修中"])
    total = await qs.count()
    rows = await qs.order_by("-reported_at", "-id").offset(skip).limit(limit)
    items = [await _serialize_hazard(r, tenant_id) for r in rows]
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
    hn = (body.handler_name or "").strip()
    eff_status = body.status or "检查中"
    if body.handled_at is not None and hn:
        eff_status = "已完成"
    elif (body.solution_note or "").strip():
        eff_status = "维修中"
    if eff_status == "已完成":
        _ensure_completed_requirements(
            body.solution_note,
            body.handler_name,
            body.handled_at,
        )
    reg_uid, reg_name = await _resolve_registrant_on_create(
        tenant_id, user, body.registrant_user_id
    )
    res_uid: Optional[int] = None
    res_name: Optional[str] = None
    if body.responsible_user_id is not None:
        res_uid, res_name = await resolve_tenant_user(tenant_id, body.responsible_user_id)
    row = await HaoligoHazardReport.create(
        tenant_id=tenant_id,
        workshop_id=body.workshop_id,
        workshop_area=body.workshop_area,
        reported_at=body.reported_at or timezone.now(),
        issue_type_code=body.issue_type_code,
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
    data = body.model_dump(exclude_unset=True)
    if "workshop_id" in data and data["workshop_id"] is not None:
        if not await tenant_alive(HaoligoWorkshop, tenant_id).filter(id=data["workshop_id"]).exists():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
    await _apply_user_fields_patch(data, tenant_id)
    for k, v in data.items():
        setattr(row, k, v)
    _apply_hazard_status(row)
    if row.status == "已完成":
        _ensure_completed_requirements(
            row.solution_note,
            row.handler_name,
            row.handled_at,
        )
    await row.save()
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
