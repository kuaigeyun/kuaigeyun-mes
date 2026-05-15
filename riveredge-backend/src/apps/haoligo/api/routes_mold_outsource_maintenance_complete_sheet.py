"""好力 GO — 外协维保完修单 API。"""

from decimal import Decimal
from typing import Annotated, Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._mold_maintenance_mold_status import (
    refresh_mold_status_after_maintenance_completed,
    unique_mold_codes_from_stored_line_items,
)
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/molds/outsource-maintenance-complete-sheets",
    tags=["App · HaoliGO · 外协维保完修单"],
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
    return s


def _strip_opt(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


class OutsourceCompleteLineIn(BaseModel):
    mold_code: str = Field(max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    repair_reason: Optional[str] = Field(None, max_length=500)
    repair_cost: Optional[Decimal] = None
    attachment_file_uuids: Optional[List[str]] = None

    @field_validator("mold_code", mode="before")
    @classmethod
    def strip_code(cls, v):
        if v is None:
            raise ValueError("模具代号不能为空")
        s = str(v).strip()
        if not s:
            raise ValueError("模具代号不能为空")
        return s

    @field_validator("mold_name", "repair_reason", mode="before")
    @classmethod
    def strip_opt(cls, v):
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
    repair_cost: Optional[Decimal] = None
    attachment_file_uuids: List[str] = Field(default_factory=list)


def _line_to_store(line: OutsourceCompleteLineIn) -> dict[str, Any]:
    return {
        "mold_code": line.mold_code.strip(),
        "mold_name": line.mold_name,
        "repair_reason": line.repair_reason,
        "repair_cost": str(line.repair_cost) if line.repair_cost is not None else None,
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
        repair_cost=rc,
        attachment_file_uuids=_norm_uuid_list(raw.get("attachment_file_uuids")),
    )


class MoldOutsourceMaintenanceCompleteSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    source_outsource_maintenance_sheet_id: Optional[int] = None
    source_order_no: str
    outsourced_unit_code: Optional[str] = None
    outsourced_unit_name: str
    service_type: str
    clear_total_production: bool
    header_attachment_file_uuids: List[str] = Field(default_factory=list)
    line_items: List[OutsourceCompleteLineOut] = Field(default_factory=list)
    primary_mold_code: Optional[str] = Field(None, description="首行模具代号")


class MoldOutsourceMaintenanceCompleteSheetCreate(BaseModel):
    source_outsource_maintenance_sheet_id: Optional[int] = Field(None, ge=1)
    source_order_no: str = Field(max_length=128)
    outsourced_unit_code: Optional[str] = Field(None, max_length=64)
    outsourced_unit_name: str = Field(max_length=200)
    service_type: ServiceTypeLiteral
    clear_total_production: bool = False
    header_attachment_file_uuids: Optional[List[str]] = None
    line_items: List[OutsourceCompleteLineIn] = Field(min_length=1)

    @field_validator("source_order_no", "outsourced_unit_name", mode="before")
    @classmethod
    def strip_req(cls, v):
        if v is None:
            raise ValueError("不能为空")
        s = str(v).strip()
        if not s:
            raise ValueError("不能为空")
        return s


class MoldOutsourceMaintenanceCompleteSheetUpdate(BaseModel):
    source_outsource_maintenance_sheet_id: Optional[int] = Field(None, ge=1)
    source_order_no: Optional[str] = Field(None, max_length=128)
    outsourced_unit_code: Optional[str] = Field(None, max_length=64)
    outsourced_unit_name: Optional[str] = Field(None, max_length=200)
    service_type: Optional[ServiceTypeLiteral] = None
    clear_total_production: Optional[bool] = None
    header_attachment_file_uuids: Optional[List[str]] = None
    line_items: Optional[List[OutsourceCompleteLineIn]] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _primary_mold(lines: List[OutsourceCompleteLineOut]) -> Optional[str]:
    if not lines:
        return None
    c = (lines[0].mold_code or "").strip()
    return c or None


def _serialize(row: HaoligoMoldOutsourceMaintenanceCompleteSheet) -> MoldOutsourceMaintenanceCompleteSheetOut:
    raw_lines = row.line_items or []
    lines: List[OutsourceCompleteLineOut] = []
    if isinstance(raw_lines, list):
        for item in raw_lines:
            if isinstance(item, dict):
                lines.append(_line_from_store(item))
    return MoldOutsourceMaintenanceCompleteSheetOut(
        id=row.id,
        uuid=row.uuid,
        source_outsource_maintenance_sheet_id=row.source_outsource_maintenance_sheet_id,
        source_order_no=row.source_order_no,
        outsourced_unit_code=row.outsourced_unit_code,
        outsourced_unit_name=row.outsourced_unit_name,
        service_type=row.service_type,
        clear_total_production=bool(row.clear_total_production),
        header_attachment_file_uuids=list(row.header_attachment_file_uuids or []),
        line_items=lines,
        primary_mold_code=_primary_mold(lines),
    )


@router.get("", summary="外协维保完修单分页列表")
async def list_outsource_maintenance_complete_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
):
    qs = tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(source_order_no__icontains=k)
            | Q(service_type__icontains=k)
            | Q(outsourced_unit_name__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    return {
        "items": [_serialize(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=MoldOutsourceMaintenanceCompleteSheetOut, summary="创建外协维保完修单")
async def create_outsource_maintenance_complete_sheet(
    body: MoldOutsourceMaintenanceCompleteSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    stored = [_line_to_store(x) for x in body.line_items]
    async with in_transaction():
        row = await HaoligoMoldOutsourceMaintenanceCompleteSheet.create(
            tenant_id=tenant_id,
            source_outsource_maintenance_sheet_id=body.source_outsource_maintenance_sheet_id,
            source_order_no=body.source_order_no.strip(),
            outsourced_unit_code=_strip_opt(body.outsourced_unit_code) if body.outsourced_unit_code else None,
            outsourced_unit_name=body.outsourced_unit_name.strip(),
            service_type=body.service_type,
            clear_total_production=body.clear_total_production,
            header_attachment_file_uuids=_norm_uuid_list(body.header_attachment_file_uuids),
            line_items=stored,
        )
        for mc in unique_mold_codes_from_stored_line_items(stored):
            await refresh_mold_status_after_maintenance_completed(tenant_id, mc)
    return _serialize(row)


@router.get("/{row_id}", response_model=MoldOutsourceMaintenanceCompleteSheetOut, summary="外协维保完修单详情")
async def get_outsource_maintenance_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return _serialize(row)


@router.patch("/{row_id}", response_model=MoldOutsourceMaintenanceCompleteSheetOut, summary="更新外协维保完修单")
async def update_outsource_maintenance_complete_sheet(
    row_id: int,
    body: MoldOutsourceMaintenanceCompleteSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    if "source_order_no" in data and data["source_order_no"] is not None:
        s = str(data["source_order_no"]).strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="来源单号不能为空")
        data["source_order_no"] = s
    if "outsourced_unit_name" in data and data["outsourced_unit_name"] is not None:
        u = str(data["outsourced_unit_name"]).strip()
        if not u:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="外协单位不能为空")
        data["outsourced_unit_name"] = u
    if "outsourced_unit_code" in data:
        v = data["outsourced_unit_code"]
        data["outsourced_unit_code"] = None if v is None else _strip_opt(str(v))
    if "header_attachment_file_uuids" in data and data["header_attachment_file_uuids"] is not None:
        data["header_attachment_file_uuids"] = _norm_uuid_list(data["header_attachment_file_uuids"])
    if "line_items" in data and data["line_items"] is not None:
        lines = [OutsourceCompleteLineIn.model_validate(x) for x in data["line_items"]]
        if not lines:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="至少保留一条模具信息")
        data["line_items"] = [_line_to_store(x) for x in lines]
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除外协维保完修单")
async def delete_outsource_maintenance_complete_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
