"""好力 GO — 试模单 API。"""

from datetime import datetime
from typing import Annotated, Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from tortoise import timezone
from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.haoligo.api._mold_sheet_keyword import (
    apply_direct_mold_field_keyword_filter,
    trial_sheet_header_keyword_q,
)
from apps.haoligo.api._data_scope import (
    RESOURCE_TRIAL_RECORD,
    RESOURCE_TRIAL_SHEET,
    apply_trial_sheet_scope,
    assert_trial_mark_adjustment_operator,
    assert_trial_row_visible,
    assert_trial_supplier_code_writable,
    user_is_external_partner,
)
from apps.haoligo.api._creator import resolve_creator_name
from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api.routes_mold_maintenance_sheet import _resolve_applicant_only
from apps.haoligo.services.spot_check_side_effects import normalize_report_user_ids, validate_report_notify_users
from apps.haoligo.constants.mold_trial_failure_handling import (
    TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE,
    TRIAL_FAILURE_HANDLING_ALL_VALUES,
    TRIAL_FAILURE_HANDLING_DISPATCHED,
    TRIAL_FAILURE_HANDLING_IN_PROGRESS,
    TRIAL_FAILURE_HANDLING_RECALLED,
)
from apps.haoligo.constants.mold_trial_workflow_phase import (
    WORKFLOW_PHASE_ALL_VALUES,
    WORKFLOW_PHASE_CLOSED,
    WORKFLOW_PHASE_TRIAL,
    WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION,
)

WORKFLOW_PHASE_LIST_FILTER_REPAIR = "送修处理中"
PRODUCTION_TRIAL_RESULT_UNSET = "未填写"
from apps.haoligo.services.trial_sheet_side_effects import (
    apply_production_trial_failure_after_save,
    assert_mold_trial_process_can_start_new_sheet,
    dispatch_trial_pending_sheet,
    is_trial_failure_flow_in_progress,
    mark_trial_adjustment_complete,
    list_incomplete_trial_mold_blocks,
    mold_trial_create_availability,
    get_mold_trial_blocking_info,
    pending_trial_failure_exception_q,
    recall_trial_failure_sheet,
    apply_trial_failure_after_save,
    list_supplier_notify_preview,
    list_trial_repair_notify_preview,
    resolve_supplier_by_name,
    revert_trial_failure_side_effects_on_revoke,
    send_trial_approved_messages,
    set_mold_ledger_status_ready,
    validate_failure_handling_payload,
    resolve_adjustment_points_for_sheet,
    resolve_adjustment_points_for_update,
    normalize_adjustment_points,
)
from apps.haoligo.constants.mold_sheet_rule_codes import HAOLIGO_MOLD_TRIAL_SHEET_NO
from apps.haoligo.models.mold_trial_dataset_binding import HaoligoMoldTrialDatasetBinding
from apps.haoligo.api._mold_sheet_audit import (
    apply_rejected_resubmit_fields,
    assert_approved_for_revoke,
    assert_pending_for_audit,
    assert_sheet_mutation_allowed,
    load_sheet_row_for_audit,
    effective_sheet_status,
)
from apps.haoligo.constants.mold_sheet_audit import (
    SHEET_AUDIT_STATUS_SET,
    SHEET_STATUS_APPROVED,
    SHEET_STATUS_PENDING,
    SHEET_STATUS_REJECTED,
)
from apps.haoligo.models.mold_trial_sheet import HaoligoMoldTrialSheet
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from core.api.deps.access import AuthContext, ensure_permission_codes, get_auth_context
from core.api.deps.deps import get_current_tenant, get_current_user
from core.config.permission_contract import build_permission_code
from core.schemas.user_display import (
    UserDisplayListResponse,
    UserDisplayResolveRequest,
    UserDisplayResolveResponse,
)
from core.services.user.user_display_service import UserDisplayService
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/molds/trial-sheets",
    tags=["App · HaoliGO · 试模单"],
    dependencies=[Depends(require_haoligo_module_access("molds-documents-trial"))],
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
    trial_user_id: Optional[int] = None
    trial_user_name: Optional[str] = None
    failure_handling: Optional[str] = None
    pending_notify_user_ids: List[int] = Field(default_factory=list)
    pending_notify_users: List["MoldTrialSupplierNotifyUserOut"] = Field(default_factory=list)
    submitted_notify_user_ids: List[int] = Field(default_factory=list)
    submitted_notify_users: List["MoldTrialSupplierNotifyUserOut"] = Field(default_factory=list)
    repair_warehouse_id: Optional[int] = None
    dispatch_origin_warehouse_id: Optional[int] = None
    result_attachment_file_uuids: List[str] = Field(default_factory=list)
    inspection_attachment_file_uuids: List[str] = Field(default_factory=list)
    trial_result: str
    workflow_phase: str
    production_trial_result: Optional[str] = None
    production_trial_user_id: Optional[int] = None
    production_trial_user_name: Optional[str] = None
    adjustment_points: Optional[str] = None
    sheet_status: str
    audited_at: Optional[datetime] = None
    audited_by_user_id: Optional[int] = None
    created_at: datetime
    creator_name: Optional[str] = None


class MoldTrialSheetCreate(BaseModel):
    purchase_order_no: Optional[str] = Field(None, max_length=128)
    supplier_name: Optional[str] = Field(None, max_length=200)
    mold_code: Optional[str] = Field(None, max_length=64)
    mold_name: Optional[str] = Field(None, max_length=200)
    result_attachment_file_uuids: Optional[List[str]] = None
    inspection_attachment_file_uuids: Optional[List[str]] = None
    trial_result: TrialResultLiteral
    trial_user_id: Optional[int] = Field(None, ge=1)
    failure_handling: Optional[str] = None
    pending_notify_user_ids: Optional[List[int]] = None
    submitted_notify_user_ids: Optional[List[int]] = None
    repair_warehouse_id: Optional[int] = Field(None, ge=1)
    production_trial_result: Optional[TrialResultLiteral] = None
    production_trial_user_id: Optional[int] = Field(None, ge=1)
    adjustment_points: Optional[str] = Field(None, max_length=2000)

    @field_validator("purchase_order_no", mode="before")
    @classmethod
    def normalize_po(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @field_validator("adjustment_points", mode="before")
    @classmethod
    def normalize_adjustment_points_field(cls, v: object) -> Optional[str]:
        return normalize_adjustment_points(v)

    @model_validator(mode="after")
    def production_only_when_trial_passed(self) -> "MoldTrialSheetCreate":
        has_prod = (
            self.production_trial_result is not None
            or self.production_trial_user_id is not None
            or bool(self.inspection_attachment_file_uuids)
        )
        if has_prod and self.trial_result != "合格":
            raise ValueError("试产信息仅在试模结果为「合格」时可填写")
        return self

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
    result_attachment_file_uuids: Optional[List[str]] = None
    inspection_attachment_file_uuids: Optional[List[str]] = None
    trial_result: Optional[TrialResultLiteral] = None
    trial_user_id: Optional[int] = Field(None, ge=1)
    failure_handling: Optional[str] = None
    pending_notify_user_ids: Optional[List[int]] = None
    submitted_notify_user_ids: Optional[List[int]] = None
    repair_warehouse_id: Optional[int] = Field(None, ge=1)
    production_trial_result: Optional[TrialResultLiteral] = None
    production_trial_user_id: Optional[int] = Field(None, ge=1)
    adjustment_points: Optional[str] = Field(None, max_length=2000)

    @field_validator("adjustment_points", mode="before")
    @classmethod
    def normalize_adjustment_points_field(cls, v: object) -> Optional[str]:
        return normalize_adjustment_points(v)


class MoldTrialSupplierNotifyUserOut(BaseModel):
    id: int
    name: str


class MoldTrialSupplierNotifyPreviewOut(BaseModel):
    items: List[MoldTrialSupplierNotifyUserOut] = Field(default_factory=list)


class MoldTrialNextTimesOut(BaseModel):
    trial_times: int = Field(description="本单试模次数（第几次，创建时自动写入）")
    can_create: bool = Field(description="当前模具/订单是否允许再开新试模单")
    blocking_sheet_no: Optional[str] = Field(
        None,
        description="若不可新建，阻塞中的试模单单号",
    )
    blocking_sheet_id: Optional[int] = Field(
        None,
        description="若不可新建，阻塞中的试模单 ID",
    )
    blocking_trial_user_name: Optional[str] = Field(
        None,
        description="若不可新建，阻塞试模单的试模人员（开单人）",
    )
    blocking_created_at: Optional[datetime] = Field(
        None,
        description="若不可新建，阻塞试模单创建时间",
    )


class MoldTrialIncompleteMoldItem(BaseModel):
    mold_code: str
    blocking_sheet_no: Optional[str] = None
    blocking_sheet_id: int
    blocking_trial_user_name: Optional[str] = None
    blocking_created_at: Optional[datetime] = None


class MoldTrialIncompleteMoldsOut(BaseModel):
    items: List[MoldTrialIncompleteMoldItem] = Field(default_factory=list)


class MoldTrialDispatchIn(BaseModel):
    target_warehouse_id: int = Field(..., ge=1, description="接收仓库（供应商外部模具仓库）")


class MoldTrialRecallIn(BaseModel):
    target_warehouse_id: Optional[int] = Field(
        None,
        ge=1,
        description="收回目标仓库；不传则使用发出前记录的仓库",
    )


class MoldTrialViewerContextOut(BaseModel):
    is_external_partner: bool = Field(description="当前用户是否为外协厂商角色（列表 UI 与数据范围，非操作权限替代）")


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


async def _resolve_trial_supplier_fields(
    tenant_id: int,
    supplier_name: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    name = (supplier_name or "").strip() or None
    if not name:
        return None, None
    sup = await resolve_supplier_by_name(tenant_id, name)
    if sup:
        resolved_name = (sup.name or "").strip() or name
        resolved_code = (sup.code or "").strip() or None
        return resolved_name, resolved_code
    return name, None


async def _resolve_next_trial_times(
    tenant_id: int,
    *,
    mold_code: str | None,
    purchase_order_no: str | None,
) -> int:
    """按模具代号（优先）或采购订单号统计已有试模单数，本单为第 N 次（每张单计 1）。"""
    mc = (mold_code or "").strip()
    if mc:
        n = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(mold_code=mc).count()
        return n + 1
    po = (purchase_order_no or "").strip()
    if po:
        n = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(purchase_order_no=po).count()
        return n + 1
    return 1


async def _resolve_notify_users(
    tenant_id: int,
    user_ids: List[int],
) -> List[MoldTrialSupplierNotifyUserOut]:
    if not user_ids:
        return []
    rows = await User.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at=None,
        id__in=user_ids,
    ).values("id", "full_name", "username")
    name_by_id = {
        int(r["id"]): (str(r.get("full_name") or "").strip() or str(r.get("username") or "").strip())
        for r in rows
    }
    return [
        MoldTrialSupplierNotifyUserOut(id=uid, name=name_by_id[uid])
        for uid in user_ids
        if uid in name_by_id
    ]


async def _serialize(row: HaoligoMoldTrialSheet) -> MoldTrialSheetOut:
    notify_ids = normalize_report_user_ids(row.pending_notify_user_ids)
    notify_users = await _resolve_notify_users(row.tenant_id, notify_ids)
    submitted_ids = normalize_report_user_ids(getattr(row, "submitted_notify_user_ids", None))
    submitted_users = await _resolve_notify_users(row.tenant_id, submitted_ids)
    return MoldTrialSheetOut(
        id=row.id,
        uuid=row.uuid,
        sheet_no=row.sheet_no,
        purchase_order_no=row.purchase_order_no,
        supplier_name=row.supplier_name,
        mold_code=row.mold_code,
        mold_name=row.mold_name,
        trial_times=row.trial_times,
        trial_user_id=row.trial_user_id,
        trial_user_name=row.trial_user_name,
        failure_handling=row.failure_handling,
        pending_notify_user_ids=notify_ids,
        pending_notify_users=notify_users,
        submitted_notify_user_ids=submitted_ids,
        submitted_notify_users=submitted_users,
        repair_warehouse_id=row.repair_warehouse_id,
        dispatch_origin_warehouse_id=getattr(row, "dispatch_origin_warehouse_id", None),
        result_attachment_file_uuids=list(row.result_attachment_file_uuids or []),
        inspection_attachment_file_uuids=list(row.inspection_attachment_file_uuids or []),
        trial_result=(row.trial_result or "").strip() or "合格",
        workflow_phase=(getattr(row, "workflow_phase", None) or WORKFLOW_PHASE_TRIAL).strip(),
        production_trial_result=getattr(row, "production_trial_result", None),
        production_trial_user_id=getattr(row, "production_trial_user_id", None),
        production_trial_user_name=getattr(row, "production_trial_user_name", None),
        adjustment_points=getattr(row, "adjustment_points", None),
        sheet_status=effective_sheet_status(row),
        audited_at=getattr(row, "audited_at", None),
        audited_by_user_id=getattr(row, "audited_by_user_id", None),
        created_at=row.created_at,
        creator_name=resolve_creator_name(trial_user_name=row.trial_user_name),
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


def _repair_in_progress_display_q() -> Q:
    return Q(sheet_status=SHEET_STATUS_APPROVED) & Q(
        failure_handling__in=list(TRIAL_FAILURE_HANDLING_IN_PROGRESS)
    )


def _apply_trial_sheet_workflow_phase_filter(qs: Any, phase: str) -> Any:
    p = phase.strip()
    if not p:
        return qs
    if p == WORKFLOW_PHASE_LIST_FILTER_REPAIR:
        return qs.filter(_repair_in_progress_display_q())
    if p not in WORKFLOW_PHASE_ALL_VALUES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"无效的流程阶段筛选：{p}",
        )
    if p in (WORKFLOW_PHASE_TRIAL, WORKFLOW_PHASE_CLOSED):
        return qs.filter(workflow_phase=p).exclude(_repair_in_progress_display_q())
    return qs.filter(workflow_phase=p)


@router.get("", summary="试模单分页列表")
async def list_trial_sheets(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sheet_status: Optional[str] = Query(None, description="按单据状态筛选（兼容旧参数）"),
    trial_result: Optional[str] = Query(None, description="按试模结果筛选：合格/不合格"),
    failure_pending: Optional[bool] = Query(
        None,
        description="为 true 时仅返回试模/试产不合格且尚未确认收回的待处理单",
    ),
    failure_handling: Optional[str] = Query(
        None,
        description="按不合格处理方式筛选，如：调整完成、立即送修、已收回",
    ),
    workflow_phase: Optional[str] = Query(
        None,
        description="按流程阶段筛选：试模/试模合格待试产/已结案/送修处理中",
    ),
    production_trial_result: Optional[str] = Query(
        None,
        description="按试产检验结果筛选：合格/不合格/未填写",
    ),
    purchase_order_no: Optional[str] = Query(None, description="采购订单号（模糊）"),
    supplier_name: Optional[str] = Query(None, description="供应商（模糊）"),
    mold_code: Optional[str] = Query(None, description="模具代号（模糊）"),
    mold_name: Optional[str] = Query(None, description="模具名称（模糊）"),
    sheet_no: Optional[str] = Query(None, description="试模单单号（模糊）"),
    trial_times: Optional[int] = Query(None, ge=1, description="试模次数（精确）"),
    trial_user_name: Optional[str] = Query(None, description="试模人员（模糊）"),
    keyword: Optional[str] = Query(None, description="采购订单号/模具代号/名称关键字"),
    created_from: Optional[datetime] = Query(None, description="创建时间起（含）"),
    created_to: Optional[datetime] = Query(None, description="创建时间止（含）"),
    assigned_to_me: bool = Query(
        False,
        description="仅个人待办队列（与 /mobile/todo-badges 口径一致）",
    ),
):
    qs = tenant_alive(HaoligoMoldTrialSheet, tenant_id)
    st = (sheet_status or "").strip()
    if st and st in SHEET_AUDIT_STATUS_SET:
        qs = qs.filter(sheet_status=st)
    elif st:
        qs = qs.filter(sheet_status=st)
    if trial_result and trial_result.strip():
        qs = qs.filter(trial_result=trial_result.strip())
    if failure_pending:
        qs = qs.filter(pending_trial_failure_exception_q())
    fh_filter = (failure_handling or "").strip()
    if fh_filter:
        if fh_filter not in TRIAL_FAILURE_HANDLING_ALL_VALUES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"无效的处理方式筛选：{fh_filter}",
            )
        qs = qs.filter(failure_handling=fh_filter)
    wf_filter = (workflow_phase or "").strip()
    if wf_filter:
        qs = _apply_trial_sheet_workflow_phase_filter(qs, wf_filter)
    prod_filter = (production_trial_result or "").strip()
    if prod_filter:
        if prod_filter == PRODUCTION_TRIAL_RESULT_UNSET:
            qs = qs.filter(Q(production_trial_result__isnull=True) | Q(production_trial_result=""))
        elif prod_filter in ("合格", "不合格"):
            qs = qs.filter(production_trial_result=prod_filter)
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"无效的试产检验结果筛选：{prod_filter}",
            )
    po_filter = (purchase_order_no or "").strip()
    if po_filter:
        qs = qs.filter(purchase_order_no__icontains=po_filter)
    supplier_filter = (supplier_name or "").strip()
    if supplier_filter:
        qs = qs.filter(supplier_name__icontains=supplier_filter)
    mold_code_filter = (mold_code or "").strip()
    if mold_code_filter:
        qs = qs.filter(mold_code__icontains=mold_code_filter)
    mold_name_filter = (mold_name or "").strip()
    if mold_name_filter:
        qs = qs.filter(mold_name__icontains=mold_name_filter)
    sheet_no_filter = (sheet_no or "").strip()
    if sheet_no_filter:
        qs = qs.filter(sheet_no__icontains=sheet_no_filter)
    if trial_times is not None:
        qs = qs.filter(trial_times=trial_times)
    trial_user_filter = (trial_user_name or "").strip()
    if trial_user_filter:
        qs = qs.filter(trial_user_name__icontains=trial_user_filter)
    qs = await apply_direct_mold_field_keyword_filter(
        qs, tenant_id, keyword, trial_sheet_header_keyword_q
    )
    if created_from is not None:
        qs = qs.filter(created_at__gte=created_from)
    if created_to is not None:
        qs = qs.filter(created_at__lte=created_to)
    qs = await apply_trial_sheet_scope(
        qs, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET
    )
    if assigned_to_me:
        from apps.haoligo.services.mobile_assigned_to_me import (
            apply_assigned_to_me_pending_audit,
            apply_assigned_to_me_trial_failed,
        )

        if failure_pending:
            qs = await apply_assigned_to_me_trial_failed(qs, user)
        else:
            qs = await apply_assigned_to_me_pending_audit(
                qs,
                user,
                tenant_id,
                notify_field="submitted_notify_user_ids",
                approve_module="molds-documents-trial",
            )
    total = await qs.count()
    rows = await qs.order_by("-id").offset(skip).limit(limit)
    items: List[MoldTrialSheetOut] = []
    for r in rows:
        items.append(await _serialize(r))
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("", response_model=MoldTrialSheetOut, summary="创建试模单")
async def create_trial_sheet(
    body: MoldTrialSheetCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        sheet_no = await generate_mold_sheet_no(tenant_id, HAOLIGO_MOLD_TRIAL_SHEET_NO)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    mold_code = (body.mold_code or "").strip() or None
    trial_times = await _resolve_next_trial_times(
        tenant_id,
        mold_code=mold_code,
        purchase_order_no=body.purchase_order_no,
    )
    trial_uid = body.trial_user_id if body.trial_user_id is not None else user.id
    trial_uid, trial_uname = await _resolve_applicant_only(tenant_id, int(trial_uid))
    fh_mode: Optional[str] = None
    notify_ids: List[int] = []
    submitted_notify_ids: List[int] = normalize_report_user_ids(body.submitted_notify_user_ids)
    repair_wh_id: Optional[int] = None
    workflow_phase = WORKFLOW_PHASE_TRIAL
    inspection_uuids: List[str] = []
    prod_result: Optional[str] = None
    prod_uid: Optional[int] = None
    prod_uname: Optional[str] = None

    if body.trial_result == "不合格":
        fh_mode, notify_ids, repair_wh_id = validate_failure_handling_payload(
            trial_result=body.trial_result,
            failure_handling=body.failure_handling,
            pending_notify_user_ids=body.pending_notify_user_ids,
            repair_warehouse_id=body.repair_warehouse_id,
            allow_pending=False,
            unqualified_label="试模",
        )
    else:
        pr = (body.production_trial_result or "").strip()
        if pr in ("合格", "不合格"):
            workflow_phase = WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION
            inspection_uuids = _norm_uuid_list(body.inspection_attachment_file_uuids)
            prod_result = pr
            puid = body.production_trial_user_id if body.production_trial_user_id is not None else user.id
            prod_uid, prod_uname = await _resolve_applicant_only(tenant_id, int(puid))
            if pr == "不合格":
                fh_mode, notify_ids, repair_wh_id = validate_failure_handling_payload(
                    trial_result=pr,
                    failure_handling=body.failure_handling,
                    pending_notify_user_ids=body.pending_notify_user_ids,
                    repair_warehouse_id=body.repair_warehouse_id,
                    allow_pending=True,
                    unqualified_label="试产",
                )

    if notify_ids:
        await validate_report_notify_users(tenant_id, notify_ids)
    if submitted_notify_ids:
        await validate_report_notify_users(tenant_id, submitted_notify_ids)
    await assert_mold_trial_process_can_start_new_sheet(
        tenant_id,
        mold_code=mold_code,
        purchase_order_no=body.purchase_order_no,
    )
    supplier_name, supplier_code = await _resolve_trial_supplier_fields(tenant_id, body.supplier_name)
    await assert_trial_supplier_code_writable(
        tenant_id=tenant_id,
        user=user,
        resource=RESOURCE_TRIAL_SHEET,
        supplier_code=supplier_code,
    )
    adjustment_points = resolve_adjustment_points_for_sheet(
        trial_result=body.trial_result,
        production_trial_result=prod_result,
        adjustment_points=body.adjustment_points,
    )
    row = await HaoligoMoldTrialSheet.create(
        tenant_id=tenant_id,
        sheet_no=sheet_no,
        purchase_order_no=body.purchase_order_no,
        supplier_name=supplier_name,
        supplier_code=supplier_code,
        mold_code=mold_code,
        mold_name=(body.mold_name or "").strip() or None,
        trial_times=trial_times,
        trial_user_id=trial_uid,
        trial_user_name=trial_uname,
        failure_handling=fh_mode,
        pending_notify_user_ids=notify_ids,
        submitted_notify_user_ids=submitted_notify_ids,
        repair_warehouse_id=repair_wh_id,
        result_attachment_file_uuids=_norm_uuid_list(body.result_attachment_file_uuids),
        inspection_attachment_file_uuids=inspection_uuids,
        trial_result=body.trial_result,
        workflow_phase=workflow_phase,
        production_trial_result=prod_result,
        production_trial_user_id=prod_uid,
        production_trial_user_name=prod_uname,
        adjustment_points=adjustment_points,
        sheet_status=SHEET_STATUS_PENDING,
    )
    from apps.haoligo.services.trial_sheet_side_effects import send_trial_submitted_messages

    await send_trial_submitted_messages(tenant_id, row)
    return await _serialize(row)


@router.get(
    "/supplier-notify-preview",
    response_model=MoldTrialSupplierNotifyPreviewOut,
    summary="预览试模单供应商绑定用户（待处理抄送）",
)
async def preview_supplier_notify_users(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    supplier_name: Optional[str] = Query(None, description="供应商名称（与试模单一致）"),
):
    items = await list_supplier_notify_preview(tenant_id, supplier_name)
    return MoldTrialSupplierNotifyPreviewOut(
        items=[MoldTrialSupplierNotifyUserOut(id=x["id"], name=x["name"]) for x in items],
    )


async def _ensure_trial_form_operator_picker(
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
) -> None:
    """试模/试产人员：create/update 可搜索选人；read 可 display 级回显（详情只读），不依赖 system:user:read。"""
    await ensure_permission_codes(
        auth,
        tenant_id,
        request,
        [
            build_permission_code("haoligo", "molds-documents-trial", "read"),
            build_permission_code("haoligo", "molds-documents-trial", "create"),
            build_permission_code("haoligo", "molds-documents-trial", "update"),
        ],
        require_all=False,
    )


@router.get(
    "/operator-search",
    response_model=UserDisplayListResponse,
    summary="试模单表单人员搜索（试模/试产人员下拉）",
)
async def search_trial_sheet_operators(
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[None, Depends(_ensure_trial_form_operator_picker)],
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=200, description="每页数量"),
    keyword: Optional[str] = Query(None, description="姓名或账号关键词"),
    department_uuid: Optional[str] = Query(None, description="部门 UUID 筛选"),
    is_active: Optional[bool] = Query(True, description="是否仅启用用户"),
):
    result = await UserDisplayService.search(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        keyword=keyword,
        department_uuid=department_uuid,
        is_active=is_active,
    )
    return UserDisplayListResponse(**result)


@router.post(
    "/operator-resolve",
    response_model=UserDisplayResolveResponse,
    summary="试模单表单人员回显解析",
)
async def resolve_trial_sheet_operators(
    body: UserDisplayResolveRequest,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[None, Depends(_ensure_trial_form_operator_picker)],
):
    items = await UserDisplayService.resolve(
        tenant_id=tenant_id,
        user_ids=body.user_ids,
        user_uuids=body.user_uuids,
    )
    return UserDisplayResolveResponse(items=items)


@router.get(
    "/repair-notify-preview",
    response_model=MoldTrialSupplierNotifyPreviewOut,
    summary="预览试模单立即送修站内信接收人",
)
async def preview_repair_notify_users(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    supplier_name: Optional[str] = Query(None, description="供应商名称"),
    trial_user_id: Optional[int] = Query(None, ge=1, description="试模人员用户 ID"),
):
    items = await list_trial_repair_notify_preview(tenant_id, supplier_name, trial_user_id)
    return MoldTrialSupplierNotifyPreviewOut(
        items=[MoldTrialSupplierNotifyUserOut(id=x["id"], name=x["name"]) for x in items],
    )


@router.get(
    "/incomplete-molds",
    response_model=MoldTrialIncompleteMoldsOut,
    summary="未完结试模流程的模具代号列表（新建试模单前筛选用）",
)
async def list_incomplete_trial_molds(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    raw = await list_incomplete_trial_mold_blocks(tenant_id)
    return MoldTrialIncompleteMoldsOut(
        items=[MoldTrialIncompleteMoldItem(**x) for x in raw],
    )


@router.get("/next-trial-times", response_model=MoldTrialNextTimesOut, summary="预览本单为第几次试模")
async def preview_next_trial_times(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    mold_code: Optional[str] = Query(None, description="模具代号（优先）"),
    purchase_order_no: Optional[str] = Query(None, description="采购订单号（无模具代号时按订单统计）"),
):
    n = await _resolve_next_trial_times(
        tenant_id,
        mold_code=mold_code,
        purchase_order_no=purchase_order_no,
    )
    blocking_info = await get_mold_trial_blocking_info(
        tenant_id,
        mold_code=mold_code,
        purchase_order_no=purchase_order_no,
    )
    return MoldTrialNextTimesOut(
        trial_times=n,
        can_create=blocking_info is None,
        blocking_sheet_no=blocking_info.get("blocking_sheet_no") if blocking_info else None,
        blocking_sheet_id=blocking_info.get("blocking_sheet_id") if blocking_info else None,
        blocking_trial_user_name=blocking_info.get("blocking_trial_user_name") if blocking_info else None,
        blocking_created_at=blocking_info.get("blocking_created_at") if blocking_info else None,
    )


@router.get("/{row_id}", response_model=MoldTrialSheetOut, summary="试模单详情")
async def get_trial_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_trial_row_visible(row, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)
    return await _serialize(row)


@router.patch("/{row_id}", response_model=MoldTrialSheetOut, summary="更新试模单")
async def update_trial_sheet(
    row_id: int,
    body: MoldTrialSheetUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_trial_row_visible(row, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)
    assert_sheet_mutation_allowed(row)
    data = body.model_dump(exclude_unset=True)
    data.pop("sheet_status", None)
    body_set = set(data.keys())
    data.pop("trial_times", None)
    data.pop("workflow_phase", None)
    phase = (getattr(row, "workflow_phase", None) or WORKFLOW_PHASE_TRIAL).strip()
    row_fh = (row.failure_handling or "").strip()
    skip_fh_validation = (
        row_fh in TRIAL_FAILURE_HANDLING_IN_PROGRESS
        and effective_sheet_status(row) == SHEET_STATUS_APPROVED
        and "failure_handling" not in body_set
    )
    if skip_fh_validation:
        for k in ("failure_handling", "pending_notify_user_ids", "repair_warehouse_id", "dispatch_origin_warehouse_id"):
            data.pop(k, None)

    if phase == WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION:
        for k in ("trial_result", "trial_user_id", "result_attachment_file_uuids"):
            data.pop(k, None)
        effective_prod = str(
            data.get("production_trial_result", getattr(row, "production_trial_result", None)) or ""
        ).strip()
        if not skip_fh_validation and (
            effective_prod == "不合格"
            or any(
                k in body_set
                for k in (
                    "failure_handling",
                    "pending_notify_user_ids",
                    "repair_warehouse_id",
                    "production_trial_result",
                )
            )
        ):
            fh_mode, notify_ids, repair_wh_id = validate_failure_handling_payload(
                trial_result=effective_prod or "合格",
                failure_handling=data.get("failure_handling", row.failure_handling),
                pending_notify_user_ids=data.get("pending_notify_user_ids", row.pending_notify_user_ids),
                repair_warehouse_id=data.get("repair_warehouse_id", row.repair_warehouse_id),
                allow_pending=True,
                unqualified_label="试产",
            )
            if notify_ids:
                await validate_report_notify_users(tenant_id, notify_ids)
            data["failure_handling"] = fh_mode
            data["pending_notify_user_ids"] = notify_ids
            data["repair_warehouse_id"] = repair_wh_id
        elif effective_prod == "合格":
            data["failure_handling"] = None
            data["pending_notify_user_ids"] = []
            data["repair_warehouse_id"] = None
            data["dispatch_origin_warehouse_id"] = None
    else:
        effective_result = str(data.get("trial_result", row.trial_result) or "").strip()
        if not skip_fh_validation and (
            effective_result == "不合格"
            or any(
                k in body_set
                for k in ("failure_handling", "pending_notify_user_ids", "repair_warehouse_id", "trial_result")
            )
        ):
            fh_mode, notify_ids, repair_wh_id = validate_failure_handling_payload(
                trial_result=effective_result,
                failure_handling=data.get("failure_handling", row.failure_handling),
                pending_notify_user_ids=data.get("pending_notify_user_ids", row.pending_notify_user_ids),
                repair_warehouse_id=data.get("repair_warehouse_id", row.repair_warehouse_id),
                allow_pending=False,
                unqualified_label="试模",
            )
            if notify_ids:
                await validate_report_notify_users(tenant_id, notify_ids)
            data["failure_handling"] = fh_mode
            data["pending_notify_user_ids"] = notify_ids
            data["repair_warehouse_id"] = repair_wh_id
        elif effective_result == "合格":
            data["failure_handling"] = None
            data["pending_notify_user_ids"] = []
            data["repair_warehouse_id"] = None
            data["dispatch_origin_warehouse_id"] = None
        data.pop("production_trial_result", None)
        data.pop("production_trial_user_id", None)
        if phase == WORKFLOW_PHASE_TRIAL:
            data.pop("inspection_attachment_file_uuids", None)
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
    if "supplier_name" in data:
        sname, scode = await _resolve_trial_supplier_fields(
            tenant_id,
            data.get("supplier_name", row.supplier_name),
        )
        data["supplier_name"] = sname
        data["supplier_code"] = scode
        await assert_trial_supplier_code_writable(
            tenant_id=tenant_id,
            user=user,
            resource=RESOURCE_TRIAL_SHEET,
            supplier_code=scode,
        )
    for k in ("mold_code", "mold_name"):
        if k in data and data[k] is not None:
            data[k] = str(data[k]).strip() or None
    if "result_attachment_file_uuids" in data and data["result_attachment_file_uuids"] is not None:
        data["result_attachment_file_uuids"] = _norm_uuid_list(data["result_attachment_file_uuids"])
    if "inspection_attachment_file_uuids" in data and data["inspection_attachment_file_uuids"] is not None:
        data["inspection_attachment_file_uuids"] = _norm_uuid_list(data["inspection_attachment_file_uuids"])
    if "pending_notify_user_ids" in data and data["pending_notify_user_ids"] is not None:
        data["pending_notify_user_ids"] = normalize_report_user_ids(data["pending_notify_user_ids"])
    if "submitted_notify_user_ids" in data and data["submitted_notify_user_ids"] is not None:
        submitted_notify_ids = normalize_report_user_ids(data["submitted_notify_user_ids"])
        if submitted_notify_ids:
            await validate_report_notify_users(tenant_id, submitted_notify_ids)
        data["submitted_notify_user_ids"] = submitted_notify_ids
    if "trial_user_id" in data and data["trial_user_id"] is not None:
        trial_uid, trial_uname = await _resolve_applicant_only(tenant_id, int(data["trial_user_id"]))
        data["trial_user_id"] = trial_uid
        data["trial_user_name"] = trial_uname
    if "production_trial_user_id" in data and data["production_trial_user_id"] is not None:
        prod_uid, prod_uname = await _resolve_applicant_only(tenant_id, int(data["production_trial_user_id"]))
        data["production_trial_user_id"] = prod_uid
        data["production_trial_user_name"] = prod_uname
    eff_trial = str(data.get("trial_result", row.trial_result) or "").strip()
    if phase == WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION:
        eff_trial = str(row.trial_result or "").strip()
    eff_prod_raw = data.get("production_trial_result", getattr(row, "production_trial_result", None))
    eff_prod = str(eff_prod_raw or "").strip() or None
    if phase == WORKFLOW_PHASE_TRIAL:
        eff_prod = None
    data["adjustment_points"] = resolve_adjustment_points_for_update(
        trial_result=eff_trial,
        production_trial_result=eff_prod,
        body_adjustment_points=data.get("adjustment_points", getattr(row, "adjustment_points", None)),
        adjustment_points_in_body="adjustment_points" in body_set,
        existing_adjustment_points=getattr(row, "adjustment_points", None),
    )
    was_rejected = effective_sheet_status(row) == SHEET_STATUS_REJECTED
    apply_rejected_resubmit_fields(data, row)
    for k, v in data.items():
        setattr(row, k, v)
    await row.save()
    if was_rejected and effective_sheet_status(row) == SHEET_STATUS_PENDING:
        from apps.haoligo.services.trial_sheet_side_effects import send_trial_submitted_messages

        await send_trial_submitted_messages(tenant_id, row)
    return await _serialize(row)


@router.post("/{row_id}/approve", response_model=MoldTrialSheetOut, summary="审核通过试模单")
async def approve_trial_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    preview = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not preview:
        await _not_found()
    await assert_trial_row_visible(preview, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)

    notify_after = False

    async with in_transaction():
        row = await load_sheet_row_for_audit(HaoligoMoldTrialSheet, tenant_id, row_id)
        assert_pending_for_audit(row)
        phase = (getattr(row, "workflow_phase", None) or WORKFLOW_PHASE_TRIAL).strip()
        now = timezone.now()

        if phase == WORKFLOW_PHASE_TRIAL:
            tr = (row.trial_result or "").strip()
            if tr not in ("合格", "不合格"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先填写试模结果")
            if tr == "不合格":
                mode = (row.failure_handling or "").strip()
                if mode != "立即送修":
                    fh_mode, notify_ids, repair_wh_id = validate_failure_handling_payload(
                        trial_result=tr,
                        failure_handling=row.failure_handling or "立即送修",
                        pending_notify_user_ids=row.pending_notify_user_ids,
                        repair_warehouse_id=row.repair_warehouse_id,
                        allow_pending=False,
                        unqualified_label="试模",
                    )
                    row.failure_handling = fh_mode
                    row.pending_notify_user_ids = notify_ids
                    row.repair_warehouse_id = repair_wh_id
                row.sheet_status = SHEET_STATUS_APPROVED
                row.audited_at = now
                row.audited_by_user_id = user.id
                if not is_trial_failure_flow_in_progress(row.failure_handling):
                    row.workflow_phase = WORKFLOW_PHASE_CLOSED
                await row.save()
                await apply_trial_failure_after_save(tenant_id, row, send_notify=False)
                notify_after = True
            else:
                row.workflow_phase = WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION
                row.sheet_status = SHEET_STATUS_PENDING
                row.audited_at = None
                row.audited_by_user_id = None
                await row.save()
                from apps.haoligo.services.trial_sheet_side_effects import (
                    send_trial_production_pending_messages,
                )

                await send_trial_production_pending_messages(tenant_id, row)

        elif phase == WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION:
            pr = (getattr(row, "production_trial_result", None) or "").strip()
            if pr not in ("合格", "不合格"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先填写试产结果")
            if pr == "不合格":
                fh_mode, notify_ids, repair_wh_id = validate_failure_handling_payload(
                    trial_result=pr,
                    failure_handling=row.failure_handling,
                    pending_notify_user_ids=row.pending_notify_user_ids,
                    repair_warehouse_id=row.repair_warehouse_id,
                    allow_pending=True,
                    unqualified_label="试产",
                )
                row.failure_handling = fh_mode
                row.pending_notify_user_ids = notify_ids
                row.repair_warehouse_id = repair_wh_id
            row.sheet_status = SHEET_STATUS_APPROVED
            row.audited_at = now
            row.audited_by_user_id = user.id
            if pr == "不合格":
                if not is_trial_failure_flow_in_progress(row.failure_handling):
                    row.workflow_phase = WORKFLOW_PHASE_CLOSED
            else:
                row.workflow_phase = WORKFLOW_PHASE_CLOSED
            await row.save()
            if pr == "不合格":
                await apply_production_trial_failure_after_save(tenant_id, row, send_notify=False)
                notify_after = True
            else:
                await set_mold_ledger_status_ready(tenant_id, row.mold_code)

        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前流程阶段不可审核")

    if notify_after:
        row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
        if row:
            pr = (getattr(row, "production_trial_result", None) or "").strip()
            if pr == "不合格":
                await apply_production_trial_failure_after_save(tenant_id, row, send_notify=True)
            else:
                await apply_trial_failure_after_save(tenant_id, row, send_notify=True)
    else:
        row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
        if row:
            if (
                (row.sheet_status or "").strip() == SHEET_STATUS_APPROVED
                and (getattr(row, "workflow_phase", None) or "").strip() == WORKFLOW_PHASE_CLOSED
            ):
                await send_trial_approved_messages(tenant_id, row)

    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    return await _serialize(row)


@router.post("/{row_id}/reject", response_model=MoldTrialSheetOut, summary="审核驳回试模单")
async def reject_trial_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_trial_row_visible(row, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)
    assert_pending_for_audit(row)
    row.sheet_status = SHEET_STATUS_REJECTED
    row.audited_at = timezone.now()
    row.audited_by_user_id = user.id
    await row.save()
    from apps.haoligo.services.trial_sheet_side_effects import send_trial_rejected_messages

    await send_trial_rejected_messages(tenant_id, row)
    return await _serialize(row)


@router.get("/viewer-context", response_model=MoldTrialViewerContextOut, summary="试模单页面操作者上下文")
async def get_trial_viewer_context(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
) -> MoldTrialViewerContextOut:
    return MoldTrialViewerContextOut(
        is_external_partner=await user_is_external_partner(tenant_id, user),
    )


@router.post("/{row_id}/dispatch", response_model=MoldTrialSheetOut, summary="待处理试模单发出至供应商仓")
async def dispatch_trial_sheet(
    row_id: int,
    body: MoldTrialDispatchIn,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_trial_row_visible(row, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)
    await dispatch_trial_pending_sheet(tenant_id, row, target_warehouse_id=body.target_warehouse_id)
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    return await _serialize(row)


@router.post(
    "/{row_id}/mark-adjustment-complete",
    response_model=MoldTrialSheetOut,
    summary="确认调整完成（立即送修/已发出）",
)
async def mark_trial_sheet_adjustment_complete(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_trial_row_visible(row, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)
    await assert_trial_mark_adjustment_operator(tenant_id, user, row, resource=RESOURCE_TRIAL_SHEET)
    await mark_trial_adjustment_complete(tenant_id, row)
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    return await _serialize(row)


@router.post("/{row_id}/recall", response_model=MoldTrialSheetOut, summary="调整完成后确认收回试模单")
async def recall_trial_sheet(
    row_id: int,
    body: MoldTrialRecallIn,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_trial_row_visible(row, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)
    await recall_trial_failure_sheet(tenant_id, row, target_warehouse_id=body.target_warehouse_id)
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if row:
        from apps.haoligo.services.trial_sheet_side_effects import send_trial_recalled_messages

        await send_trial_recalled_messages(tenant_id, row)
    return await _serialize(row)


@router.post(
    "/{row_id}/revoke-approval",
    response_model=MoldTrialSheetOut,
    summary="撤销试模单审核（已通过→待审核）",
)
async def revoke_trial_sheet_approval(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_trial_row_visible(row, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)
    assert_approved_for_revoke(row)
    await revert_trial_failure_side_effects_on_revoke(tenant_id, row)
    row.sheet_status = SHEET_STATUS_PENDING
    row.audited_at = None
    row.audited_by_user_id = None
    await row.save()
    return await _serialize(row)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="软删除试模单")
async def delete_trial_sheet(
    row_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(id=row_id).first()
    if not row:
        await _not_found()
    await assert_trial_row_visible(row, tenant_id=tenant_id, user=user, resource=RESOURCE_TRIAL_SHEET)
    assert_sheet_mutation_allowed(row)
    row.deleted_at = timezone.now()
    await row.save()
