"""好力 GO — 设备状态调整单 API（提交后更新设备运行状态并记审计日志）。"""

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._equipment_sheet_code import generate_equipment_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.equipment_sheet_rule_codes import HAOLIGO_EQUIPMENT_STATUS_ADJUSTMENT_NO
from apps.haoligo.models.equipment import HaoligoEquipment
from apps.haoligo.models.equipment_operations import HaoligoEquipmentStatusAdjustment
from apps.haoligo.models.equipment_status_log import HaoligoEquipmentOperationalStatusLog
from apps.haoligo.services.equipment_operational_status import normalize_operational_status
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/equipment/status-adjustments",
    tags=["App · HaoliGO · 设备状态调整单"],
)


def _parse_dt(v: Optional[str]) -> Optional[datetime]:
    if not v or not str(v).strip():
        return None
    s = str(v).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


class StatusAdjustmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    recorded_at: datetime
    equipment_id: int
    equipment_asset_code: Optional[str] = None
    equipment_name: Optional[str] = None
    old_operational_status: Optional[str] = None
    new_operational_status: str
    remark: Optional[str] = None
    reporter_user_id: int
    created_at: datetime


class StatusAdjustmentCreate(BaseModel):
    equipment_id: int = Field(ge=1, description="设备主键")
    new_operational_status: str = Field(min_length=1, description="调整后运行状态（数据字典 value）")
    recorded_at: Optional[datetime] = Field(None, description="调整时间，缺省为当前时间")
    remark: Optional[str] = Field(None, description="备注")


class StatusAdjustmentUpdate(BaseModel):
    recorded_at: Optional[datetime] = None
    remark: Optional[str] = None


async def _serialize(row: HaoligoEquipmentStatusAdjustment) -> StatusAdjustmentOut:
    await row.fetch_related("equipment")
    eq = row.equipment
    return StatusAdjustmentOut(
        id=row.id,
        uuid=str(row.uuid),
        sheet_no=row.sheet_no,
        recorded_at=row.recorded_at,
        equipment_id=row.equipment_id,
        equipment_asset_code=getattr(eq, "asset_code", None) if eq else None,
        equipment_name=getattr(eq, "name", None) if eq else None,
        old_operational_status=row.old_operational_status,
        new_operational_status=row.new_operational_status,
        remark=row.remark,
        reporter_user_id=row.reporter_user_id,
        created_at=row.created_at,
    )


@router.get("", summary="设备状态调整单分页列表")
async def list_status_adjustments(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    equipment_id: Optional[int] = Query(None, ge=1),
    sheet_no: Optional[str] = None,
    recorded_from: Optional[str] = None,
    recorded_to: Optional[str] = None,
    keyword: Optional[str] = None,
):
    qs = tenant_alive(HaoligoEquipmentStatusAdjustment, tenant_id).prefetch_related("equipment")
    if equipment_id is not None:
        qs = qs.filter(equipment_id=equipment_id)
    if sheet_no and sheet_no.strip():
        qs = qs.filter(sheet_no__icontains=sheet_no.strip())
    rf = _parse_dt(recorded_from)
    rt = _parse_dt(recorded_to)
    if rf:
        qs = qs.filter(recorded_at__gte=rf)
    if rt:
        qs = qs.filter(recorded_at__lte=rt)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(sheet_no__icontains=k)
            | Q(remark__icontains=k)
            | Q(new_operational_status__icontains=k)
            | Q(old_operational_status__icontains=k)
            | Q(equipment__asset_code__icontains=k)
            | Q(equipment__name__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    return {
        "items": [await _serialize(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=StatusAdjustmentOut, summary="创建设备状态调整单")
async def create_status_adjustment(
    body: StatusAdjustmentCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=body.equipment_id).first()
    if not eq:
        await _not_found()
    new_status = await normalize_operational_status(tenant_id, body.new_operational_status)
    if not new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择调整后的运行状态")
    old_status = eq.operational_status
    if (old_status or "").strip().lower() == new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="调整后状态与当前状态相同，无需建单")
    rec_at = body.recorded_at or timezone.now()
    remark = (body.remark or "").strip() or None
    async with in_transaction():
        try:
            sheet_no = await generate_equipment_sheet_no(tenant_id, HAOLIGO_EQUIPMENT_STATUS_ADJUSTMENT_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoEquipmentStatusAdjustment.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            recorded_at=rec_at,
            equipment=eq,
            old_operational_status=old_status,
            new_operational_status=new_status,
            remark=remark,
            reporter_user_id=user.id,
        )
        eq.operational_status = new_status
        await eq.save()
        await HaoligoEquipmentOperationalStatusLog.create(
            tenant_id=tenant_id,
            equipment_id=eq.id,
            old_status=old_status,
            new_status=new_status,
            changed_by_user_id=user.id,
        )
    return await _serialize(row)


@router.get("/{row_id}", response_model=StatusAdjustmentOut, summary="设备状态调整单详情")
async def get_status_adjustment(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = (
        await tenant_alive(HaoligoEquipmentStatusAdjustment, tenant_id)
        .filter(id=row_id)
        .prefetch_related("equipment")
        .first()
    )
    if not row:
        await _not_found()
    return await _serialize(row)


@router.patch("/{row_id}", response_model=StatusAdjustmentOut, summary="更新设备状态调整单（仅备注与时间）")
async def update_status_adjustment(
    row_id: int,
    body: StatusAdjustmentUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentStatusAdjustment, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    if "remark" in data and data["remark"] is not None:
        data["remark"] = str(data["remark"]).strip() or None
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return await _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备状态调整单")
async def delete_status_adjustment(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentStatusAdjustment, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
