"""好力 GO — 模具主数据 API。"""

import asyncio
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_borrow_sheet import HaoligoMoldBorrowSheet
from apps.haoligo.models.mold_ledger_dataset_binding import HaoligoMoldLedgerDatasetBinding
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_maintenance_sheet import HaoligoMoldMaintenanceSheet
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import HaoligoMoldOutsourceMaintenanceCompleteSheet
from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
from apps.haoligo.models.mold_return_sheet import HaoligoMoldReturnSheet
from core.api.deps.deps import get_current_tenant, get_current_user
from core.schemas.dataset import ExecuteQueryRequest
from core.services.data.dataset_service import DatasetService
from infra.models.user import User

router = APIRouter(prefix="/molds", tags=["App · HaoliGO · 模具"])


class MoldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    mold_code: str
    name: str
    unit: str = ""
    mold_capacity: Decimal = Decimal("0")
    processing_time_min: Optional[int] = None
    service_life_years: Optional[int] = None
    usable_times: Optional[int] = None
    usable_yield: Optional[Decimal] = None
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = None
    allow_repeated_borrow: bool = True
    purchase_vendor_name: Optional[str] = None
    status: str
    total_manufacture_qty: Decimal
    outsource_vendor_code: Optional[str] = None
    outsource_vendor_name: Optional[str] = None
    erp_material_code: Optional[str] = None
    remark: Optional[str] = None
    used_times: int = 0
    used_yield: Decimal = Decimal("0")


class MoldCreate(BaseModel):
    mold_code: str = Field(max_length=64)
    name: str = Field(max_length=200)
    unit: str = Field(default="", max_length=32)
    mold_capacity: Decimal = Field(default=Decimal("0"))
    service_life_years: Optional[int] = Field(None, ge=0)
    usable_times: Optional[int] = Field(None, ge=0)
    usable_yield: Optional[Decimal] = None
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)
    allow_repeated_borrow: bool = True
    purchase_vendor_name: Optional[str] = Field(None, max_length=200)
    status: str = Field(default="待用", max_length=32)
    total_manufacture_qty: Decimal = Field(default=Decimal("0"))
    outsource_vendor_code: Optional[str] = Field(None, max_length=64)
    outsource_vendor_name: Optional[str] = Field(None, max_length=200)
    erp_material_code: Optional[str] = Field(None, max_length=64)
    remark: Optional[str] = None


class MoldUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    unit: Optional[str] = Field(None, max_length=32)
    mold_capacity: Optional[Decimal] = None
    service_life_years: Optional[int] = Field(None, ge=0)
    usable_times: Optional[int] = Field(None, ge=0)
    usable_yield: Optional[Decimal] = None
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)
    allow_repeated_borrow: Optional[bool] = None
    purchase_vendor_name: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, max_length=32)
    total_manufacture_qty: Optional[Decimal] = None
    outsource_vendor_code: Optional[str] = Field(None, max_length=64)
    outsource_vendor_name: Optional[str] = Field(None, max_length=200)
    erp_material_code: Optional[str] = Field(None, max_length=64)
    remark: Optional[str] = None


_LIFECYCLE_BATCH_FIELDS = frozenset(
    {
        "service_life_years",
        "usable_times",
        "usable_yield",
        "maintenance_cycle_by_yield",
        "maintenance_cycle_by_days",
    }
)


class MoldBatchLifecycleBody(BaseModel):
    """批量更新模具台账中与「寿命 / 额定次数与产量 / 维修周期」相关的数值字段。"""

    scope: Literal["selected", "all_filtered"]
    mold_ids: Optional[List[int]] = None
    filter_status: Optional[str] = None
    filter_keyword: Optional[str] = None
    service_life_years: Optional[int] = Field(None, ge=0)
    usable_times: Optional[int] = Field(None, ge=0)
    usable_yield: Optional[Decimal] = None
    maintenance_cycle_by_yield: Optional[Decimal] = None
    maintenance_cycle_by_days: Optional[int] = Field(None, ge=0)

    @model_validator(mode="after")
    def validate_scope(self) -> "MoldBatchLifecycleBody":
        if self.scope == "selected":
            if not self.mold_ids:
                raise ValueError("按选中更新时请传入 mold_ids")
            if len(self.mold_ids) > 5000:
                raise ValueError("单次勾选更新不超过 5000 条")
        return self


class MoldBatchLifecycleOut(BaseModel):
    updated: int


def _molds_filtered_queryset(tenant_id: int, status_filter: Optional[str], keyword: Optional[str]):
    """与列表接口一致的筛选条件（用于「当前筛选全部」批量更新）。"""
    qs = tenant_alive(HaoligoMold, tenant_id)
    if status_filter:
        qs = qs.filter(status=status_filter)
    kw = (keyword or "").strip()
    if kw:
        q_text = (
            Q(mold_code__icontains=kw)
            | Q(name__icontains=kw)
            | Q(unit__icontains=kw)
            | Q(purchase_vendor_name__icontains=kw)
            | Q(outsource_vendor_code__icontains=kw)
            | Q(outsource_vendor_name__icontains=kw)
            | Q(erp_material_code__icontains=kw)
            | Q(remark__icontains=kw)
        )
        try:
            num = Decimal(kw.replace(",", ""))
            q_text |= Q(mold_capacity=num) | Q(total_manufacture_qty=num)
        except (InvalidOperation, ValueError):
            pass
        qs = qs.filter(q_text)
    return qs


class MoldLedgerDatasetBindingOut(BaseModel):
    """模具台账关联数据集：列名与 SQL 结果别名一致。"""

    dataset_uuid: Optional[str] = None
    mold_code_column: Optional[str] = None
    mold_name_column: Optional[str] = None
    unit_column: Optional[str] = None
    mold_capacity_column: Optional[str] = None


class MoldLedgerDatasetBindingUpsert(BaseModel):
    dataset_uuid: Optional[str] = None
    mold_code_column: Optional[str] = None
    mold_name_column: Optional[str] = None
    unit_column: Optional[str] = None
    mold_capacity_column: Optional[str] = None


class MoldLedgerSyncOut(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _serialize_ledger_binding(row: Optional[HaoligoMoldLedgerDatasetBinding]) -> MoldLedgerDatasetBindingOut:
    if not row:
        return MoldLedgerDatasetBindingOut()
    return MoldLedgerDatasetBindingOut(
        dataset_uuid=row.dataset_uuid,
        mold_code_column=row.mold_code_column,
        mold_name_column=row.mold_name_column,
        unit_column=row.unit_column,
        mold_capacity_column=row.mold_capacity_column,
    )


def _decimal_from_dataset_cell(val) -> Decimal:
    """将数据集单元格解析为模具产能（非数字或空视为 0）。"""
    if val is None:
        return Decimal("0")
    if isinstance(val, Decimal):
        return val
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return Decimal(str(val))
    s = str(val).strip()
    if not s:
        return Decimal("0")
    try:
        return Decimal(s.replace(",", ""))
    except Exception:
        return Decimal("0")


@router.get("/ledger/dataset-binding", response_model=MoldLedgerDatasetBindingOut, summary="模具台账关联数据集配置")
async def get_mold_ledger_dataset_binding(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldLedgerDatasetBinding, tenant_id).first()
    return _serialize_ledger_binding(row)


@router.put("/ledger/dataset-binding", response_model=MoldLedgerDatasetBindingOut, summary="保存模具台账关联数据集配置")
async def put_mold_ledger_dataset_binding(
    body: MoldLedgerDatasetBindingUpsert,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    ds = (body.dataset_uuid or "").strip()
    if not ds:
        await HaoligoMoldLedgerDatasetBinding.filter(tenant_id=tenant_id).delete()
        return MoldLedgerDatasetBindingOut()

    mc = (body.mold_code_column or "").strip()
    mn = (body.mold_name_column or "").strip()
    uc = (body.unit_column or "").strip()
    cap_c = (body.mold_capacity_column or "").strip() or None
    if not all([mc, mn, uc]):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="已选择数据集时，请填写模具代号、模具名称、单位对应的结果列名（与 SQL 查询结果列别名一致）",
        )

    await HaoligoMoldLedgerDatasetBinding.filter(tenant_id=tenant_id).delete()
    row = await HaoligoMoldLedgerDatasetBinding.create(
        tenant_id=tenant_id,
        dataset_uuid=ds,
        mold_code_column=mc,
        mold_name_column=mn,
        unit_column=uc,
        mold_capacity_column=cap_c,
    )
    return _serialize_ledger_binding(row)


@router.post("/ledger/sync-from-dataset", response_model=MoldLedgerSyncOut, summary="从绑定数据集同步模具代号/名称/单位/产能")
async def sync_mold_ledger_from_dataset(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    binding = await tenant_alive(HaoligoMoldLedgerDatasetBinding, tenant_id).first()
    if not binding or not (binding.dataset_uuid or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先在「关联数据集配置」中选择数据集并保存列映射",
        )
    mc = (binding.mold_code_column or "").strip()
    mn = (binding.mold_name_column or "").strip()
    uc = (binding.unit_column or "").strip()
    cap_c = (binding.mold_capacity_column or "").strip()
    if not all([mc, mn, uc]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="数据集列映射不完整，请重新保存配置",
        )

    ds_uuid = binding.dataset_uuid.strip()
    svc = DatasetService()
    all_rows: List[dict] = []
    offset = 0
    page_size = 2000
    while True:
        res = await svc.execute_query(
            tenant_id,
            UUID(ds_uuid),
            ExecuteQueryRequest(parameters={}, limit=page_size, offset=offset),
        )
        if not res.success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=res.error or "数据集查询失败",
            )
        chunk = list(res.data or [])
        if not chunk:
            break
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += len(chunk)

    created = 0
    updated = 0
    skipped = 0
    for raw in all_rows:
        row = raw if isinstance(raw, dict) else {}
        mold_code = str(row.get(mc) or "").strip()
        if not mold_code:
            skipped += 1
            continue
        name = str(row.get(mn) or "").strip() or mold_code
        unit = str(row.get(uc) or "").strip()
        cap_for_row = _decimal_from_dataset_cell(row.get(cap_c)) if cap_c else Decimal("0")

        existing = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mold_code).first()
        if existing:
            existing.name = name
            existing.unit = unit
            if cap_c:
                existing.mold_capacity = cap_for_row
            await existing.save()
            updated += 1
        else:
            await HaoligoMold.create(
                tenant_id=tenant_id,
                mold_code=mold_code,
                name=name,
                unit=unit,
                mold_capacity=cap_for_row,
                processing_time_min=None,
                service_life_years=None,
                usable_times=None,
                usable_yield=None,
                maintenance_cycle_by_yield=None,
                maintenance_cycle_by_days=None,
                allow_repeated_borrow=True,
                purchase_vendor_name=None,
                status="待用",
                total_manufacture_qty=Decimal("0"),
                outsource_vendor_code=None,
                outsource_vendor_name=None,
                erp_material_code=None,
                remark=None,
                used_times=0,
                used_yield=Decimal("0"),
            )
            created += 1

    return MoldLedgerSyncOut(created=created, updated=updated, skipped=skipped)


@router.post(
    "/batch-lifecycle",
    response_model=MoldBatchLifecycleOut,
    summary="批量更新可用年限/额定可用次数/额定可用产量及维修周期",
)
async def batch_update_mold_lifecycle(
    body: MoldBatchLifecycleBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    patch_raw = body.model_dump(
        exclude_unset=True,
        exclude={"scope", "mold_ids", "filter_status", "filter_keyword"},
    )
    patch = {k: v for k, v in patch_raw.items() if k in _LIFECYCLE_BATCH_FIELDS and v is not None}
    if not patch:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="请至少指定一个要修改的字段",
        )

    if body.scope == "selected":
        qs = tenant_alive(HaoligoMold, tenant_id).filter(id__in=body.mold_ids)
    else:
        st = (body.filter_status or "").strip() or None
        kw = body.filter_keyword
        qs = _molds_filtered_queryset(tenant_id, st, kw)

    n = await qs.count()
    if n > 50_000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="匹配条数超过 5 万，请缩小筛选或分批操作",
        )
    if n == 0:
        return MoldBatchLifecycleOut(updated=0)
    await qs.update(**patch)
    return MoldBatchLifecycleOut(updated=n)


@router.get("", summary="模具分页列表")
async def list_molds(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    keyword: Optional[str] = Query(
        None,
        description="模糊匹配：模具代号、名称、单位、购买/外协厂商与代号、ERP 物料编码、备注；纯数字时额外精确匹配模具产能与总制造数量",
    ),
):
    qs = _molds_filtered_queryset(tenant_id, status_filter, keyword)
    total = await qs.count()
    rows = await qs.order_by("mold_code").offset(skip).limit(limit)
    return {
        "items": [MoldOut.model_validate(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


_JSON_SHEET_SCAN_LIMIT = 800
_BORROW_RETURN_LIMIT = 200
_OPERATION_RECORDS_CAP = 500

MoldOperationKind = Literal[
    "borrow",
    "return",
    "maintenance",
    "maintenance_complete",
    "outsource_maintenance",
    "outsource_maintenance_complete",
]


class MoldOperationRecordOut(BaseModel):
    """模具台账详情用：领出/还入/维保类单据摘要（按创建时间倒序合并）。"""

    kind: MoldOperationKind
    occurred_at: datetime
    record_id: int
    uuid: str
    title: str
    detail: str = ""


class MoldOperationRecordsResponse(BaseModel):
    items: List[MoldOperationRecordOut]


def _line_items_contain_mold(raw, mold_code: str) -> bool:
    m = (mold_code or "").strip()
    if not m or raw is None:
        return False
    if not isinstance(raw, list):
        return False
    for item in raw:
        if not isinstance(item, dict):
            continue
        if str(item.get("mold_code") or "").strip() == m:
            return True
    return False


async def _scan_sheets_with_mold_in_lines(model, tenant_id: int, mold_code: str):
    qs = tenant_alive(model, tenant_id).order_by("-created_at").limit(_JSON_SHEET_SCAN_LIMIT)
    rows = await qs
    return [r for r in rows if _line_items_contain_mold(r.line_items, mold_code)]


@router.get(
    "/{row_id}/operation-records",
    response_model=MoldOperationRecordsResponse,
    summary="模具关联操作记录（领用/还入/厂内外协维保与完修）",
)
async def list_mold_operation_records(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(id=row_id).first()
    if not mold:
        await _not_found()
    mcode = (mold.mold_code or "").strip()

    async def load_borrows():
        return await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(mold_code=mcode).order_by(
            "-created_at"
        ).limit(_BORROW_RETURN_LIMIT)

    async def load_returns():
        return await tenant_alive(HaoligoMoldReturnSheet, tenant_id).filter(mold_code=mcode).order_by(
            "-created_at"
        ).limit(_BORROW_RETURN_LIMIT)

    borrows, returns, mains, completes, outs, out_completes = await asyncio.gather(
        load_borrows(),
        load_returns(),
        _scan_sheets_with_mold_in_lines(HaoligoMoldMaintenanceSheet, tenant_id, mcode),
        _scan_sheets_with_mold_in_lines(HaoligoMoldMaintenanceCompleteSheet, tenant_id, mcode),
        _scan_sheets_with_mold_in_lines(HaoligoMoldOutsourceMaintenanceSheet, tenant_id, mcode),
        _scan_sheets_with_mold_in_lines(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id, mcode),
    )

    events: List[MoldOperationRecordOut] = []

    for b in borrows:
        parts: List[str] = []
        dn = (b.department_name or "").strip()
        if dn:
            parts.append(f"领用部门：{dn}")
        so = (b.source_order_no or "").strip()
        if so:
            parts.append(f"来源单号：{so}")
        events.append(
            MoldOperationRecordOut(
                kind="borrow",
                occurred_at=b.created_at,
                record_id=b.id,
                uuid=b.uuid,
                title="领出（领用单）",
                detail="；".join(parts),
            )
        )

    for r in returns:
        parts = [f"制造数量：{r.manufacture_qty}"]
        po = (r.production_order_no or "").strip()
        if po:
            parts.append(f"制令：{po}")
        br = (r.borrow_sheet_no or "").strip()
        if br:
            parts.append(f"领用单：{br}")
        dn = (r.issue_department_name or "").strip()
        if dn:
            parts.append(f"领出部门：{dn}")
        events.append(
            MoldOperationRecordOut(
                kind="return",
                occurred_at=r.created_at,
                record_id=r.id,
                uuid=r.uuid,
                title="还入（还入单）",
                detail="；".join(parts),
            )
        )

    for m in mains:
        parts: List[str] = []
        dn = (m.department_name or "").strip()
        if dn:
            parts.append(f"申请部门：{dn}")
        parts.append(f"类型：{m.service_type}")
        so = (m.source_order_no or "").strip()
        if so:
            parts.append(f"来源单号：{so}")
        events.append(
            MoldOperationRecordOut(
                kind="maintenance",
                occurred_at=m.created_at,
                record_id=m.id,
                uuid=m.uuid,
                title="厂内维保（申请）",
                detail="；".join(parts),
            )
        )

    for m in completes:
        parts = [f"来源单号：{m.source_order_no}", f"类型：{m.service_type}"]
        if m.clear_total_production:
            parts.append("已清空总产量")
        events.append(
            MoldOperationRecordOut(
                kind="maintenance_complete",
                occurred_at=m.created_at,
                record_id=m.id,
                uuid=m.uuid,
                title="维保完修",
                detail="；".join(parts),
            )
        )

    for m in outs:
        parts = [
            f"外协单位：{(m.outsourced_unit_name or '').strip() or '—'}",
            f"类型：{m.service_type}",
        ]
        so = (m.source_order_no or "").strip()
        if so:
            parts.append(f"来源单号：{so}")
        events.append(
            MoldOperationRecordOut(
                kind="outsource_maintenance",
                occurred_at=m.created_at,
                record_id=m.id,
                uuid=m.uuid,
                title="外协维保（申请）",
                detail="；".join(parts),
            )
        )

    for m in out_completes:
        parts = [
            f"外协单位：{(m.outsourced_unit_name or '').strip() or '—'}",
            f"来源单号：{m.source_order_no}",
            f"类型：{m.service_type}",
        ]
        if m.clear_total_production:
            parts.append("已清空总产量")
        events.append(
            MoldOperationRecordOut(
                kind="outsource_maintenance_complete",
                occurred_at=m.created_at,
                record_id=m.id,
                uuid=m.uuid,
                title="外协维保完修",
                detail="；".join(parts),
            )
        )

    events.sort(key=lambda x: (x.occurred_at, x.record_id), reverse=True)
    return MoldOperationRecordsResponse(items=events[:_OPERATION_RECORDS_CAP])


@router.post("", response_model=MoldOut, summary="创建模具")
async def create_mold(
    body: MoldCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await HaoligoMold.create(
        tenant_id=tenant_id,
        mold_code=body.mold_code.strip(),
        name=body.name.strip(),
        unit=(body.unit or "").strip(),
        mold_capacity=body.mold_capacity,
        service_life_years=body.service_life_years,
        usable_times=body.usable_times,
        usable_yield=body.usable_yield,
        maintenance_cycle_by_yield=body.maintenance_cycle_by_yield,
        maintenance_cycle_by_days=body.maintenance_cycle_by_days,
        allow_repeated_borrow=body.allow_repeated_borrow,
        purchase_vendor_name=((body.purchase_vendor_name or "").strip() or None),
        status=body.status,
        total_manufacture_qty=body.total_manufacture_qty,
        outsource_vendor_code=body.outsource_vendor_code,
        outsource_vendor_name=body.outsource_vendor_name,
        erp_material_code=body.erp_material_code,
        remark=body.remark,
        used_times=0,
        used_yield=Decimal("0"),
    )
    return MoldOut.model_validate(row)


@router.get("/{row_id}", response_model=MoldOut, summary="模具详情")
async def get_mold(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMold, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return MoldOut.model_validate(row)


@router.patch("/{row_id}", response_model=MoldOut, summary="更新模具")
async def update_mold(
    row_id: int,
    body: MoldUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMold, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if isinstance(v, str):
            v = v.strip()
        setattr(row, k, v)
    await row.save()
    return MoldOut.model_validate(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除模具")
async def delete_mold(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMold, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
