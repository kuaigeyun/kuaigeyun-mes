"""好力 GO — 试模单 API。"""

from datetime import datetime
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_sheet_rule_codes import HAOLIGO_MOLD_TRIAL_SHEET_NO
from apps.haoligo.models.mold_trial_dataset_binding import HaoligoMoldTrialDatasetBinding
from apps.haoligo.models.mold_trial_sheet import HaoligoMoldTrialSheet
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/molds/trial-sheets",
    tags=["App · HaoliGO · 试模单"],
    dependencies=[Depends(require_module_access("haoligo", "molds-documents-trial"))],
)

TrialResultLiteral = Literal["合格", "不合格"]
SheetStatusLiteral = Literal["草稿", "已提交", "待审核", "已通过", "已驳回", "已作废"]


def _norm_uuid_list(v: Optional[List[str]]) -> List[str]:
    if not v:
        return []
    out: List[str] = []
    for x in v:
        s = (x or "").strip()
        if s:
            out.append(s)
    return out


class MoldTrialSheetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    sheet_no: Optional[str] = None
    purchase_order_no: Optional[str] = None
    supplier_name: Optional[str] = None
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    trial_times: Optional[int] = None
    result_attachment_file_uuids: List[str] = Field(default_factory=list)
    inspection_attachment_file_uuids: List[str] = Field(default_factory=list)
    trial_result: str
    sheet_status: str
    created_at: datetime


class MoldTrialSheetCreate(BaseModel):
    purchase_order_no: Optional[str] = Field(None, max_length=128)
    supplier_name: Optional[str] = Field(None, max_length=200)
    mold_code: Optional[str] = Field(None, max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    trial_times: Optional[int] = Field(None, ge=0)
    result_attachment_file_uuids: Optional[List[str]] = None
    inspection_attachment_file_uuids: Optional[List[str]] = None
    trial_result: TrialResultLiteral
    sheet_status: SheetStatusLiteral = "草稿"

    @field_validator("purchase_order_no", mode="before")
    @classmethod
    def normalize_po(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def require_po_or_mold(self) -> "MoldTrialSheetCreate":
        po = self.purchase_order_no
        mc = (self.mold_code or "").strip()
        if not po and not mc:
            raise ValueError("请填写采购订单号，或选择待启用模具并填写模具代号")
        return self


class MoldTrialSheetUpdate(BaseModel):
    purchase_order_no: Optional[str] = Field(None, max_length=128)
    supplier_name: Optional[str] = Field(None, max_length=200)
    mold_code: Optional[str] = Field(None, max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    trial_times: Optional[int] = Field(None, ge=0)
    result_attachment_file_uuids: Optional[List[str]] = None
    inspection_attachment_file_uuids: Optional[List[str]] = None
    trial_result: Optional[TrialResultLiteral] = None
    sheet_status: Optional[SheetStatusLiteral] = None


class MoldTrialDatasetBindingOut(BaseModel):
    """试模单关联 ERP 数据集：一个数据集 + 结果列对应关系；订单号参数选填（用于输入框失焦带出）。"""

    dataset_uuid: Optional[str] = None
    order_param_key: Optional[str] = None
    supplier_column: Optional[str] = None
    mold_code_column: Optional[str] = None
    mold_name_column: Optional[str] = None
    purchase_order_column: Optional[str] = None


class MoldTrialDatasetBindingUpsert(BaseModel):
    dataset_uuid: Optional[str] = None
    order_param_key: Optional[str] = None
    supplier_column: Optional[str] = None
    mold_code_column: Optional[str] = None
    mold_name_column: Optional[str] = None
    purchase_order_column: Optional[str] = None


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _serialize(row: HaoligoMoldTrialSheet) -> MoldTrialSheetOut:
    return MoldTrialSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        purchase_order_no=row.purchase_order_no,
        supplier_name=row.supplier_name,
        mold_code=row.mold_code,
        mold_name=row.mold_name,
        trial_times=row.trial_times,
        result_attachment_file_uuids=list(row.result_attachment_file_uuids or []),
        inspection_attachment_file_uuids=list(row.inspection_attachment_file_uuids or []),
        trial_result=row.trial_result,
        sheet_status=row.sheet_status,
        created_at=row.created_at,
    )


def _serialize_binding(row: Optional[HaoligoMoldTrialDatasetBinding]) -> MoldTrialDatasetBindingOut:
    if not row:
        return MoldTrialDatasetBindingOut()
    return MoldTrialDatasetBindingOut(
        dataset_uuid=row.dataset_uuid,
        order_param_key=row.order_param_key,
        supplier_column=row.supplier_column,
        mold_code_column=row.mold_code_column,
        mold_name_column=row.mold_name_column,
        purchase_order_column=row.purchase_order_column,
    )


@router.get("/dataset-binding", response_model=MoldTrialDatasetBindingOut, summary="试模单关联数据集配置")
async def get_trial_dataset_binding(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialDatasetBinding, tenant_id).first()
    return _serialize_binding(row)


@router.put("/dataset-binding", response_model=MoldTrialDatasetBindingOut, summary="保存试模单关联数据集配置")
async def put_trial_dataset_binding(
    body: MoldTrialDatasetBindingUpsert,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    ds = (body.dataset_uuid or "").strip()
    if not ds:
        await HaoligoMoldTrialDatasetBinding.filter(tenant_id=tenant_id).delete()
        return MoldTrialDatasetBindingOut()

    opk = (body.order_param_key or "").strip() or None
    sc = (body.supplier_column or "").strip()
    mc = (body.mold_code_column or "").strip()
    mn = (body.mold_name_column or "").strip()
    po_col = (body.purchase_order_column or "").strip()
    if not all([sc, mc, mn, po_col]):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="已选择数据集时，请填写采购订单号、供应商、模具代号、模具名称对应的结果列名（与 SQL 查询结果列别名一致）",
        )

    await HaoligoMoldTrialDatasetBinding.filter(tenant_id=tenant_id).delete()
    row = await HaoligoMoldTrialDatasetBinding.create(
        tenant_id=tenant_id,
        dataset_uuid=ds,
        order_param_key=opk,
        supplier_column=sc,
        mold_code_column=mc,
        mold_name_column=mn,
        list_dataset_uuid=None,
        purchase_order_column=po_col,
    )
    return _serialize_binding(row)


@router.get("", summary="试模单分页列表")
async def list_trial_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sheet_status: Optional[str] = Query(None, description="按单据状态筛选（兼容旧参数）"),
    trial_result: Optional[str] = Query(None, description="按试模结果筛选：合格/不合格"),
    keyword: Optional[str] = Query(None, description="采购订单号/模具代号/名称关键字"),
    created_from: Optional[datetime] = Query(None, description="创建时间起（含）"),
    created_to: Optional[datetime] = Query(None, description="创建时间止（含）"),
):
    qs = tenant_alive(HaoligoMoldTrialSheet, tenant_id)
    if sheet_status:
        qs = qs.filter(sheet_status=sheet_status)
    if trial_result and trial_result.strip():
        qs = qs.filter(trial_result=trial_result.strip())
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(purchase_order_no__icontains=k)
            | Q(sheet_no__icontains=k)
            | Q(mold_code__icontains=k)
            | Q(mold_name__icontains=k)
            | Q(supplier_name__icontains=k)
        )
    if created_from is not None:
        qs = qs.filter(created_at__gte=created_from)
    if created_to is not None:
        qs = qs.filter(created_at__lte=created_to)
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    return {
        "items": [_serialize(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=MoldTrialSheetOut, summary="创建试模单")
async def create_trial_sheet(
    body: MoldTrialSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    try:
        sheet_no = await generate_mold_sheet_no(tenant_id, HAOLIGO_MOLD_TRIAL_SHEET_NO)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    row = await HaoligoMoldTrialSheet.create(
        tenant_id=tenant_id,
        sheet_no=sheet_no,
        purchase_order_no=body.purchase_order_no,
        supplier_name=(body.supplier_name or "").strip() or None,
        mold_code=(body.mold_code or "").strip() or None,
        mold_name=(body.mold_name or "").strip() or None,
        trial_times=body.trial_times,
        result_attachment_file_uuids=_norm_uuid_list(body.result_attachment_file_uuids),
        inspection_attachment_file_uuids=_norm_uuid_list(body.inspection_attachment_file_uuids),
        trial_result=body.trial_result,
        sheet_status=body.sheet_status,
    )
    return _serialize(row)


@router.get("/{row_id}", response_model=MoldTrialSheetOut, summary="试模单详情")
async def get_trial_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return _serialize(row)


@router.patch("/{row_id}", response_model=MoldTrialSheetOut, summary="更新试模单")
async def update_trial_sheet(
    row_id: int,
    body: MoldTrialSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    data = body.model_dump(exclude_unset=True)
    if "purchase_order_no" in data:
        if data["purchase_order_no"] is None:
            pass
        else:
            s = str(data["purchase_order_no"]).strip()
            data["purchase_order_no"] = s or None
            mc = str(data.get("mold_code") or row.mold_code or "").strip()
            if not s and not mc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="采购订单号与模具代号不能同时为空",
                )
    for k in ("supplier_name", "mold_code", "mold_name"):
        if k in data and data[k] is not None:
            data[k] = str(data[k]).strip() or None
    if "result_attachment_file_uuids" in data and data["result_attachment_file_uuids"] is not None:
        data["result_attachment_file_uuids"] = _norm_uuid_list(data["result_attachment_file_uuids"])
    if "inspection_attachment_file_uuids" in data and data["inspection_attachment_file_uuids"] is not None:
        data["inspection_attachment_file_uuids"] = _norm_uuid_list(data["inspection_attachment_file_uuids"])
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    return _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除试模单")
async def delete_trial_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    row.deleted_at = timezone.now()
    await row.save()
