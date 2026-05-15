"""好力 GO — 设备点检 / 路线巡检 / 维保 / 产出单据 API 与产出数据集绑定。"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._equipment_sheet_code import generate_equipment_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.equipment_sheet_rule_codes import (
    HAOLIGO_EQUIPMENT_OUTPUT_RECORD_NO,
    HAOLIGO_EQUIPMENT_ROUTE_PATROL_NO,
    HAOLIGO_EQUIPMENT_SPOT_CHECK_NO,
)
from apps.haoligo.models.equipment import (
    HaoligoEquipment,
    HaoligoInspectionParamSet,
    HaoligoInspectionParamSetItem,
    HaoligoPatrolRoute,
    HaoligoPatrolRouteStep,
)
from apps.haoligo.models.equipment_operations import (
    HaoligoEquipmentOutputDatasetBinding,
    HaoligoEquipmentOutputRecord,
    HaoligoEquipmentRoutePatrol,
    HaoligoEquipmentRoutePatrolLine,
    HaoligoEquipmentSpotCheck,
    HaoligoEquipmentSpotCheckLine,
)
from core.api.deps.deps import get_current_tenant, get_current_user
from core.schemas.dataset import ExecuteQueryRequest
from core.services.data.dataset_service import DatasetService
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(prefix="/equipment", tags=["App · HaoliGO · 设备单据"])


# --- shared ---


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _parse_dt(v: Optional[str]) -> Optional[datetime]:
    if not v or not str(v).strip():
        return None
    s = str(v).strip()
    try:
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            return datetime.fromisoformat(s + "T00:00:00")
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"无效的日期时间格式: {v}",
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


# --- output dataset binding ---


class EquipmentOutputDatasetBindingOut(BaseModel):
    dataset_uuid: Optional[str] = None
    work_order_param_key: Optional[str] = None
    customer_column: Optional[str] = None
    product_name_column: Optional[str] = None
    planned_qty_column: Optional[str] = None


class EquipmentOutputDatasetBindingUpsert(BaseModel):
    dataset_uuid: Optional[str] = None
    work_order_param_key: Optional[str] = None
    customer_column: Optional[str] = None
    product_name_column: Optional[str] = None
    planned_qty_column: Optional[str] = None


def _serialize_output_binding(row: Optional[HaoligoEquipmentOutputDatasetBinding]) -> EquipmentOutputDatasetBindingOut:
    if not row:
        return EquipmentOutputDatasetBindingOut()
    return EquipmentOutputDatasetBindingOut(
        dataset_uuid=row.dataset_uuid,
        work_order_param_key=row.work_order_param_key,
        customer_column=row.customer_column,
        product_name_column=row.product_name_column,
        planned_qty_column=row.planned_qty_column,
    )


@router.get("/output-dataset-binding", response_model=EquipmentOutputDatasetBindingOut, summary="设备产出关联数据集配置")
async def get_equipment_output_dataset_binding(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentOutputDatasetBinding, tenant_id).first()
    return _serialize_output_binding(row)


@router.put("/output-dataset-binding", response_model=EquipmentOutputDatasetBindingOut, summary="保存设备产出关联数据集配置")
async def put_equipment_output_dataset_binding(
    body: EquipmentOutputDatasetBindingUpsert,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    ds = (body.dataset_uuid or "").strip()
    if not ds:
        await HaoligoEquipmentOutputDatasetBinding.filter(tenant_id=tenant_id).delete()
        return EquipmentOutputDatasetBindingOut()

    pk = (body.work_order_param_key or "").strip()
    if not pk:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="已选择数据集时，请填写制令单号对应的查询参数名（与 SQL 占位符一致）",
        )
    cc = (body.customer_column or "").strip()
    pc = (body.product_name_column or "").strip()
    pq = (body.planned_qty_column or "").strip()
    if not cc or not pc or not pq:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="已选择数据集时，请填写客户、品名/品号、计划数量对应的结果列名",
        )

    await HaoligoEquipmentOutputDatasetBinding.filter(tenant_id=tenant_id).delete()
    row = await HaoligoEquipmentOutputDatasetBinding.create(
        tenant_id=tenant_id,
        dataset_uuid=ds,
        work_order_param_key=pk,
        customer_column=cc,
        product_name_column=pc,
        planned_qty_column=pq,
    )
    return _serialize_output_binding(row)


class EquipmentOutputPrefillFromDatasetBody(BaseModel):
    work_order_no: str = Field(..., max_length=128, description="制令单号，作为数据集查询参数值")

    @field_validator("work_order_no")
    @classmethod
    def strip_wo(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("制令单号不能为空")
        return s


class EquipmentOutputPrefillFromDatasetOut(BaseModel):
    work_order_no: str
    customer_name: Optional[str] = None
    product_name: Optional[str] = None
    planned_qty: Optional[Decimal] = None
    dataset_row: Optional[dict] = None


@router.post(
    "/output-records/preview-by-work-order",
    response_model=EquipmentOutputPrefillFromDatasetOut,
    summary="按制令单号查询数据集并映射产出单字段",
)
async def preview_equipment_output_by_work_order(
    body: EquipmentOutputPrefillFromDatasetBody,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    binding = await tenant_alive(HaoligoEquipmentOutputDatasetBinding, tenant_id).first()
    if not binding or not (binding.dataset_uuid or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先在「设备产出数据集配置」中选择数据集并保存列映射",
        )
    ds_uuid = binding.dataset_uuid.strip()
    param_key = (binding.work_order_param_key or "").strip()
    if not param_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="数据集绑定缺少制令单号查询参数名")

    cust_c = (binding.customer_column or "").strip()
    prod_c = (binding.product_name_column or "").strip()
    pq_c = (binding.planned_qty_column or "").strip()
    if not cust_c or not prod_c or not pq_c:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="数据集列映射不完整：请配置客户、品名、计划数量列并保存",
        )

    svc = DatasetService()
    params: Dict[str, Any] = {param_key: body.work_order_no}
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
    cust = _cell_str(raw, cust_c)
    prod = _cell_str(raw, prod_c)
    pq = _cell_decimal(raw, pq_c)

    return EquipmentOutputPrefillFromDatasetOut(
        work_order_no=body.work_order_no,
        customer_name=cust[:200] if cust else None,
        product_name=prod[:200] if prod else None,
        planned_qty=pq,
        dataset_row=raw,
    )


# --- spot check ---


def _normalize_measured_value(value_type: str, raw: Optional[str]) -> Optional[str]:
    """校验并规范化实测值；空字符串视为未填。"""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    vt = (value_type or "numeric").strip().lower()
    if vt == "numeric":
        try:
            Decimal(s.replace(",", "").strip())
        except (InvalidOperation, ValueError, TypeError) as e:
            raise ValueError("数值型实测值格式无效") from e
        return s.replace(",", "").strip()[:128]
    if vt == "boolean":
        sl = s.lower()
        if sl in ("true", "1", "yes", "y", "是", "on"):
            return "true"
        if sl in ("false", "0", "no", "n", "否", "off"):
            return "false"
        raise ValueError("布尔型实测值须为 true/false 或 是/否 等")
    if len(s) > 2000:
        raise ValueError("文本型实测值过长（最多 2000 字符）")
    return s


async def _resolve_equipment_inspection_set_id(tenant_id: int, eq: HaoligoEquipment) -> int:
    if eq.inspection_param_set_id:
        return int(eq.inspection_param_set_id)
    await eq.fetch_related("category")
    cat = eq.category
    if cat and cat.default_inspection_param_set_id:
        return int(cat.default_inspection_param_set_id)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="设备未配置点检参数集，且所属类别未设置默认点检参数集，无法创建点检单",
    )


async def _resolve_spot_check_set_id(
    tenant_id: int,
    eq: HaoligoEquipment,
    override_set_id: Optional[int],
) -> int:
    if override_set_id is not None:
        ps = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id=override_set_id).first()
        if not ps:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="点检方案不存在")
        n = await tenant_alive(HaoligoInspectionParamSetItem, tenant_id).filter(set_id=override_set_id).count()
        if n == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="所选点检方案下没有点检项，无法生成点检行")
        return int(override_set_id)
    return await _resolve_equipment_inspection_set_id(tenant_id, eq)


async def _load_inspection_set_items(tenant_id: int, set_id: int):
    return (
        await tenant_alive(HaoligoInspectionParamSetItem, tenant_id)
        .filter(set_id=set_id)
        .prefetch_related("param")
        .order_by("sort_order", "id")
        .all()
    )


class SpotCheckPreviewLineOut(BaseModel):
    inspection_param_id: Optional[int] = None
    param_code: str
    param_name: str
    sort_order: int
    value_type: str
    unit: Optional[str] = None
    is_required: bool = True


class SpotCheckPreviewOut(BaseModel):
    equipment_id: int
    inspection_param_set_id: int
    inspection_param_set_code: str
    inspection_param_set_name: str
    lines: List[SpotCheckPreviewLineOut] = Field(default_factory=list)


class SpotCheckLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    inspection_param_id: Optional[int] = None
    param_code: str
    param_name: str
    sort_order: int = 0
    value_type: str = "numeric"
    unit: Optional[str] = None
    is_required: bool = True
    measured_value: Optional[str] = None
    result: str
    remark: Optional[str] = None
    attachment_file_ids: Optional[list] = None


class SpotCheckLinePatchItem(BaseModel):
    id: int
    result: str
    remark: Optional[str] = None
    measured_value: Optional[str] = None
    attachment_file_ids: Optional[list] = None

    @field_validator("result")
    @classmethod
    def v_result(cls, v: str) -> str:
        s = (v or "").strip().lower()
        if s not in ("normal", "abnormal"):
            raise ValueError("结果须为 normal 或 abnormal")
        return s


class SpotCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    recorded_at: datetime
    equipment_id: int
    equipment_asset_code: str = ""
    equipment_name: str = ""
    inspection_param_set_id: Optional[int] = None
    inspection_param_set_code: Optional[str] = None
    inspection_param_set_name: Optional[str] = None
    reporter_user_id: int
    abnormal_description: Optional[str] = None
    handling_shutdown: bool = False
    handling_report: bool = False
    handling_supervised: bool = False
    created_at: datetime
    lines: List[SpotCheckLineOut] = Field(default_factory=list)


class SpotCheckCreate(BaseModel):
    equipment_id: int = Field(..., ge=1)
    inspection_param_set_id: Optional[int] = Field(None, description="指定点检方案；不传则按设备/类别默认解析")
    recorded_at: Optional[datetime] = None
    abnormal_description: Optional[str] = None
    handling_shutdown: bool = False
    handling_report: bool = False
    handling_supervised: bool = False


class SpotCheckUpdate(BaseModel):
    recorded_at: Optional[datetime] = None
    abnormal_description: Optional[str] = None
    handling_shutdown: Optional[bool] = None
    handling_report: Optional[bool] = None
    handling_supervised: Optional[bool] = None
    lines: Optional[List[SpotCheckLinePatchItem]] = None


async def _serialize_spot_check(row: HaoligoEquipmentSpotCheck, *, with_lines: bool) -> SpotCheckOut:
    await row.fetch_related("equipment")
    eq = row.equipment
    lines_out: List[SpotCheckLineOut] = []
    if with_lines:
        lns = (
            await tenant_alive(HaoligoEquipmentSpotCheckLine, row.tenant_id)
            .filter(header_id=row.id)
            .order_by("sort_order", "id")
            .all()
        )
        lines_out = [
            SpotCheckLineOut(
                id=ln.id,
                inspection_param_id=ln.inspection_param_id,
                param_code=ln.param_code,
                param_name=ln.param_name,
                sort_order=ln.sort_order,
                value_type=ln.value_type,
                unit=ln.unit,
                is_required=ln.is_required,
                measured_value=ln.measured_value,
                result=ln.result,
                remark=ln.remark,
                attachment_file_ids=ln.attachment_file_ids,
            )
            for ln in lns
        ]
    return SpotCheckOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        recorded_at=row.recorded_at,
        equipment_id=row.equipment_id,
        equipment_asset_code=eq.asset_code if eq else "",
        equipment_name=eq.name if eq else "",
        inspection_param_set_id=row.inspection_param_set_id,
        inspection_param_set_code=row.inspection_param_set_code,
        inspection_param_set_name=row.inspection_param_set_name,
        reporter_user_id=row.reporter_user_id,
        abnormal_description=row.abnormal_description,
        handling_shutdown=row.handling_shutdown,
        handling_report=row.handling_report,
        handling_supervised=row.handling_supervised,
        created_at=row.created_at,
        lines=lines_out,
    )


@router.get("/spot-checks/preview-lines", response_model=SpotCheckPreviewOut, summary="预览点检方案展开行（不落库）")
async def preview_spot_check_lines(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    equipment_id: int = Query(..., ge=1, description="设备 id"),
    inspection_param_set_id: Optional[int] = Query(None, ge=1, description="点检方案 id；不传则按设备/类别默认"),
):
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=equipment_id).first()
    if not eq:
        await _not_found()
    set_id = await _resolve_spot_check_set_id(tenant_id, eq, inspection_param_set_id)
    ps = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id=set_id).first()
    if not ps:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="点检方案不存在")
    items = await _load_inspection_set_items(tenant_id, set_id)
    lines: List[SpotCheckPreviewLineOut] = []
    for it in items:
        p = it.param
        lines.append(
            SpotCheckPreviewLineOut(
                inspection_param_id=p.id if p else None,
                param_code=p.code if p else "",
                param_name=p.name if p else "",
                sort_order=it.sort_order,
                value_type=(p.value_type if p else "numeric") or "numeric",
                unit=p.unit if p else None,
                is_required=it.is_required,
            )
        )
    return SpotCheckPreviewOut(
        equipment_id=equipment_id,
        inspection_param_set_id=set_id,
        inspection_param_set_code=ps.code,
        inspection_param_set_name=ps.name,
        lines=lines,
    )


@router.get("/spot-checks", summary="设备点检单分页列表")
async def list_spot_checks(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    equipment_id: Optional[int] = Query(None, ge=1),
    inspection_param_set_id: Optional[int] = Query(None, ge=1),
    sheet_no: Optional[str] = None,
    recorded_from: Optional[str] = None,
    recorded_to: Optional[str] = None,
    keyword: Optional[str] = None,
):
    qs = tenant_alive(HaoligoEquipmentSpotCheck, tenant_id).prefetch_related("equipment")
    if equipment_id is not None:
        qs = qs.filter(equipment_id=equipment_id)
    if inspection_param_set_id is not None:
        qs = qs.filter(inspection_param_set_id=inspection_param_set_id)
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
            | Q(abnormal_description__icontains=k)
            | Q(equipment__asset_code__icontains=k)
            | Q(equipment__name__icontains=k)
            | Q(inspection_param_set_code__icontains=k)
            | Q(inspection_param_set_name__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items = [await _serialize_spot_check(r, with_lines=False) for r in rows]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("/spot-checks", response_model=SpotCheckOut, summary="创建设备点检单（按点检方案生成行）")
async def create_spot_check(
    body: SpotCheckCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=body.equipment_id).first()
    if not eq:
        await _not_found()
    set_id = await _resolve_spot_check_set_id(tenant_id, eq, body.inspection_param_set_id)
    ps = await tenant_alive(HaoligoInspectionParamSet, tenant_id).filter(id=set_id).first()
    if not ps:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="点检方案不存在")
    items = await _load_inspection_set_items(tenant_id, set_id)
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="所选点检方案下没有点检项，无法生成点检行",
        )

    rec_at = body.recorded_at or timezone.now()
    async with in_transaction():
        try:
            sheet_no = await generate_equipment_sheet_no(tenant_id, HAOLIGO_EQUIPMENT_SPOT_CHECK_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        header = await HaoligoEquipmentSpotCheck.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            recorded_at=rec_at,
            equipment=eq,
            inspection_param_set=ps,
            inspection_param_set_code=ps.code,
            inspection_param_set_name=ps.name,
            reporter_user_id=user.id,
            abnormal_description=(body.abnormal_description or "").strip() or None,
            handling_shutdown=body.handling_shutdown,
            handling_report=body.handling_report,
            handling_supervised=body.handling_supervised,
        )
        for it in items:
            p = it.param
            code = p.code if p else ""
            name = p.name if p else ""
            pid = p.id if p else None
            vtype = (p.value_type if p else None) or "numeric"
            await HaoligoEquipmentSpotCheckLine.create(
                tenant_id=tenant_id,
                header=header,
                inspection_param_id=pid,
                param_code=code,
                param_name=name,
                sort_order=it.sort_order,
                value_type=vtype,
                unit=(p.unit if p else None) or None,
                is_required=it.is_required,
                measured_value=None,
                result="normal",
                remark=None,
                attachment_file_ids=None,
            )
    await header.fetch_related("equipment")
    return await _serialize_spot_check(header, with_lines=True)


@router.get("/spot-checks/{row_id}", response_model=SpotCheckOut, summary="设备点检单详情")
async def get_spot_check(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentSpotCheck, tenant_id).filter(id=row_id).prefetch_related("equipment").first()
    if not row:
        await _not_found()
    return await _serialize_spot_check(row, with_lines=True)


@router.patch("/spot-checks/{row_id}", response_model=SpotCheckOut, summary="更新设备点检单")
async def update_spot_check(
    row_id: int,
    body: SpotCheckUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentSpotCheck, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    line_updates = data.pop("lines", None)

    async with in_transaction():
        for k, v in data.items():
            setattr(row, k, v)
        await row.save()

        if line_updates is not None:
            line_ids = {x["id"] for x in line_updates}
            existing = await tenant_alive(HaoligoEquipmentSpotCheckLine, tenant_id).filter(header_id=row.id).all()
            existing_ids = {ln.id for ln in existing}
            if line_ids != existing_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="点检行必须全部提交且仅允许修改本单已有行",
                )
            for lu in line_updates:
                ln = next((x for x in existing if x.id == lu["id"]), None)
                if not ln:
                    continue
                patch = SpotCheckLinePatchItem.model_validate(lu)
                pd = patch.model_dump(exclude_unset=True)
                ln.result = patch.result
                if "remark" in pd:
                    rmk = patch.remark
                    ln.remark = (str(rmk).strip() if rmk is not None else None) or None
                if "measured_value" in pd:
                    raw_mv = patch.measured_value
                    try:
                        ln.measured_value = _normalize_measured_value(
                            ln.value_type,
                            raw_mv if raw_mv is None else str(raw_mv),
                        )
                    except ValueError as e:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"第 {ln.sort_order} 行 {ln.param_name}: {e}",
                        ) from e
                if "attachment_file_ids" in pd:
                    ln.attachment_file_ids = patch.attachment_file_ids
                await ln.save()

    await row.fetch_related("equipment")
    return await _serialize_spot_check(row, with_lines=True)


@router.delete("/spot-checks/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备点检单")
async def delete_spot_check(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentSpotCheck, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    now = timezone.now()
    async with in_transaction():
        row.deleted_at = now
        await row.save()
        await (
            tenant_alive(HaoligoEquipmentSpotCheckLine, tenant_id)
            .filter(header_id=row.id)
            .update(deleted_at=now)
        )


# --- route patrol ---


class RoutePatrolLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    equipment_id: int
    asset_code: str
    equipment_name: str
    sequence: int
    is_normal: bool
    abnormal_description: Optional[str] = None


class RoutePatrolLinePatchItem(BaseModel):
    id: int
    is_normal: bool
    abnormal_description: Optional[str] = None


class RoutePatrolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    recorded_at: datetime
    patrol_route_id: int
    patrol_route_code: str = ""
    patrol_route_name: str = ""
    reporter_user_id: int
    report_required: bool = False
    report_to_user_id: Optional[int] = None
    created_at: datetime
    lines: List[RoutePatrolLineOut] = Field(default_factory=list)


class RoutePatrolCreate(BaseModel):
    patrol_route_id: int = Field(..., ge=1)
    recorded_at: Optional[datetime] = None
    report_required: bool = False
    report_to_user_id: Optional[int] = None


class RoutePatrolUpdate(BaseModel):
    recorded_at: Optional[datetime] = None
    report_required: Optional[bool] = None
    report_to_user_id: Optional[int] = None
    lines: Optional[List[RoutePatrolLinePatchItem]] = None


async def _serialize_route_patrol(row: HaoligoEquipmentRoutePatrol, *, with_lines: bool) -> RoutePatrolOut:
    await row.fetch_related("patrol_route")
    pr = row.patrol_route
    lines_out: List[RoutePatrolLineOut] = []
    if with_lines:
        lns = (
            await tenant_alive(HaoligoEquipmentRoutePatrolLine, row.tenant_id)
            .filter(header_id=row.id)
            .order_by("sequence", "id")
            .all()
        )
        lines_out = [
            RoutePatrolLineOut(
                id=ln.id,
                equipment_id=ln.equipment_id,
                asset_code=ln.asset_code,
                equipment_name=ln.equipment_name,
                sequence=ln.sequence,
                is_normal=ln.is_normal,
                abnormal_description=ln.abnormal_description,
            )
            for ln in lns
        ]
    return RoutePatrolOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        recorded_at=row.recorded_at,
        patrol_route_id=row.patrol_route_id,
        patrol_route_code=pr.code if pr else "",
        patrol_route_name=pr.name if pr else "",
        reporter_user_id=row.reporter_user_id,
        report_required=row.report_required,
        report_to_user_id=row.report_to_user_id,
        created_at=row.created_at,
        lines=lines_out,
    )


@router.get("/route-patrols", summary="设备路线巡检单分页列表")
async def list_route_patrols(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    patrol_route_id: Optional[int] = Query(None, ge=1),
    sheet_no: Optional[str] = None,
    recorded_from: Optional[str] = None,
    recorded_to: Optional[str] = None,
    keyword: Optional[str] = None,
):
    qs = tenant_alive(HaoligoEquipmentRoutePatrol, tenant_id).prefetch_related("patrol_route")
    if patrol_route_id is not None:
        qs = qs.filter(patrol_route_id=patrol_route_id)
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
        qs = qs.filter(Q(sheet_no__icontains=k) | Q(patrol_route__code__icontains=k) | Q(patrol_route__name__icontains=k))
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items = [await _serialize_route_patrol(r, with_lines=False) for r in rows]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("/route-patrols", response_model=RoutePatrolOut, summary="创建设备路线巡检单（按路线步骤生成行）")
async def create_route_patrol(
    body: RoutePatrolCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    route = await tenant_alive(HaoligoPatrolRoute, tenant_id).filter(id=body.patrol_route_id).first()
    if not route:
        await _not_found()
    steps = (
        await tenant_alive(HaoligoPatrolRouteStep, tenant_id)
        .filter(route_id=route.id)
        .prefetch_related("equipment")
        .order_by("sequence", "id")
        .all()
    )
    if not steps:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该巡检路线下没有设备步骤，无法生成巡检行")

    rec_at = body.recorded_at or timezone.now()
    async with in_transaction():
        try:
            sheet_no = await generate_equipment_sheet_no(tenant_id, HAOLIGO_EQUIPMENT_ROUTE_PATROL_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        header = await HaoligoEquipmentRoutePatrol.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            recorded_at=rec_at,
            patrol_route=route,
            reporter_user_id=user.id,
            report_required=body.report_required,
            report_to_user_id=body.report_to_user_id,
        )
        for st in steps:
            eq = st.equipment
            await HaoligoEquipmentRoutePatrolLine.create(
                tenant_id=tenant_id,
                header=header,
                equipment=eq,
                asset_code=eq.asset_code if eq else "",
                equipment_name=eq.name if eq else "",
                sequence=st.sequence,
                is_normal=True,
                abnormal_description=None,
            )
    await header.fetch_related("patrol_route")
    return await _serialize_route_patrol(header, with_lines=True)


@router.get("/route-patrols/{row_id}", response_model=RoutePatrolOut, summary="设备路线巡检单详情")
async def get_route_patrol(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = (
        await tenant_alive(HaoligoEquipmentRoutePatrol, tenant_id)
        .filter(id=row_id)
        .prefetch_related("patrol_route")
        .first()
    )
    if not row:
        await _not_found()
    return await _serialize_route_patrol(row, with_lines=True)


@router.patch("/route-patrols/{row_id}", response_model=RoutePatrolOut, summary="更新设备路线巡检单")
async def update_route_patrol(
    row_id: int,
    body: RoutePatrolUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentRoutePatrol, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    line_updates = data.pop("lines", None)

    async with in_transaction():
        for k, v in data.items():
            setattr(row, k, v)
        await row.save()

        if line_updates is not None:
            line_ids = {x["id"] for x in line_updates}
            existing = await tenant_alive(HaoligoEquipmentRoutePatrolLine, tenant_id).filter(header_id=row.id).all()
            existing_ids = {ln.id for ln in existing}
            if line_ids != existing_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="巡检行必须全部提交且仅允许修改本单已有行",
                )
            for lu in line_updates:
                ln = next((x for x in existing if x.id == lu["id"]), None)
                if not ln:
                    continue
                ln.is_normal = lu["is_normal"]
                ad = lu.get("abnormal_description")
                ln.abnormal_description = (str(ad).strip() if ad is not None else None) or None
                await ln.save()

    await row.fetch_related("patrol_route")
    return await _serialize_route_patrol(row, with_lines=True)


@router.delete("/route-patrols/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备路线巡检单")
async def delete_route_patrol(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentRoutePatrol, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    now = timezone.now()
    async with in_transaction():
        row.deleted_at = now
        await row.save()
        await (
            tenant_alive(HaoligoEquipmentRoutePatrolLine, tenant_id)
            .filter(header_id=row.id)
            .update(deleted_at=now)
        )


# --- output record ---


class OutputRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    recorded_at: datetime
    equipment_id: int
    equipment_asset_code: str = ""
    equipment_name: str = ""
    work_order_no: str
    customer_name: Optional[str] = None
    product_name: Optional[str] = None
    planned_qty: Optional[Decimal] = None
    completed_qty: Decimal
    startup_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    operator_name: Optional[str] = None
    team_leader_name: Optional[str] = None
    reporter_user_id: int
    dataset_snapshot: Optional[dict] = None
    created_at: datetime


class OutputRecordCreate(BaseModel):
    equipment_id: int = Field(..., ge=1)
    work_order_no: str = Field(..., max_length=128)
    recorded_at: Optional[datetime] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    product_name: Optional[str] = Field(None, max_length=200)
    planned_qty: Optional[Decimal] = None
    completed_qty: Decimal = Field(default=Decimal("0"))
    startup_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    operator_name: Optional[str] = Field(None, max_length=100)
    team_leader_name: Optional[str] = Field(None, max_length=100)
    dataset_snapshot: Optional[dict] = None

    @field_validator("work_order_no")
    @classmethod
    def strip_wo(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("制令单号不能为空")
        return s


class OutputRecordUpdate(BaseModel):
    recorded_at: Optional[datetime] = None
    work_order_no: Optional[str] = Field(None, max_length=128)
    customer_name: Optional[str] = Field(None, max_length=200)
    product_name: Optional[str] = Field(None, max_length=200)
    planned_qty: Optional[Decimal] = None
    completed_qty: Optional[Decimal] = None
    startup_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    operator_name: Optional[str] = Field(None, max_length=100)
    team_leader_name: Optional[str] = Field(None, max_length=100)
    dataset_snapshot: Optional[dict] = None


async def _serialize_output_record(row: HaoligoEquipmentOutputRecord) -> OutputRecordOut:
    await row.fetch_related("equipment")
    eq = row.equipment
    return OutputRecordOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        recorded_at=row.recorded_at,
        equipment_id=row.equipment_id,
        equipment_asset_code=eq.asset_code if eq else "",
        equipment_name=eq.name if eq else "",
        work_order_no=row.work_order_no,
        customer_name=row.customer_name,
        product_name=row.product_name,
        planned_qty=row.planned_qty,
        completed_qty=row.completed_qty,
        startup_at=row.startup_at,
        completed_at=row.completed_at,
        operator_name=row.operator_name,
        team_leader_name=row.team_leader_name,
        reporter_user_id=row.reporter_user_id,
        dataset_snapshot=row.dataset_snapshot,
        created_at=row.created_at,
    )


@router.get("/output-records", summary="设备产出单分页列表")
async def list_output_records(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    equipment_id: Optional[int] = Query(None, ge=1),
    sheet_no: Optional[str] = None,
    work_order_no: Optional[str] = None,
    recorded_from: Optional[str] = None,
    recorded_to: Optional[str] = None,
    keyword: Optional[str] = None,
):
    qs = tenant_alive(HaoligoEquipmentOutputRecord, tenant_id).prefetch_related("equipment")
    if equipment_id is not None:
        qs = qs.filter(equipment_id=equipment_id)
    if sheet_no and sheet_no.strip():
        qs = qs.filter(sheet_no__icontains=sheet_no.strip())
    if work_order_no and work_order_no.strip():
        qs = qs.filter(work_order_no__icontains=work_order_no.strip())
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
            | Q(work_order_no__icontains=k)
            | Q(customer_name__icontains=k)
            | Q(product_name__icontains=k)
            | Q(equipment__asset_code__icontains=k)
            | Q(equipment__name__icontains=k)
        )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    return {
        "items": [await _serialize_output_record(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/output-records", response_model=OutputRecordOut, summary="创建设备产出单")
async def create_output_record(
    body: OutputRecordCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    eq = await tenant_alive(HaoligoEquipment, tenant_id).filter(id=body.equipment_id).first()
    if not eq:
        await _not_found()
    rec_at = body.recorded_at or timezone.now()
    async with in_transaction():
        try:
            sheet_no = await generate_equipment_sheet_no(tenant_id, HAOLIGO_EQUIPMENT_OUTPUT_RECORD_NO)
        except ValidationError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
        row = await HaoligoEquipmentOutputRecord.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            recorded_at=rec_at,
            equipment=eq,
            work_order_no=body.work_order_no.strip(),
            customer_name=(body.customer_name or "").strip() or None,
            product_name=(body.product_name or "").strip() or None,
            planned_qty=body.planned_qty,
            completed_qty=body.completed_qty,
            startup_at=body.startup_at,
            completed_at=body.completed_at,
            operator_name=(body.operator_name or "").strip() or None,
            team_leader_name=(body.team_leader_name or "").strip() or None,
            reporter_user_id=user.id,
            dataset_snapshot=body.dataset_snapshot,
        )
    await row.fetch_related("equipment")
    return await _serialize_output_record(row)


@router.get("/output-records/{row_id}", response_model=OutputRecordOut, summary="设备产出单详情")
async def get_output_record(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentOutputRecord, tenant_id).filter(id=row_id).prefetch_related("equipment").first()
    if not row:
        await _not_found()
    return await _serialize_output_record(row)


@router.patch("/output-records/{row_id}", response_model=OutputRecordOut, summary="更新设备产出单")
async def update_output_record(
    row_id: int,
    body: OutputRecordUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentOutputRecord, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    if "work_order_no" in data and data["work_order_no"] is not None:
        s = str(data["work_order_no"]).strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="制令单号不能为空")
        data["work_order_no"] = s
    for k in ("customer_name", "product_name", "operator_name", "team_leader_name"):
        if k in data and data[k] is not None:
            v = str(data[k]).strip()
            data[k] = v or None
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    await row.fetch_related("equipment")
    return await _serialize_output_record(row)


@router.delete("/output-records/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除设备产出单")
async def delete_output_record(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoEquipmentOutputRecord, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
