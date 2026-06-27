"""好力 GO — 模具领用单 API。"""

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any, Dict, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._mold_sheet_keyword import (
    apply_direct_mold_field_keyword_filter,
    borrow_sheet_header_keyword_q,
)
from apps.haoligo.api._mold_processing_time import (
    borrow_return_status_label,
    outstanding_borrow_ids_for_tenant,
    recompute_mold_processing_time_minutes,
)
from apps.haoligo.api._erp_mold_code import parse_erp_mold_code
from apps.haoligo.api._mold_ledger_sync import (
    count_active_borrow_sheets as _count_active_borrow_sheets,
    sync_mold_ledger_status_for_mold_code as _sync_mold_ledger_status_for_mold_code,
)
from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api._source_sheet_delete_guard import assert_no_return_sheets_for_borrow_sheet
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_borrow_dataset_binding import HaoligoMoldBorrowDatasetBinding
from apps.haoligo.models.mold_borrow_sheet import HaoligoMoldBorrowSheet
from apps.haoligo.constants.mold_sheet_rule_codes import HAOLIGO_MOLD_BORROW_SHEET_NO
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from core.models.department import Department
from core.schemas.dataset import ExecuteQueryRequest
from core.services.data.dataset_service import DatasetService
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/molds/borrow-sheets",
    tags=["App · HaoliGO · 领用单"],
    dependencies=[Depends(require_haoligo_module_access("molds-documents-borrow-out"))],
)


class MoldBorrowDatasetBindingOut(BaseModel):
    dataset_uuid: Optional[str] = None
    work_order_param_key: Optional[str] = None
    department_uuid_column: Optional[str] = None
    department_name_column: Optional[str] = None
    mold_code_column: Optional[str] = None
    mold_name_column: Optional[str] = None
    finished_product_code_column: Optional[str] = None
    finished_product_name_column: Optional[str] = None
    planned_qty_column: Optional[str] = None


class MoldBorrowDatasetBindingUpsert(BaseModel):
    dataset_uuid: Optional[str] = None
    work_order_param_key: Optional[str] = None
    department_uuid_column: Optional[str] = None
    department_name_column: Optional[str] = None
    mold_code_column: Optional[str] = None
    mold_name_column: Optional[str] = None
    finished_product_code_column: Optional[str] = None
    finished_product_name_column: Optional[str] = None
    planned_qty_column: Optional[str] = None


class MoldBorrowPrefillFromDatasetBody(BaseModel):
    source_order_no: str = Field(..., max_length=128, description="制令单号，作为数据集查询参数值")

    @field_validator("source_order_no")
    @classmethod
    def strip_so(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("制令单号不能为空")
        return s


class MoldBorrowPrefillFromDatasetOut(BaseModel):
    source_order_no: str
    department_uuid: Optional[str] = None
    department_name: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    finished_product_code: Optional[str] = None
    finished_product_name: Optional[str] = None
    planned_qty: Optional[Decimal] = None


def _serialize_borrow_binding(row: Optional[HaoligoMoldBorrowDatasetBinding]) -> MoldBorrowDatasetBindingOut:
    if not row:
        return MoldBorrowDatasetBindingOut()
    return MoldBorrowDatasetBindingOut(
        dataset_uuid=row.dataset_uuid,
        work_order_param_key=row.work_order_param_key,
        department_uuid_column=row.department_uuid_column,
        department_name_column=row.department_name_column,
        mold_code_column=row.mold_code_column,
        mold_name_column=row.mold_name_column,
        finished_product_code_column=row.finished_product_code_column,
        finished_product_name_column=row.finished_product_name_column,
        planned_qty_column=row.planned_qty_column,
    )


def _cell_str(row: dict, key: Optional[str]) -> str:
    if not key:
        return ""
    v = row.get(key)
    if v is None:
        return ""
    return str(v).strip()


def _cell_decimal(row: dict, key: Optional[str]) -> Optional[Decimal]:
    if not key:
        return None
    v = row.get(key)
    if v is None or v == "":
        return None
    if isinstance(v, Decimal):
        return v
    try:
        return Decimal(str(v).replace(",", "").strip())
    except (InvalidOperation, ValueError, TypeError):
        return None


async def _resolve_department_uuid_name(
    tenant_id: int,
    raw: dict,
    uuid_col: Optional[str],
    name_col: str,
) -> tuple[Optional[str], str]:
    name_val = _cell_str(raw, name_col)
    if not name_val:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="数据集结果中缺少领用部门名称（请检查部门名称列映射）",
        )
    uid_hint = _cell_str(raw, uuid_col) if uuid_col else ""
    if uid_hint and len(uid_hint) == 36:
        d = await Department.filter(
            uuid=uid_hint,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if d:
            return d.uuid, d.name
    d = await Department.filter(
        tenant_id=tenant_id,
        name=name_val,
        deleted_at__isnull=True,
    ).first()
    if d:
        return d.uuid, d.name
    return None, name_val


@router.get("/dataset-binding", response_model=MoldBorrowDatasetBindingOut, summary="领用单关联数据集配置")
async def get_mold_borrow_dataset_binding(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldBorrowDatasetBinding, tenant_id).first()
    return _serialize_borrow_binding(row)


@router.put("/dataset-binding", response_model=MoldBorrowDatasetBindingOut, summary="保存领用单关联数据集配置")
async def put_mold_borrow_dataset_binding(
    body: MoldBorrowDatasetBindingUpsert,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    ds = (body.dataset_uuid or "").strip()
    if not ds:
        await HaoligoMoldBorrowDatasetBinding.filter(tenant_id=tenant_id).delete()
        return MoldBorrowDatasetBindingOut()

    pk = (body.work_order_param_key or "").strip()
    if not pk:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="已选择数据集时，请填写制令单号对应的查询参数名（与 SQL 占位符一致）",
        )
    dname_c = (body.department_name_column or "").strip()
    mc = (body.mold_code_column or "").strip()
    mn = (body.mold_name_column or "").strip()
    if not dname_c:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="已选择数据集时，请填写领用部门名称对应的结果列名（模具列可不填，带出后支持手选模具）",
        )

    await HaoligoMoldBorrowDatasetBinding.filter(tenant_id=tenant_id).delete()
    row = await HaoligoMoldBorrowDatasetBinding.create(
        tenant_id=tenant_id,
        dataset_uuid=ds,
        work_order_param_key=pk,
        department_uuid_column=(body.department_uuid_column or "").strip() or None,
        department_name_column=dname_c,
        mold_code_column=mc or None,
        mold_name_column=mn or None,
        finished_product_code_column=(body.finished_product_code_column or "").strip() or None,
        finished_product_name_column=(body.finished_product_name_column or "").strip() or None,
        planned_qty_column=(body.planned_qty_column or "").strip() or None,
    )
    return _serialize_borrow_binding(row)


@router.post(
    "/prefill-from-dataset",
    response_model=MoldBorrowPrefillFromDatasetOut,
    summary="按制令单号查询数据集并带出领用单字段",
)
async def prefill_mold_borrow_from_dataset(
    body: MoldBorrowPrefillFromDatasetBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    binding = await tenant_alive(HaoligoMoldBorrowDatasetBinding, tenant_id).first()
    if not binding or not (binding.dataset_uuid or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先在「关联数据集配置」中选择数据集并保存列映射",
        )
    ds_uuid = binding.dataset_uuid.strip()
    param_key = (binding.work_order_param_key or "").strip()
    if not param_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="数据集绑定缺少制令单号查询参数名")

    dname_c = (binding.department_name_column or "").strip()
    mc = (binding.mold_code_column or "").strip()
    mn = (binding.mold_name_column or "").strip()
    if not dname_c:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="数据集列映射不完整：请配置领用部门名称列并保存（模具列可不填）",
        )

    uuid_c = (binding.department_uuid_column or "").strip() or None
    fcode_c = (binding.finished_product_code_column or "").strip() or None
    fname_c = (binding.finished_product_name_column or "").strip() or None
    pq_c = (binding.planned_qty_column or "").strip() or None

    svc = DatasetService()
    params: Dict[str, Any] = {param_key: body.source_order_no}
    res = await svc.execute_query(
        tenant_id,
        UUID(ds_uuid),
        ExecuteQueryRequest(parameters=params, limit=10, offset=0),
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
            detail="未查询到与制令单号匹配的数据，请检查参数名与数据集 SQL",
        )
    raw = rows[0] if isinstance(rows[0], dict) else {}

    dept_uuid, dept_name = await _resolve_department_uuid_name(tenant_id, raw, uuid_c, dname_c)
    mold_code = parse_erp_mold_code(_cell_str(raw, mc)) if mc else ""
    mold_name = _cell_str(raw, mn) if mn else ""

    if mold_code:
        mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mold_code).first()
        if mold and (mold.name or "").strip():
            mold_name = mold.name.strip()

    fcode = _cell_str(raw, fcode_c) if fcode_c else ""
    fname = _cell_str(raw, fname_c) if fname_c else ""
    pq = _cell_decimal(raw, pq_c) if pq_c else None

    return MoldBorrowPrefillFromDatasetOut(
        source_order_no=body.source_order_no,
        department_uuid=dept_uuid,
        department_name=dept_name,
        mold_code=mold_code[:64] if mold_code else None,
        mold_name=mold_name[:200] if mold_name else None,
        finished_product_code=fcode[:128] if fcode else None,
        finished_product_name=fname[:200] if fname else None,
        planned_qty=pq,
    )


class MoldBorrowSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    source_order_no: Optional[str] = None
    department_uuid: Optional[str] = None
    department_name: str
    mold_code: str
    mold_name: str
    finished_product_code: Optional[str] = None
    finished_product_name: Optional[str] = None
    planned_qty: Optional[Decimal] = None
    created_at: datetime
    return_status: Literal["已领用", "已还入"]


class MoldBorrowSheetCreate(BaseModel):
    source_order_no: Optional[str] = Field(None, max_length=128)
    department_uuid: Optional[str] = Field(None, max_length=36)
    department_name: str = Field(max_length=200)
    mold_code: str = Field(max_length=64)
    mold_name: str = Field(max_length=200)
    finished_product_code: Optional[str] = Field(None, max_length=128)
    finished_product_name: Optional[str] = Field(None, max_length=200)
    planned_qty: Optional[Decimal] = None

    @field_validator("department_name", "mold_code", "mold_name", mode="before")
    @classmethod
    def strip_required_strings(cls, v):
        if v is None:
            raise ValueError("不能为空")
        s = str(v).strip()
        if not s:
            raise ValueError("不能为空")
        return s


class MoldBorrowSheetUpdate(BaseModel):
    source_order_no: Optional[str] = Field(None, max_length=128)
    department_uuid: Optional[str] = Field(None, max_length=36)
    department_name: Optional[str] = Field(None, max_length=200)
    mold_code: Optional[str] = Field(None, max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    finished_product_code: Optional[str] = Field(None, max_length=128)
    finished_product_name: Optional[str] = Field(None, max_length=200)
    planned_qty: Optional[Decimal] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


async def _assert_mold_ledger_allows_borrow(
    tenant_id: int,
    mold_code: str,
    *,
    exclude_sheet_id: Optional[int] = None,
) -> None:
    """台账存在时校验可领用；无台账记录则不拦截（与历史行为一致）。"""
    mcode = mold_code.strip()
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mcode).first()
    if not mold:
        return
    if mold.status != "待用":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"模具台账状态为「{mold.status}」，仅「待用」状态的模具可领用",
        )
    n = await _count_active_borrow_sheets(tenant_id, mcode, exclude_id=exclude_sheet_id)
    if n > 0 and not mold.allow_repeated_borrow:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该模具已有未删除的领用单，台账未开启「允许重复领用」",
        )


def _serialize(row: HaoligoMoldBorrowSheet, *, outstanding_ids: set[int]) -> MoldBorrowSheetOut:
    return MoldBorrowSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        source_order_no=row.source_order_no,
        department_uuid=row.department_uuid,
        department_name=row.department_name,
        mold_code=row.mold_code,
        mold_name=row.mold_name,
        finished_product_code=row.finished_product_code,
        finished_product_name=row.finished_product_name,
        planned_qty=row.planned_qty,
        created_at=row.created_at,
        return_status=borrow_return_status_label(row.id, outstanding_ids),
    )


async def _serialize_one(row: HaoligoMoldBorrowSheet, tenant_id: int) -> MoldBorrowSheetOut:
    outstanding_ids = await outstanding_borrow_ids_for_tenant(tenant_id)
    return _serialize(row, outstanding_ids=outstanding_ids)


@router.get("", summary="领用单分页列表")
async def list_borrow_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
):
    qs = tenant_alive(HaoligoMoldBorrowSheet, tenant_id)
    qs = await apply_direct_mold_field_keyword_filter(
        qs, tenant_id, keyword, borrow_sheet_header_keyword_q
    )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    outstanding_ids = await outstanding_borrow_ids_for_tenant(tenant_id)
    return {
        "items": [_serialize(r, outstanding_ids=outstanding_ids) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


class MoldBorrowSourceOrderUsageOut(BaseModel):
    exists: bool
    count: int


@router.get(
    "/source-order-usage",
    response_model=MoldBorrowSourceOrderUsageOut,
    summary="按制令单号统计是否已有领用单",
)
async def get_borrow_source_order_usage(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    source_order_no: str = Query(..., min_length=1, max_length=128),
    exclude_sheet_id: Optional[int] = Query(
        None,
        ge=1,
        description="编辑弹窗中带出时排除当前领用单 id，避免把自身算作重复",
    ),
):
    s = source_order_no.strip()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="制令单号不能为空",
        )
    qs = tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(source_order_no=s)
    if exclude_sheet_id is not None:
        qs = qs.exclude(id=exclude_sheet_id)
    n = await qs.count()
    return MoldBorrowSourceOrderUsageOut(exists=n > 0, count=n)


@router.post("", response_model=MoldBorrowSheetOut, summary="创建领用单")
async def create_borrow_sheet(
    body: MoldBorrowSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    mcode = body.mold_code.strip()
    async with in_transaction():
        await _assert_mold_ledger_allows_borrow(tenant_id, mcode, exclude_sheet_id=None)
        try:
            sheet_no = await generate_mold_sheet_no(tenant_id, HAOLIGO_MOLD_BORROW_SHEET_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoMoldBorrowSheet.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            source_order_no=(body.source_order_no or "").strip() or None,
            department_uuid=(body.department_uuid or "").strip() or None,
            department_name=body.department_name.strip(),
            mold_code=mcode,
            mold_name=body.mold_name.strip(),
            finished_product_code=(body.finished_product_code or "").strip() or None,
            finished_product_name=(body.finished_product_name or "").strip() or None,
            planned_qty=body.planned_qty,
        )
        await _sync_mold_ledger_status_for_mold_code(tenant_id, mcode)
        await recompute_mold_processing_time_minutes(tenant_id, mcode)
    return await _serialize_one(row, tenant_id)


@router.get("/{row_id}", response_model=MoldBorrowSheetOut, summary="领用单详情")
async def get_borrow_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return await _serialize_one(row, tenant_id)


@router.patch("/{row_id}", response_model=MoldBorrowSheetOut, summary="更新领用单")
async def update_borrow_sheet(
    row_id: int,
    body: MoldBorrowSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    old_mold_code = row.mold_code.strip()
    data = body.model_dump(exclude_unset=True)
    if "department_name" in data and data["department_name"] is not None:
        data["department_name"] = str(data["department_name"]).strip()
    for k in ("mold_code", "mold_name"):
        if k in data and data[k] is not None:
            data[k] = str(data[k]).strip()
    for k in ("source_order_no", "department_uuid", "finished_product_code", "finished_product_name"):
        if k in data and data[k] is not None:
            v = str(data[k]).strip()
            data[k] = v or None
    new_mold_code = str(data["mold_code"]).strip() if "mold_code" in data else old_mold_code

    async with in_transaction():
        await _assert_mold_ledger_allows_borrow(tenant_id, new_mold_code, exclude_sheet_id=row.id)
        for k, v in data.items():
            setattr(row, k, v)
        await row.save()
        saved_code = row.mold_code.strip()
        if old_mold_code != saved_code:
            await _sync_mold_ledger_status_for_mold_code(tenant_id, old_mold_code)
            await recompute_mold_processing_time_minutes(tenant_id, old_mold_code)
        await _sync_mold_ledger_status_for_mold_code(tenant_id, saved_code)
        await recompute_mold_processing_time_minutes(tenant_id, saved_code)
    return await _serialize_one(row, tenant_id)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除领用单")
async def delete_borrow_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldBorrowSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_no_return_sheets_for_borrow_sheet(tenant_id, row)
    mcode = row.mold_code.strip()
    async with in_transaction():
        row.deleted_at = timezone.now()
        await row.save()
        await _sync_mold_ledger_status_for_mold_code(tenant_id, mcode)
        await recompute_mold_processing_time_minutes(tenant_id, mcode)
