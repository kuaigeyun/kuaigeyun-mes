"""好力 GO — 试模单 API。"""

from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_trial_sheet import HaoligoMoldTrialSheet
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/molds/trial-sheets", tags=["App · HaoliGO · 试模单"])

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
    purchase_order_no: str
    supplier_name: Optional[str] = None
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    trial_times: Optional[int] = None
    result_attachment_file_uuids: List[str] = Field(default_factory=list)
    inspection_attachment_file_uuids: List[str] = Field(default_factory=list)
    trial_result: str
    sheet_status: str


class MoldTrialSheetCreate(BaseModel):
    purchase_order_no: str = Field(max_length=128)
    supplier_name: Optional[str] = Field(None, max_length=200)
    mold_code: Optional[str] = Field(None, max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    trial_times: Optional[int] = Field(None, ge=0)
    result_attachment_file_uuids: Optional[List[str]] = None
    inspection_attachment_file_uuids: Optional[List[str]] = None
    trial_result: TrialResultLiteral
    sheet_status: SheetStatusLiteral = "草稿"

    @field_validator("purchase_order_no")
    @classmethod
    def strip_po(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("采购订单号不能为空")
        return s


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


async def _not_found():
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")


def _serialize(row: HaoligoMoldTrialSheet) -> MoldTrialSheetOut:
    return MoldTrialSheetOut(
        id=row.id,
        uuid=row.uuid,
        purchase_order_no=row.purchase_order_no,
        supplier_name=row.supplier_name,
        mold_code=row.mold_code,
        mold_name=row.mold_name,
        trial_times=row.trial_times,
        result_attachment_file_uuids=list(row.result_attachment_file_uuids or []),
        inspection_attachment_file_uuids=list(row.inspection_attachment_file_uuids or []),
        trial_result=row.trial_result,
        sheet_status=row.sheet_status,
    )


@router.get("", summary="试模单分页列表")
async def list_trial_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sheet_status: Optional[str] = Query(None, description="按单据状态筛选"),
    keyword: Optional[str] = Query(None, description="采购订单号/模具代号/名称关键字"),
):
    qs = tenant_alive(HaoligoMoldTrialSheet, tenant_id)
    if sheet_status:
        qs = qs.filter(sheet_status=sheet_status)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(
            Q(purchase_order_no__icontains=k)
            | Q(mold_code__icontains=k)
            | Q(mold_name__icontains=k)
            | Q(supplier_name__icontains=k)
        )
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
    row = await HaoligoMoldTrialSheet.create(
        tenant_id=tenant_id,
        purchase_order_no=body.purchase_order_no.strip(),
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
    if "purchase_order_no" in data and data["purchase_order_no"] is not None:
        s = str(data["purchase_order_no"]).strip()
        if not s:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="采购订单号不能为空")
        data["purchase_order_no"] = s
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
