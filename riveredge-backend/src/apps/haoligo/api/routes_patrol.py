"""好力 GO — 巡查隐患单 API。"""

from datetime import datetime
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone

from apps.haoligo.api._qs import tenant_alive
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


class HazardUpdate(BaseModel):
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


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


@router.get("", summary="隐患单分页")
async def list_hazards(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    qs = tenant_alive(HaoligoHazardReport, tenant_id)
    if status_filter:
        qs = qs.filter(status=status_filter)
    total = await qs.count()
    rows = await qs.order_by("-reported_at", "-id").offset(skip).limit(limit)
    return {
        "items": [HazardOut.model_validate(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=HazardOut, summary="创建隐患单")
async def create_hazard(
    body: HazardCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    if body.workshop_id is not None and not await tenant_alive(HaoligoWorkshop, tenant_id).filter(
        id=body.workshop_id
    ).exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="车间不存在")
    row = await HaoligoHazardReport.create(
        tenant_id=tenant_id,
        workshop_id=body.workshop_id,
        workshop_area=body.workshop_area,
        reported_at=body.reported_at or timezone.now(),
        issue_type_code=body.issue_type_code,
        problem_summary=body.problem_summary,
        solution_note=body.solution_note,
        status=body.status,
        before_image_file_ids=body.before_image_file_ids,
        after_image_file_ids=body.after_image_file_ids,
    )
    return HazardOut.model_validate(row)


@router.get("/{row_id}", response_model=HazardOut, summary="隐患单详情")
async def get_hazard(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoHazardReport, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return HazardOut.model_validate(row)


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
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return HazardOut.model_validate(row)


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
