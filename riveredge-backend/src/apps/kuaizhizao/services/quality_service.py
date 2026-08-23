"""
质量管理服务模块

提供质量管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
import json
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.process_inspection import ProcessInspection
from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

from apps.kuaizhizao.schemas.quality import (
    # 来料检验单
    IncomingInspectionCreate,
    IncomingInspectionUpdate,
    IncomingInspectionResponse,
    IncomingInspectionListResponse,
    EnsureIqcForPurchaseReceiptResponse,
    EnsureIqcForPurchaseReceiptLineSummary,
    EnsureIqcForCustomerMaterialRegistrationResponse,
    EnsureFqcForFinishedGoodsReceiptResponse,
    EnsureFqcForFinishedGoodsReceiptLineSummary,
    # 过程检验单
    ProcessInspectionCreate, ProcessInspectionUpdate, ProcessInspectionResponse, ProcessInspectionListResponse,
    # 成品检验单
    FinishedGoodsInspectionCreate, FinishedGoodsInspectionUpdate, FinishedGoodsInspectionResponse, FinishedGoodsInspectionListResponse,
)

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.services.inspection_policy_service import (
    iqc_inspection_passed_for_inbound,
    fqc_inspection_passed_for_inbound,
    resolve_iqc_plan_label_for_material,
    resolve_fqc_plan_label_for_material,
    InspectionStage,
    get_quality_effective_config,
    get_quality_inspection_stage_toggles,
    resolve_inspection_policy,
    build_material_policy_cache,
    stage_plan_type,
)
from core.utils.timezone_utils import (
    resolve_business_datetime,
    to_api_isoformat,
    to_site_date,
    today_site_str,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from datetime import date, time as dt_time

INCOMING_INSPECTION_SORTABLE_FIELDS = frozenset({
    "inspection_code", "material_code", "material_name", "supplier_name",
    "purchase_receipt_code", "customer_material_registration_code",
    "inspection_quantity", "qualified_quantity", "unqualified_quantity",
    "inspector_name", "inspection_result", "quality_status", "status",
    "inspection_time", "created_at", "updated_at",
})
PROCESS_INSPECTION_SORTABLE_FIELDS = frozenset({
    "inspection_code", "work_order_code", "operation_name", "material_code",
    "material_name", "inspection_quantity", "qualified_quantity",
    "unqualified_quantity", "inspector_name", "inspection_result",
    "quality_status", "status", "inspection_time", "created_at", "updated_at",
})
FINISHED_GOODS_INSPECTION_SORTABLE_FIELDS = frozenset({
    "inspection_code", "work_order_code", "material_code", "material_name",
    "inspection_quantity", "qualified_quantity", "unqualified_quantity",
    "inspector_name", "inspection_result", "quality_status", "status",
    "inspection_time", "created_at", "updated_at",
})
OQC_INSPECTION_SORTABLE_FIELDS = frozenset({
    "inspection_code", "customer_name", "material_code", "material_name",
    "shipment_notice_code", "sales_delivery_code", "inspection_quantity",
    "qualified_quantity", "unqualified_quantity", "inspector_name",
    "inspection_result", "quality_status", "status", "release_decision",
    "inspection_time", "created_at", "updated_at",
})
NONCONFORMING_LEDGER_SORTABLE_FIELDS = frozenset({
    "code", "work_order_code", "operation_name", "product_code", "product_name",
    "defect_quantity", "defect_type", "defect_reason", "disposition", "status",
    "created_at", "updated_at",
})
EIGHT_D_REPORT_SORTABLE_FIELDS = frozenset({
    "report_code", "title", "severity", "owner_name", "status",
    "due_date", "created_at", "updated_at",
})


def _resolve_quality_list_order_by(
    order_by: Optional[str],
    allowed: frozenset,
    default: str,
    *,
    field_aliases: Optional[Dict[str, str]] = None,
) -> str:
    if not order_by:
        return default
    descending = str(order_by).startswith("-")
    field = str(order_by).lstrip("-")
    if field_aliases and field in field_aliases:
        field = field_aliases[field]
    if field not in allowed:
        return default
    return f"-{field}" if descending else field


def _parse_optional_api_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _apply_quality_inspection_list_filters(
    query,
    filters: Dict[str, Any],
    *,
    keyword_fields: List[str],
    time_field: str = "inspection_time",
) -> Any:
    kw = (filters.get("keyword") or "").strip()
    if kw:
        q = Q()
        for field in keyword_fields:
            q |= Q(**{f"{field}__icontains": kw})
        query = query.filter(q)
    inspection_start = _parse_optional_api_date(filters.get("inspection_start_date"))
    inspection_end = _parse_optional_api_date(filters.get("inspection_end_date"))
    if inspection_start is not None:
        query = query.filter(**{f"{time_field}__gte": datetime.combine(inspection_start, dt_time.min)})
    if inspection_end is not None:
        query = query.filter(**{f"{time_field}__lte": datetime.combine(inspection_end, dt_time.max)})
    created_start = _parse_optional_api_date(filters.get("created_start_date"))
    created_end = _parse_optional_api_date(filters.get("created_end_date"))
    if created_start is not None:
        query = query.filter(created_at__gte=datetime.combine(created_start, dt_time.min))
    if created_end is not None:
        query = query.filter(created_at__lte=datetime.combine(created_end, dt_time.max))
    return query


def _customer_material_line_item_id(item: Any) -> int:
    raw_id = getattr(item, "id", None)
    if raw_id is not None and int(raw_id) > 0:
        return int(raw_id)
    line_id = getattr(item, "line_id", None)
    if line_id is not None:
        return int(line_id)
    mid = getattr(item, "material_id", None)
    if mid is not None:
        return int(mid)
    return 0


def _filter_items_by_selected_item_ids(
    items: List[Any],
    selected_item_ids: Optional[List[int]],
    *,
    id_getter,
) -> List[Any]:
    if selected_item_ids is None:
        return items
    selected = {int(i) for i in selected_item_ids if i is not None}
    if not selected:
        raise BusinessLogicError("请至少选择一条明细")
    filtered = [item for item in items if id_getter(item) in selected]
    if not filtered:
        raise BusinessLogicError("所选明细均不可加载，请重新选择")
    return filtered


from datetime import timedelta
from decimal import Decimal

from apps.kuaizhizao.services.inspection_quantity_utils import assert_inspection_quantities_balanced


async def _get_quality_policy_flags(tenant_id: int) -> tuple[bool, bool]:
    """读取质量策略开关（来料检验、过程检验）。"""
    from infra.services.business_config_service import BusinessConfigService

    cfg = await BusinessConfigService().get_business_config(tenant_id)
    quality = cfg.get("parameters", {}).get("quality", {})
    return bool(quality.get("incoming_inspection", False)), bool(quality.get("process_inspection", False))


async def _is_finished_inspection_enabled(tenant_id: int) -> bool:
    """读取成品检验开关。"""
    from infra.services.business_config_service import BusinessConfigService

    cfg = await BusinessConfigService().get_business_config(tenant_id)
    quality = cfg.get("parameters", {}).get("quality", {})
    return bool(quality.get("finished_inspection", False))


async def _is_quality_audit_required(tenant_id: int, stage_code: str) -> bool:
    """
    质检审核开关：优先读取分阶段开关，未配置时回退到总开关 quality_inspection。
    """
    from infra.services.business_config_service import BusinessConfigService

    config_service = BusinessConfigService()
    return await config_service.check_audit_required(tenant_id, stage_code)


async def _quality_inspection_initial_review_fields(
    tenant_id: int, stage_code: str
) -> Dict[str, Any]:
    """创建检验单时清空审核态（覆盖模型默认「待审核」）。

    与系统审核规范一致：关闭人工审核 = 自动通过，但通过时机对齐「提交/生效」——
    检验单对应「执行检验」(conduct)，创建时不预置已通过。
    """
    _ = tenant_id, stage_code
    return {"review_status": ""}


async def _quality_inspection_conduct_finalize_fields(
    tenant_id: int,
    stage_code: str,
    *,
    quality_status: str,
    inspected_by: int,
    inspector_name: str,
) -> Dict[str, Any]:
    """执行检验后的审核字段（系统规范）。

    - 开启人工审核：进入待审核，由人审/驳
    - 未开启人工审核：自动通过审核（非跳过）；合格件业务态落「已审核」，
      不合格件业务态保持「已检验」以便缺陷/退货，审核列仍为已通过
    """
    from apps.kuaizhizao.constants import ReviewStatus

    fields: Dict[str, Any] = {"status": "已检验"}
    if await _is_quality_audit_required(tenant_id, stage_code):
        fields["review_status"] = ReviewStatus.PENDING.value
        return fields

    # 关闭人工审核：执行检验后自动通过
    fields.update(
        {
            "review_status": ReviewStatus.APPROVED,
            "reviewer_id": inspected_by,
            "reviewer_name": inspector_name,
            "review_time": resolve_business_datetime(),
        }
    )
    if quality_status == "合格":
        fields["status"] = "已审核"
    return fields


async def _require_iqc_stage_enabled(tenant_id: int) -> None:
    """组织级 IQC 总开关（TenantConfig）；关闭时禁止创建/下推来料检。"""
    t = await get_quality_inspection_stage_toggles(tenant_id)
    if not t.get("iqc_enabled", True):
        raise BusinessLogicError("当前组织已关闭来料检验（IQC）环节，禁止创建或下推来料检验单")


_PURCHASE_RECEIPT_IQC_ELIGIBLE_STATUSES = frozenset({
    "待入库", "已入库", "草稿", "draft", "DRAFT",
})


def _purchase_receipt_allows_iqc_creation(receipt: Any) -> bool:
    return str(getattr(receipt, "status", "") or "").strip() in _PURCHASE_RECEIPT_IQC_ELIGIBLE_STATUSES


_CUSTOMER_MATERIAL_IQC_ELIGIBLE_STATUSES = frozenset({"pending", "processed"})


def _customer_material_allows_iqc_creation(registration: Any) -> bool:
    return str(getattr(registration, "status", "") or "").strip() in _CUSTOMER_MATERIAL_IQC_ELIGIBLE_STATUSES


_FINISHED_GOODS_RECEIPT_FQC_ELIGIBLE_STATUSES = frozenset({
    "待入库", "已入库", "草稿", "draft", "DRAFT",
})


def _finished_goods_receipt_allows_fqc_creation(receipt: Any) -> bool:
    return str(getattr(receipt, "status", "") or "").strip() in _FINISHED_GOODS_RECEIPT_FQC_ELIGIBLE_STATUSES


def _semi_finished_goods_receipt_allows_fqc_creation(receipt: Any) -> bool:
    return _finished_goods_receipt_allows_fqc_creation(receipt)


async def _collect_fqc_required_material_ids(tenant_id: int, lines: List[Any]) -> List[int]:
    """成品入库明细中 fqc 策略≠none 且数量>0 的物料 ID（去重保序）。"""
    candidate_mids: List[int] = []
    for item in lines:
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        qty = getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None) or 0
        try:
            if float(qty) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        candidate_mids.append(int(mid))
    policy_cache = await build_material_policy_cache(tenant_id, candidate_mids, "fqc")

    needs_qc_mids: List[int] = []
    seen: set[int] = set()
    for item in lines:
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        qty = getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None) or 0
        try:
            if float(qty) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        mid_int = int(mid)
        if mid_int in seen:
            continue
        if policy_cache.get(mid_int, ("none", None, ""))[0] == "none":
            continue
        seen.add(mid_int)
        needs_qc_mids.append(mid_int)
    return needs_qc_mids


async def _ensure_fqc_for_work_order(
    tenant_id: int,
    work_order_id: int,
    created_by: int,
) -> Optional[FinishedGoodsInspectionResponse]:
    """补齐工单成品检验单（已有则返回，缺失则创建）。"""
    existing = await FinishedGoodsInspection.filter(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        deleted_at__isnull=True,
    ).order_by("-id").first()
    if existing:
        return FinishedGoodsInspectionResponse.model_validate(existing)

    svc = FinishedGoodsInspectionService()
    try:
        return await svc.create_inspection_from_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            created_by=created_by,
        )
    except BusinessLogicError as e:
        msg = str(e)
        if "已存在待检验" in msg:
            pending = await FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True,
            ).order_by("-id").first()
            if pending:
                return FinishedGoodsInspectionResponse.model_validate(pending)
        if "无质检" in msg or "无需下推" in msg:
            return None
        raise


async def _collect_iqc_required_material_ids(tenant_id: int, lines: List[Any]) -> List[int]:
    """采购入库明细中 iqc 策略≠none 且数量>0 的物料 ID（去重保序）。"""
    candidate_mids: List[int] = []
    for item in lines:
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        qty = getattr(item, "receipt_quantity", None) or getattr(item, "quantity", None) or 0
        try:
            if float(qty) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        candidate_mids.append(int(mid))
    policy_cache = await build_material_policy_cache(tenant_id, candidate_mids, "iqc")

    needs_qc_mids: List[int] = []
    seen: set[int] = set()
    for item in lines:
        mid = getattr(item, "material_id", None)
        if not mid:
            continue
        qty = getattr(item, "receipt_quantity", None) or getattr(item, "quantity", None) or 0
        try:
            if float(qty) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        mid_int = int(mid)
        if mid_int in seen:
            continue
        if policy_cache.get(mid_int, ("none", None, ""))[0] == "none":
            continue
        seen.add(mid_int)
        needs_qc_mids.append(mid_int)
    return needs_qc_mids


async def _require_ipqc_stage_enabled(tenant_id: int) -> None:
    """组织级 IPQC 总开关。"""
    t = await get_quality_inspection_stage_toggles(tenant_id)
    if not t.get("ipqc_enabled", True):
        raise BusinessLogicError("当前组织已关闭过程检验（IPQC）环节，禁止创建或下推过程检验单")


async def _require_fqc_stage_enabled(tenant_id: int) -> None:
    """组织级 FQC 总开关。"""
    t = await get_quality_inspection_stage_toggles(tenant_id)
    if not t.get("fqc_enabled", True):
        raise BusinessLogicError("当前组织已关闭成品检验（FQC）环节，禁止创建或下推成品检验单")


def _work_order_product_fields(work_order: Any) -> Dict[str, Any]:
    """工单产品物料字段（product_* 与历史 material_* 兼容）。"""
    from apps.kuaizhizao.services.work_order_tracking_service import WorkOrderTrackingService

    mid = getattr(work_order, "product_id", None) or getattr(work_order, "material_id", None)
    code = getattr(work_order, "product_code", None) or getattr(work_order, "material_code", None)
    name = getattr(work_order, "product_name", None) or getattr(work_order, "material_name", None)
    spec = getattr(work_order, "material_spec", None) or getattr(work_order, "product_spec", None)
    batch = WorkOrderTrackingService.effective_batch_no(work_order)
    serial = WorkOrderTrackingService.effective_serial_no(work_order)
    qty = getattr(work_order, "quantity", None) or getattr(work_order, "planned_quantity", None)
    return {
        "material_id": mid,
        "material_code": code,
        "material_name": name,
        "material_spec": spec,
        "batch_number": batch,
        "serial_number": serial,
        "planned_qty": qty,
    }


async def _resolve_material_base_unit(tenant_id: int, material_id: Any) -> str:
    """检验数量存储单位：物料基础单位。"""
    try:
        mid = int(material_id)
    except (TypeError, ValueError):
        return "个"
    if mid <= 0:
        return "个"
    from apps.master_data.models.material import Material

    mat = await Material.get_or_none(
        tenant_id=tenant_id,
        id=mid,
        deleted_at__isnull=True,
    )
    unit = (getattr(mat, "base_unit", None) or "").strip() if mat else ""
    return unit or "个"


async def _ensure_inspection_material_unit(
    tenant_id: int,
    payload: Dict[str, Any],
) -> None:
    """建单/开展前补齐 material_unit（基础单位）。"""
    unit = str(payload.get("material_unit") or "").strip()
    if unit:
        payload["material_unit"] = unit
        return
    mid = payload.get("material_id")
    payload["material_unit"] = await _resolve_material_base_unit(tenant_id, mid)


def _summarize_pull_preview_items(preview_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """加载候选：明细行数、可加载行数、物料摘要（供取单弹窗展示）。"""
    pushable_count = sum(
        1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
    )
    material_labels: List[str] = []
    seen: set[str] = set()
    for row in preview_items:
        label = str(row.get("material_name") or row.get("material_code") or "").strip()
        if not label or label in seen:
            continue
        seen.add(label)
        material_labels.append(label)
    summary = "、".join(material_labels[:3])
    if len(material_labels) > 3:
        summary = f"{summary} 等{len(material_labels)}种"
    return {
        "line_count": len(preview_items),
        "pushable_line_count": pushable_count,
        "material_summary": summary or None,
    }


def _apply_material_snapshots_to_preview_items(
    preview_items: List[Dict[str, Any]],
    material_snaps: Dict[int, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """用主数据物料快照补齐 preview 行上的编码/名称（兼容明细未冗余快照）。"""
    enriched: List[Dict[str, Any]] = []
    for row in preview_items:
        mid = row.get("material_id")
        code = str(row.get("material_code") or "").strip()
        name = str(row.get("material_name") or "").strip()
        if mid:
            snap = material_snaps.get(int(mid)) or {}
            code = code or str(snap.get("material_code") or "").strip()
            name = name or str(snap.get("material_name") or "").strip()
        enriched.append({**row, "material_code": code, "material_name": name})
    return enriched


async def _resolve_customer_material_pull_customer_name_map(
    tenant_id: int,
    registrations: List[Any],
) -> Dict[int, str]:
    customer_ids = [
        int(r.customer_id)
        for r in registrations
        if getattr(r, "customer_id", None) and not str(getattr(r, "customer_name", "") or "").strip()
    ]
    if not customer_ids:
        return {}
    from apps.master_data.models.customer import Customer

    customers = await Customer.filter(
        tenant_id=tenant_id,
        id__in=list(set(customer_ids)),
        deleted_at__isnull=True,
    ).all()
    return {int(c.id): str(c.name or "").strip() for c in customers if c.name}


async def _load_material_snapshot_map(
    tenant_id: int,
    material_ids: List[int],
) -> Dict[int, Dict[str, Any]]:
    from apps.kuaizhizao.services.customer_material_registration_service import (
        CustomerMaterialRegistrationService,
    )

    return await CustomerMaterialRegistrationService._material_snapshot_map(
        tenant_id, material_ids
    )


def _resolve_work_order_pull_product_display(
    work_order: Any,
    wf: Dict[str, Any],
    material_snaps: Dict[int, Dict[str, Any]],
) -> Dict[str, Optional[str]]:
    """工单加载候选：补齐产品名称/编码（兼容工单未冗余物料快照）。"""
    mid = wf.get("material_id")
    code = str(wf.get("material_code") or "").strip()
    name = str(wf.get("material_name") or "").strip()
    if not name:
        name = str(
            getattr(work_order, "product_name", None)
            or getattr(work_order, "name", None)
            or ""
        ).strip()
    if mid:
        snap = material_snaps.get(int(mid)) or {}
        code = code or str(snap.get("material_code") or "").strip()
        name = name or str(snap.get("material_name") or "").strip()
    return {
        "product_name": name or None,
        "material_code": code or None,
    }


async def _resolve_inspection_template_fields(
    tenant_id: int,
    material_id: Optional[int],
    stage: InspectionStage,
    operation_id: Optional[int] = None,
    explicit_plan_id: Optional[int] = None,
    use_quality_characteristics: bool = False,
) -> Dict[str, Any]:
    """按场景解析 mode/plan_id 并填充检验项模板。"""
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan, InspectionPlanStep
    from apps.kuaizhizao.models.quality_standard import QualityStandard
    from apps.kuaizhizao.services.inspection_step_spec import plan_step_to_snapshot_item
    from infra.exceptions.exceptions import ConflictError

    if not material_id:
        return {}

    plan_type = stage_plan_type(stage)
    mode, resolved_plan_id, _ = await resolve_inspection_policy(
        tenant_id,
        stage,
        material_id=material_id,
        operation_id=operation_id,
    )
    if mode == "none":
        return {}

    def _items_field(items_payload: dict) -> Dict[str, Any]:
        if use_quality_characteristics:
            return {"quality_characteristics": items_payload}
        return {"other_checks": items_payload}

    plan_id = explicit_plan_id or resolved_plan_id

    if mode == "plan":
        plan = None
        if plan_id:
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True, is_active=True
            ).first()
            if plan and str(plan.plan_type) != plan_type:
                from apps.kuaizhizao.services.inspection_policy_service import (
                    plan_type_display_label,
                    stage_display_label,
                )

                hint = (
                    "请在工序主数据上改选过程检验方案。"
                    if stage == "ipqc"
                    else "请在物料主数据上改选与当前检验环节类型一致的方案。"
                )
                raise ConflictError(
                    f"质检方案 {plan.plan_code} 类型为{plan_type_display_label(plan.plan_type)}，"
                    f"与当前{stage_display_label(stage)}所需{plan_type_display_label(plan_type)}不一致。"
                    f"{hint}"
                )
        if not plan:
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                plan_type=plan_type,
                deleted_at__isnull=True,
                is_active=True,
            ).order_by("-created_at").first()
        if plan:
            steps = await InspectionPlanStep.filter(plan_id=plan.id).order_by("sequence").all()
            items: List[Dict[str, Any]] = []
            for step in steps:
                item: Dict[str, Any] = plan_step_to_snapshot_item(step)
                if step.quality_standard_id:
                    std = await QualityStandard.get_or_none(
                        tenant_id=tenant_id, id=step.quality_standard_id, deleted_at__isnull=True
                    )
                    if std:
                        item["standard"] = {
                            "standard_code": std.standard_code,
                            "inspection_items": std.inspection_items,
                            "acceptance_criteria": std.acceptance_criteria,
                        }
                items.append(item)
            payload = {"plan_id": plan.id, "plan_code": plan.plan_code, "plan_version": plan.version, "items": items}
            return {
                "inspection_standard": f"{plan.plan_name} ({plan.plan_code})",
                **_items_field(payload),
            }

    if mode == "simple":
        std = await QualityStandard.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            standard_type=plan_type,
            is_active=True,
            deleted_at__isnull=True,
        ).order_by("-created_at").first()
        if not std:
            std = await QualityStandard.filter(
                tenant_id=tenant_id,
                material_id__isnull=True,
                standard_type=plan_type,
                is_active=True,
                deleted_at__isnull=True,
            ).order_by("-created_at").first()
        if std:
            from apps.kuaizhizao.services.inspection_step_spec import quality_standard_to_template_items

            structured = quality_standard_to_template_items(std)
            if structured:
                payload = {"standard_id": std.id, "items": structured}
                return {
                    "inspection_standard": f"{std.standard_name} ({std.standard_code})",
                    **_items_field(payload),
                }
            methods = std.inspection_methods
            first_method = methods[0] if isinstance(methods, list) and methods else None
            payload = {
                "standard_id": std.id,
                "inspection_items": std.inspection_items,
                "inspection_methods": std.inspection_methods,
                "acceptance_criteria": std.acceptance_criteria,
            }
            return {
                "inspection_standard": f"{std.standard_name} ({std.standard_code})",
                "inspection_method": first_method,
                **_items_field(payload),
            }
    return {}


def _validate_inspection_template_conduct(
    template_json: Any,
    conduct_data: Dict[str, Any],
    *,
    require_step_photo: bool = True,
) -> None:
    from apps.kuaizhizao.services.inspection_step_spec import validate_inspection_template_conduct

    validate_inspection_template_conduct(
        template_json, conduct_data, require_step_photo=require_step_photo
    )


def _assert_unqualified_qty_when_steps_fail(
    inspection: Any,
    template_attr: str,
    inspection_data: Dict[str, Any],
    unqualified_quantity: Any,
) -> None:
    from apps.kuaizhizao.services.inspection_step_spec import assert_unqualified_qty_when_steps_fail

    assert_unqualified_qty_when_steps_fail(
        getattr(inspection, template_attr, None),
        inspection_data,
        unqualified_quantity,
    )


async def _resolve_conduct_inspector_id(
    tenant_id: int,
    inspection_data: Dict[str, Any],
    inspected_by: int,
) -> int:
    """开展检验：优先表单检验人员（id 或 uuid），缺省为当前操作人。"""
    raw = inspection_data.get("inspector_id")
    if raw is not None and raw != "":
        try:
            inspector_id = int(raw)
        except (TypeError, ValueError):
            inspector_id = 0
        if inspector_id > 0:
            return inspector_id
    raw_uuid = inspection_data.get("inspector_uuid")
    if raw_uuid not in (None, ""):
        from infra.models.user import User

        user = await User.get_or_none(tenant_id=tenant_id, uuid=str(raw_uuid).strip())
        if user and user.id:
            return int(user.id)
    return inspected_by


_CONDUCT_PAYLOAD_SKIP_KEYS = frozenset({
    "item_results",
    "conduct_step_results",
    "qualified_quantity",
    "unqualified_quantity",
    "inspector_id",
    "inspector_name",
    "inspector_uuid",
    # 业务时刻仅由服务端 resolve_business_datetime 写入，禁止请求体覆盖
    "inspection_time",
    "review_time",
    "created_at",
    "updated_at",
})


def _apply_template_conduct_to_payload(
    inspection: Any,
    template_attr: str,
    inspection_data: dict,
    *,
    require_step_photo: bool = True,
) -> dict:
    """校验方案项并返回可写入 ORM 的 conduct 附加字段。"""
    from apps.kuaizhizao.services.inspection_step_spec import (
        apply_derived_step_results,
        build_measurement_data_from_conduct,
        merge_template_conduct_results,
    )

    template = getattr(inspection, template_attr, None)
    conduct_input = apply_derived_step_results(template, dict(inspection_data))
    _validate_inspection_template_conduct(
        template, conduct_input, require_step_photo=require_step_photo
    )
    payload = {
        k: v
        for k, v in conduct_input.items()
        if k not in _CONDUCT_PAYLOAD_SKIP_KEYS and v is not None
    }
    merged_measurement = build_measurement_data_from_conduct(template, conduct_input)
    if merged_measurement and hasattr(inspection, "measurement_data"):
        payload["measurement_data"] = merged_measurement
    if template and (
        conduct_input.get("item_results")
        or conduct_input.get("conduct_step_results")
        or conduct_input.get("measurement_data")
    ):
        payload[template_attr] = merge_template_conduct_results(template, conduct_input)
    elif "item_results" in payload:
        payload.pop("item_results", None)
    return payload


def _merge_template_conduct_results(
    template_json: Any,
    conduct_data: Dict[str, Any],
) -> Any:
    from apps.kuaizhizao.services.inspection_step_spec import merge_template_conduct_results

    return merge_template_conduct_results(template_json, conduct_data)


async def _maybe_create_quality_exception_from_inspection(
    tenant_id: int,
    source_type: str,
    source_id: int,
    inspected_by: int,
    problem_description: Optional[str] = None,
    severity: str = "major",
) -> None:
    """检验不合格时自动创建质量异常（幂等：同检验单不重复）。"""
    from apps.kuaizhizao.models.quality_exception import QualityException
    from apps.kuaizhizao.services.exception_service import ExceptionService

    existing = await QualityException.filter(
        tenant_id=tenant_id,
        inspection_record_id=source_id,
        inspection_source_type=source_type,
        exception_type="inspection_failure",
        status__in=["pending", "investigating", "correcting"],
        deleted_at__isnull=True,
    ).first()
    if existing:
        return

    await ExceptionService().create_from_inspection(
        tenant_id=tenant_id,
        source_type=source_type,
        source_id=source_id,
        created_by=inspected_by,
        problem_description=problem_description,
        severity=severity,
    )


async def _maybe_record_spc_samples_from_inspection(
    tenant_id: int,
    inspection: Any,
    template_attr: str,
    inspection_data: dict,
    user_id: int,
    source_type: str,
) -> None:
    """检验含数值步骤时写入 SPC 样本（按 step_key + 物料）。"""
    from apps.kuaizhizao.schemas.quality_improvement import SPCSampleCreate
    from apps.kuaizhizao.services.inspection_step_spec import build_spc_sample_payloads
    from apps.kuaizhizao.services.quality_improvement_service import SPCService

    template = getattr(inspection, template_attr, None)
    payloads = build_spc_sample_payloads(
        template,
        inspection_data,
        material_id=getattr(inspection, "material_id", None),
        material_code=getattr(inspection, "material_code", None),
        source_type=source_type,
        source_id=getattr(inspection, "id", None),
        source_code=getattr(inspection, "inspection_code", None),
    )
    if not payloads:
        return

    spc_svc = SPCService()
    sample_time = resolve_business_datetime()
    for row in payloads:
        await spc_svc.create_sample(
            tenant_id=tenant_id,
            user_id=user_id,
            payload=SPCSampleCreate(
                characteristic_name=row["characteristic_name"],
                sample_time=sample_time,
                sample_value=row["sample_value"],
                sample_group=row.get("sample_group"),
                source_type=row.get("source_type"),
                source_id=row.get("source_id"),
                source_code=row.get("source_code"),
                remarks=row.get("remarks"),
            ),
        )


class IncomingInspectionService(AppBaseService[IncomingInspection]):
    """来料检验单服务"""

    def __init__(self):
        super().__init__(IncomingInspection)

    async def create_incoming_inspection(self, tenant_id: int, inspection_data: IncomingInspectionCreate, created_by: int) -> IncomingInspectionResponse:
        """创建来料检验单"""
        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            raise BusinessLogicError("当前组织未开启来料检验，禁止创建来料检验单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = today_site_str()
            code = await self.generate_code(tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}")

            create_data = inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            template = await _resolve_inspection_template_fields(
                tenant_id,
                create_data.get("material_id"),
                "iqc",
            )
            for k, v in template.items():
                create_data.setdefault(k, v)
            create_data.update(
                await _quality_inspection_initial_review_fields(tenant_id, "incoming_inspection")
            )
            await _ensure_inspection_material_unit(tenant_id, create_data)

            inspection = await IncomingInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
                **create_data
            )
            return IncomingInspectionResponse.model_validate(inspection)

    async def get_incoming_inspection_by_id(self, tenant_id: int, inspection_id: int) -> IncomingInspectionResponse:
        """根据ID获取来料检验单"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_incoming_inspection_lifecycle,
            get_document_milestones
        )

        inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"来料检验单不存在: {inspection_id}")
        
        milestones = await get_document_milestones(tenant_id, "incoming_inspection", inspection_id)
        resp = IncomingInspectionResponse.model_validate(inspection)
        resp = resp.model_copy(update={"lifecycle": get_incoming_inspection_lifecycle(inspection, milestones=milestones)})
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_quality_inspection_capabilities_on_response,
        )
        from core.services.approval.audit_record_enricher import enrich_record

        resp = enrich_quality_inspection_capabilities_on_response(
            inspection,
            resp,
            supports_purchase_return=True,
            pushed_purchase_return_quantity=await self._pushed_purchase_return_quantity_for_inspection(
                tenant_id, inspection_id
            ),
        )
        return await enrich_record(tenant_id, "incoming_inspection", resp)

    async def list_incoming_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> Dict[str, Any]:
        """获取来料检验单列表"""
        query = IncomingInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=filters['supplier_id'])
        if filters.get('material_id'):
            query = query.filter(material_id=filters['material_id'])
        if filters.get('purchase_receipt_id'):
            query = query.filter(purchase_receipt_id=filters['purchase_receipt_id'])
        if filters.get('customer_material_registration_id'):
            query = query.filter(
                customer_material_registration_id=filters['customer_material_registration_id']
            )
        if filters.get("scoped_purchase_receipt_ids") is not None:
            query = query.filter(purchase_receipt_id__in=filters["scoped_purchase_receipt_ids"])
        query = _apply_quality_inspection_list_filters(
            query,
            filters,
            keyword_fields=[
                "inspection_code",
                "material_code",
                "material_name",
                "supplier_name",
                "purchase_receipt_code",
                "customer_material_registration_code",
            ],
        )

        total = await query.count()
        order_clause = _resolve_quality_list_order_by(
            filters.get("order_by"),
            INCOMING_INSPECTION_SORTABLE_FIELDS,
            "-created_at",
        )
        inspections = await query.offset(skip).limit(limit).order_by(order_clause)

        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_quality_inspection_list_capabilities,
        )
        from core.services.approval.audit_record_enricher import enrich_data_payload

        inspection_models = list(inspections)
        inspection_ids = [int(i.id) for i in inspection_models if i.id is not None]
        pushed_return_map = await self._pushed_purchase_return_qty_by_inspection_ids(
            tenant_id, inspection_ids
        )
        responses = enrich_quality_inspection_list_capabilities(
            inspection_models,
            [IncomingInspectionListResponse.model_validate(i) for i in inspection_models],
            supports_purchase_return=True,
            pushed_purchase_return_qty_by_inspection_id={
                int(k): float(v) for k, v in pushed_return_map.items()
            },
        )
        return await enrich_data_payload(tenant_id, "incoming_inspection", {
            "data": [r.model_dump() for r in responses],
            "total": total,
            "success": True
        })

    async def update_incoming_inspection(self, tenant_id: int, inspection_id: int, inspection_data: IncomingInspectionUpdate, updated_by: int) -> IncomingInspectionResponse:
        """更新来料检验单"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            inspection_model = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection_model:
                raise NotFoundError(f"来料检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(inspection_model, "update")
            user_info = await self.get_user_info(updated_by)
            update_data = inspection_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by
            update_data['updated_by_name'] = user_info['name']

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(**update_data)
            return await self.get_incoming_inspection_by_id(tenant_id, inspection_id)

    async def delete_incoming_inspection(
        self, tenant_id: int, inspection_id: int, deleted_by: int
    ) -> None:
        """软删除来料检验单（仅待检验）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            row = await IncomingInspection.get_or_none(
                tenant_id=tenant_id, id=inspection_id, deleted_at__isnull=True
            )
            if not row:
                raise NotFoundError(f"来料检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(row, "delete")
            _ = deleted_by
            row.deleted_at = resolve_business_datetime()
            await row.save(update_fields=["deleted_at"])

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> IncomingInspectionResponse:
        """执行检验"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            inspection_model = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection_model:
                raise NotFoundError(f"来料检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(inspection_model, "conduct")

            inspector_id = await _resolve_conduct_inspector_id(tenant_id, inspection_data, inspected_by)
            inspector_name = await self.get_user_name(inspector_id)
            operator_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity, unqualified_quantity = assert_inspection_quantities_balanced(
                inspection_data.get("qualified_quantity", 0),
                inspection_data.get("unqualified_quantity", 0),
                inspection_model.inspection_quantity,
            )
            _assert_unqualified_qty_when_steps_fail(
                inspection_model, "other_checks", inspection_data, unqualified_quantity
            )

            quality_status = "合格" if unqualified_quantity == Decimal("0") else "不合格"

            conduct_payload = _apply_template_conduct_to_payload(
                inspection_model,
                "other_checks",
                inspection_data,
                require_step_photo=False,
            )

            conduct_update: Dict[str, Any] = {
                "qualified_quantity": qualified_quantity,
                "unqualified_quantity": unqualified_quantity,
                "inspection_result": "已检验",
                "quality_status": quality_status,
                "inspector_id": inspector_id,
                "inspector_name": inspector_name,
                "updated_by": inspected_by,
                "updated_by_name": operator_name,
                **conduct_payload,
            }
            conduct_update.update(
                await _quality_inspection_conduct_finalize_fields(
                    tenant_id,
                    "incoming_inspection",
                    quality_status=quality_status,
                    inspected_by=inspector_id,
                    inspector_name=inspector_name,
                )
            )
            # 时刻必须最后写入，避免被 payload / finalize 之外的键污染
            conduct_update["inspection_time"] = resolve_business_datetime()
            if "review_time" in conduct_update and conduct_update["review_time"] is not None:
                conduct_update["review_time"] = resolve_business_datetime()
            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(**conduct_update)

            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            
            if updated_inspection.quality_status == "不合格" and updated_inspection.unqualified_quantity > 0:
                await _maybe_create_quality_exception_from_inspection(
                    tenant_id=tenant_id,
                    source_type="incoming_inspection",
                    source_id=inspection_id,
                    inspected_by=inspected_by,
                    problem_description=inspection_data.get("nonconformance_reason")
                    or f"来料检验不合格：{updated_inspection.inspection_code}",
                )

            await _maybe_record_spc_samples_from_inspection(
                tenant_id=tenant_id,
                inspection=updated_inspection,
                template_attr="other_checks",
                inspection_data=inspection_data,
                user_id=inspected_by,
                source_type="incoming_inspection",
            )

            # 如果合格，可以增加逻辑确保其可以正式入库（如果入库单是待入库状态）
            if updated_inspection.quality_status == "合格" and updated_inspection.qualified_quantity > 0:
                try:
                    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
                    receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=updated_inspection.purchase_receipt_id)
                    if receipt and receipt.status == "待入库":
                        logger.info(f"来料检验合格 -> 关联采购入库单 {receipt.receipt_code} 可执行确认")
                except Exception as e:
                    logger.warning(f"来料检验合格 -> 关联入库单处理失败: {e}")
            
            return updated_inspection

    async def _pushed_purchase_return_qty_by_inspection_ids(
        self,
        tenant_id: int,
        inspection_ids: List[int],
    ) -> Dict[int, "Decimal"]:
        from decimal import Decimal
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.purchase_return import PurchaseReturn
        from apps.kuaizhizao.models.purchase_return_item import PurchaseReturnItem

        ids = [int(v) for v in inspection_ids if v is not None]
        if not ids:
            return {}

        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="incoming_inspection",
            source_id__in=ids,
            target_type="purchase_return",
        ).values_list("source_id", "target_id")

        target_ids = list({int(tgt) for _, tgt in relations if tgt is not None})
        if not target_ids:
            return {}

        active_return_ids = {
            int(rid)
            for rid in await PurchaseReturn.filter(
                tenant_id=tenant_id,
                id__in=target_ids,
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
        }
        if not active_return_ids:
            return {}

        return_qty_by_id: Dict[int, Decimal] = {}
        item_rows = await PurchaseReturnItem.filter(
            tenant_id=tenant_id,
            return_id__in=list(active_return_ids),
        ).values_list("return_id", "return_quantity")
        for return_id, qty in item_rows:
            rid = int(return_id)
            return_qty_by_id[rid] = return_qty_by_id.get(rid, Decimal("0")) + Decimal(str(qty or 0))

        pushed: Dict[int, Decimal] = {}
        for src_id, tgt_id in relations:
            if int(tgt_id) not in active_return_ids:
                continue
            qty = return_qty_by_id.get(int(tgt_id), Decimal("0"))
            if qty <= 0:
                continue
            sid = int(src_id)
            pushed[sid] = pushed.get(sid, Decimal("0")) + qty
        return pushed

    async def _pushed_purchase_return_quantity_for_inspection(
        self,
        tenant_id: int,
        inspection_id: int,
    ) -> float:
        pushed_map = await self._pushed_purchase_return_qty_by_inspection_ids(
            tenant_id, [inspection_id]
        )
        return float(pushed_map.get(int(inspection_id), 0))

    async def preview_push_to_purchase_return(self, tenant_id: int, inspection_id: int) -> dict:
        """来料检验不合格下推采购退货单预览（不实际创建）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            derive_quality_inspection_capabilities,
        )

        inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"来料检验单不存在: {inspection_id}")

        pushed = await self._pushed_purchase_return_quantity_for_inspection(tenant_id, inspection_id)
        caps = derive_quality_inspection_capabilities(
            inspection,
            supports_purchase_return=True,
            pushed_purchase_return_quantity=pushed,
        )
        push_cap = caps.push_purchase_return
        unqualified = float(inspection.unqualified_quantity or 0)
        max_push = max(0.0, unqualified - pushed)
        preview_items = []
        if max_push > 0:
            preview_items.append(
                {
                    "item_id": int(inspection.id),
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "material_spec": getattr(inspection, "material_spec", None),
                    "unit": inspection.material_unit,
                    "quantity": unqualified,
                    "pushed_quantity": pushed,
                    "max_push_quantity": max_push,
                }
            )

        has_blocking = not push_cap.allowed or not preview_items
        blocking_reason = push_cap.reason if not push_cap.allowed else (
            "quality_inspection.push_purchase_return.not_allowed" if not preview_items else None
        )
        return {
            "target_type": "purchase_return",
            "order_id": inspection.id,
            "order_code": inspection.inspection_code,
            "summary": (
                f"将从来料检验单 {inspection.inspection_code} 生成采购退货单（可下推 {max_push}/{unqualified}）"
                if not has_blocking
                else "当前来料检验单不可下推采购退货单"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "确认后将按可下推数量生成采购退货单；删除待退货单后，可下推数量自动回退。",
        }

    async def push_to_purchase_return(
        self,
        tenant_id: int,
        inspection_id: int,
        created_by: int,
        *,
        quantity: Optional[float] = None,
    ) -> dict:
        """来料检验不合格 -> 按可下推数量生成采购退货单"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        # 不要外层 in_transaction：create_purchase_return / generate_code / create_relation
        # 各自开事务；嵌套会与编码 FOR UPDATE 叠加，易卡死或被 reload 打断后表现为 502/503。
        inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"来料检验单不存在: {inspection_id}")
        pushed = await self._pushed_purchase_return_quantity_for_inspection(tenant_id, inspection_id)
        assert_quality_inspection_capability(
            inspection,
            "push_purchase_return",
            supports_purchase_return=True,
            pushed_purchase_return_quantity=pushed,
        )

        unqualified = float(inspection.unqualified_quantity or 0)
        max_push = max(0.0, unqualified - pushed)
        if max_push <= 0:
            raise BusinessLogicError("不合格数量已全部下推采购退货，无可下推数量")

        if quantity is None:
            push_qty = max_push
        else:
            push_qty = float(quantity)
        if push_qty <= 0:
            raise BusinessLogicError("退货数量必须大于 0")
        if push_qty > max_push:
            raise BusinessLogicError(f"退货数量不能超过可下推数量 {max_push}")

        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
        from apps.kuaizhizao.services.warehouse_service import (
            PurchaseReturnService,
            _resolve_warehouse_name_by_id,
        )
        from apps.kuaizhizao.schemas.warehouse import PurchaseReturnCreate, PurchaseReturnItemCreate

        if not inspection.purchase_receipt_id:
            raise BusinessLogicError("来料检验单未关联采购入库单，无法下推采购退货单")

        receipt = await PurchaseReceipt.get_or_none(
            tenant_id=tenant_id,
            id=int(inspection.purchase_receipt_id),
            deleted_at__isnull=True,
        )
        if not receipt:
            raise NotFoundError(f"采购入库单不存在: {inspection.purchase_receipt_id}")

        receipt_item = await PurchaseReceiptItem.filter(
            tenant_id=tenant_id,
            receipt_id=receipt.id,
            material_id=inspection.material_id,
            deleted_at__isnull=True,
        ).order_by("id").first()

        unit_price = float(receipt_item.unit_price or 0) if receipt_item else 0.0
        if unit_price <= 0 and receipt_item is not None:
            poi_id = getattr(receipt_item, "purchase_order_item_id", None)
            if poi_id:
                from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

                poi = await PurchaseOrderItem.get_or_none(tenant_id=tenant_id, id=int(poi_id))
                if poi is not None:
                    unit_price = float(poi.unit_price or 0)
        total_amount = float(push_qty) * unit_price

        supplier_id = inspection.supplier_id or receipt.supplier_id
        supplier_name = str(inspection.supplier_name or receipt.supplier_name or "").strip()
        if not supplier_id or not supplier_name:
            raise BusinessLogicError("来料检验单缺少供应商信息，无法下推采购退货单")

        if not receipt.warehouse_id:
            raise BusinessLogicError("采购入库单缺少仓库信息，无法下推采购退货单")
        warehouse_id = int(receipt.warehouse_id)
        warehouse_name = await _resolve_warehouse_name_by_id(
            tenant_id, warehouse_id, receipt.warehouse_name
        )

        defect_reason = str(inspection.nonconformance_reason or "质量检验不合格").strip()
        receipt_serials = None
        if receipt_item is not None:
            raw_serials = getattr(receipt_item, "serial_numbers", None)
            if isinstance(raw_serials, list):
                receipt_serials = [str(x).strip() for x in raw_serials if str(x).strip()]
            elif isinstance(raw_serials, str) and raw_serials.strip():
                try:
                    parsed = json.loads(raw_serials)
                    if isinstance(parsed, list):
                        receipt_serials = [str(x).strip() for x in parsed if str(x).strip()]
                except Exception:
                    receipt_serials = None

        item_data = PurchaseReturnItemCreate(
            purchase_receipt_item_id=receipt_item.id if receipt_item else None,
            material_id=inspection.material_id,
            material_code=inspection.material_code,
            material_name=inspection.material_name,
            material_spec=getattr(inspection, "material_spec", None),
            material_unit=inspection.material_unit or "个",
            return_quantity=push_qty,
            unit_price=unit_price,
            total_amount=total_amount,
            location_id=getattr(receipt_item, "location_id", None) if receipt_item else None,
            location_code=getattr(receipt_item, "location_code", None) if receipt_item else None,
            batch_number=getattr(receipt_item, "batch_number", None) if receipt_item else None,
            serial_numbers=receipt_serials,
            notes=defect_reason,
        )

        return_svc = PurchaseReturnService()
        return_data = PurchaseReturnCreate(
            purchase_receipt_id=receipt.id,
            purchase_receipt_code=receipt.receipt_code,
            purchase_order_id=receipt.purchase_order_id,
            purchase_order_code=receipt.purchase_order_code,
            supplier_id=int(supplier_id),
            supplier_name=supplier_name,
            warehouse_id=warehouse_id,
            warehouse_name=warehouse_name,
            return_reason=defect_reason,
            return_type="质量问题",
            status="待退货",
            notes=f"由来料检验单 {inspection.inspection_code} 不合格项自动生成",
            items=[item_data],
        )

        ret_bill = await return_svc.create_purchase_return(
            tenant_id=tenant_id,
            return_data=return_data,
            created_by=created_by,
        )

        # 建立 质检 -> 采购退货单 的关联（独立事务，勿包在创建退货单事务外层）
        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="incoming_inspection",
                    source_id=inspection_id,
                    source_code=inspection.inspection_code,
                    source_name=None,
                    target_type="purchase_return",
                    target_id=ret_bill.id,
                    target_code=ret_bill.return_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="来料检验不合格生成采购退货单",
                ),
                created_by=created_by,
            )
        except Exception as rel_e:
            logger.warning(f"建立质检->采购退货单关联失败: {rel_e}")

        return {"return_id": ret_bill.id, "return_code": ret_bill.return_code}

    async def approve_inspection(self, tenant_id: int, inspection_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> IncomingInspectionResponse:
        """审核检验单"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection:
                raise NotFoundError(f"来料检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(
                inspection,
                "reject" if rejection_reason else "approve",
            )

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=resolve_business_datetime(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by,
                updated_by_name=approver_name,
            )

            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

    async def revoke_approval(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> IncomingInspectionResponse:
        """撤销来料检验审核（已审核 → 已检验；人工审→待审，关审→清空）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )
        from core.services.approval.audit_transition import resolve_revoke_landing_phase

        async with in_transaction():
            inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection:
                raise NotFoundError(f"来料检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(inspection, "revoke_approval")

            audit_required = await _is_quality_audit_required(tenant_id, "incoming_inspection")
            landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
            updater_name = await self.get_user_name(user_id)

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                status="已检验",
                review_status="待审核" if landing == "pending" else "",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=user_id,
                updated_by_name=updater_name,
            )
            return await self.get_incoming_inspection_by_id(tenant_id, inspection_id)

    async def revoke_conduct(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> IncomingInspectionResponse:
        """撤回来料检验（已检验/已驳回 → 待检验，清空检验结果）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )
        from apps.kuaizhizao.services.quality_inspection_lifecycle import (
            assert_revoke_conduct_no_downstream,
            build_quality_inspection_revoke_conduct_fields,
        )

        async with in_transaction():
            inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection:
                raise NotFoundError(f"来料检验单不存在: {inspection_id}")
            pushed_return_qty = await self._pushed_purchase_return_quantity_for_inspection(
                tenant_id, inspection_id
            )
            assert_quality_inspection_capability(
                inspection,
                "revoke_conduct",
                supports_purchase_return=True,
                pushed_purchase_return_quantity=pushed_return_qty,
            )
            await assert_revoke_conduct_no_downstream(
                tenant_id,
                entity_type="incoming_inspection",
                source_id=inspection_id,
                pushed_purchase_return_quantity=pushed_return_qty,
            )
            updater_name = await self.get_user_name(user_id)
            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                **build_quality_inspection_revoke_conduct_fields(
                    entity_type="incoming_inspection",
                    updated_by=user_id,
                    updated_by_name=updater_name,
                )
            )
            return await self.get_incoming_inspection_by_id(tenant_id, inspection_id)

    async def _ensure_missing_incoming_inspections_for_purchase_receipt(
        self,
        tenant_id: int,
        receipt: Any,
        receipt_items: List[Any],
        created_by: int,
        *,
        selected_item_ids: Optional[List[int]] = None,
    ) -> List[IncomingInspectionResponse]:
        """为采购入库单明细补齐缺失的来料检验单（已有则跳过，不拆单）。"""
        receipt_items = _filter_items_by_selected_item_ids(
            receipt_items,
            selected_item_ids,
            id_getter=lambda item: int(item.id),
        )
        purchase_receipt_id = int(receipt.id)
        initial_review_fields = await _quality_inspection_initial_review_fields(
            tenant_id, "incoming_inspection"
        )
        inspections: List[IncomingInspectionResponse] = []
        for item in receipt_items:
            existing = await IncomingInspection.filter(
                tenant_id=tenant_id,
                purchase_receipt_id=purchase_receipt_id,
                material_id=item.material_id,
                deleted_at__isnull=True,
            ).first()
            if existing:
                continue

            eff, _, _ = await resolve_inspection_policy(
                tenant_id,
                "iqc",
                material_id=item.material_id,
            )
            if eff == "none":
                continue

            template = await _resolve_inspection_template_fields(
                tenant_id,
                item.material_id,
                "iqc",
            )

            today = today_site_str()
            code = await self.generate_code(tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}")

            create_kwargs: Dict[str, Any] = {
                "tenant_id": tenant_id,
                "inspection_code": code,
                "source_type": "purchase_receipt",
                "purchase_receipt_id": purchase_receipt_id,
                "purchase_receipt_code": receipt.receipt_code,
                "supplier_id": receipt.supplier_id,
                "supplier_name": receipt.supplier_name,
                "material_id": item.material_id,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "material_spec": item.material_spec,
                "material_unit": item.material_unit,
                "inspection_quantity": item.receipt_quantity,
                "qualified_quantity": 0,
                "unqualified_quantity": 0,
                "inspection_result": "待检验",
                "quality_status": "待判定",
                "status": "待检验",
                "created_by": created_by,
                **template,
            }
            create_kwargs.update(initial_review_fields)
            if created_by:
                creator_name = await self.get_user_name(created_by)
                create_kwargs["created_by_name"] = creator_name
                create_kwargs["updated_by"] = created_by
                create_kwargs["updated_by_name"] = creator_name
            inspection = await IncomingInspection.create(**create_kwargs)
            inspections.append(IncomingInspectionResponse.model_validate(inspection))

            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="purchase_receipt",
                        source_id=purchase_receipt_id,
                        source_code=receipt.receipt_code,
                        source_name=None,
                        target_type="incoming_inspection",
                        target_id=inspection.id,
                        target_code=inspection.inspection_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="从采购入库单创建来料检验单",
                    ),
                    created_by=created_by,
                )
            except Exception as rel_e:
                logger.warning("创建采购入库→来料检验 单据关联失败: %s", rel_e)

        return inspections

    async def ensure_iqc_for_purchase_receipt(
        self,
        tenant_id: int,
        purchase_receipt_id: int,
        created_by: int,
    ) -> EnsureIqcForPurchaseReceiptResponse:
        """
        确认入库前：按物料 IQC 策略自动补齐缺失检验单，并评估是否允许进入确认预览。
        """
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

        cfg = await get_quality_effective_config(tenant_id)
        gate_enabled = bool(cfg["gate"]["require_iqc_before_receipt_confirm"])
        iqc_can_create = bool(cfg["stage_enabled"]["iqc"] and cfg["module_enabled"]["incoming"])

        receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
        if not receipt:
            raise NotFoundError(f"采购入库单不存在: {purchase_receipt_id}")

        receipt_items = await PurchaseReceiptItem.filter(
            tenant_id=tenant_id,
            receipt_id=purchase_receipt_id,
        ).all()
        if not receipt_items:
            raise BusinessLogicError("采购入库单没有明细项")

        needs_qc_mids = await _collect_iqc_required_material_ids(tenant_id, receipt_items)
        requires_iqc = bool(needs_qc_mids)

        created: List[IncomingInspectionResponse] = []
        if requires_iqc and iqc_can_create and _purchase_receipt_allows_iqc_creation(receipt):
            async with in_transaction():
                created = await self._ensure_missing_incoming_inspections_for_purchase_receipt(
                    tenant_id=tenant_id,
                    receipt=receipt,
                    receipt_items=receipt_items,
                    created_by=created_by,
                )

        inspections = await IncomingInspection.filter(
            tenant_id=tenant_id,
            purchase_receipt_id=purchase_receipt_id,
            deleted_at__isnull=True,
        ).all()
        needs_qc_set = set(needs_qc_mids)
        passed_by_material: Dict[int, bool] = {}
        for inspection in inspections:
            if inspection.material_id and await iqc_inspection_passed_for_inbound(tenant_id, inspection):
                passed_by_material[int(inspection.material_id)] = True

        pending_inspections: List[IncomingInspectionResponse] = []
        for i in inspections:
            if not i.material_id or int(i.material_id) not in needs_qc_set:
                continue
            if await iqc_inspection_passed_for_inbound(tenant_id, i):
                continue
            pending_inspections.append(IncomingInspectionResponse.model_validate(i))

        all_iqc_passed = (not requires_iqc) or all(passed_by_material.get(mid) for mid in needs_qc_mids)
        # 门禁关闭：可确认入库（行上仍展示检验进度，便于对照）
        can_confirm_inbound = (not gate_enabled) or all_iqc_passed
        message: Optional[str] = None
        if gate_enabled and requires_iqc and not all_iqc_passed:
            if not inspections:
                message = "已启用「收货前必须来料检验」，请先创建并完成来料检验，检验合格后再确认入库"
            else:
                message = (
                    "已启用「收货前必须来料检验」，相关物料的来料检验须合格"
                    "（需审核时须审核通过）后才能确认入库"
                )

        # 同物料多张检验单时优先已执行/较新的，避免误挂未检草稿
        _conducted = frozenset({"已检验", "已审核"})
        inspection_by_material: Dict[int, IncomingInspection] = {}
        for inspection in sorted(
            inspections,
            key=lambda row: (
                0 if str(getattr(row, "status", "") or "").strip() in _conducted else 1,
                -(getattr(row, "updated_at", None).timestamp() if getattr(row, "updated_at", None) else 0),
                -int(getattr(row, "id", 0) or 0),
            ),
        ):
            mid = getattr(inspection, "material_id", None)
            if mid and int(mid) not in inspection_by_material:
                inspection_by_material[int(mid)] = inspection

        plan_label_cache: Dict[int, Optional[str]] = {}
        line_material_ids: List[int] = []
        for item in receipt_items:
            mid = getattr(item, "material_id", None)
            if not mid:
                continue
            qty = getattr(item, "receipt_quantity", None) or getattr(item, "quantity", None) or 0
            try:
                if float(qty) <= 0:
                    continue
            except (TypeError, ValueError):
                continue
            line_material_ids.append(int(mid))
        iqc_policy_cache = await build_material_policy_cache(tenant_id, line_material_ids, "iqc")

        line_summaries: List[EnsureIqcForPurchaseReceiptLineSummary] = []
        for item in receipt_items:
            mid = getattr(item, "material_id", None)
            if not mid:
                continue
            qty = getattr(item, "receipt_quantity", None) or getattr(item, "quantity", None) or 0
            try:
                qty_f = float(qty)
            except (TypeError, ValueError):
                qty_f = 0.0
            if qty_f <= 0:
                continue
            mid_int = int(mid)
            eff_mode = iqc_policy_cache.get(mid_int, ("none", None, ""))[0]
            iqc_required = eff_mode != "none"
            plan_label: Optional[str] = None
            if iqc_required:
                if mid_int not in plan_label_cache:
                    plan_label_cache[mid_int] = await resolve_iqc_plan_label_for_material(tenant_id, mid_int)
                plan_label = plan_label_cache[mid_int]

            linked = inspection_by_material.get(mid_int)
            passed = False
            if not iqc_required:
                passed = True
            elif linked:
                passed = await iqc_inspection_passed_for_inbound(tenant_id, linked)

            line_summaries.append(
                EnsureIqcForPurchaseReceiptLineSummary(
                    receipt_item_id=int(item.id),
                    material_id=mid_int,
                    material_code=str(getattr(item, "material_code", "") or ""),
                    material_name=str(getattr(item, "material_name", "") or ""),
                    receipt_quantity=qty_f,
                    iqc_required=iqc_required,
                    iqc_mode=eff_mode if iqc_required else "none",
                    plan_label=plan_label,
                    inspection_id=int(linked.id) if linked else None,
                    inspection_code=getattr(linked, "inspection_code", None) if linked else None,
                    inspection_status=getattr(linked, "status", None) if linked else None,
                    quality_status=getattr(linked, "quality_status", None) if linked else None,
                    review_status=getattr(linked, "review_status", None) if linked else None,
                    passed=passed,
                    # 行「可入库」：门禁关闭时可确认；门禁开启须检验合格
                    can_inbound=(not gate_enabled) or passed,
                )
            )

        return EnsureIqcForPurchaseReceiptResponse(
            can_confirm_inbound=can_confirm_inbound,
            requires_iqc=requires_iqc,
            gate_enabled=gate_enabled,
            iqc_stage_enabled=bool(cfg["stage_enabled"]["iqc"]),
            iqc_module_enabled=bool(cfg["module_enabled"]["incoming"]),
            created_count=len(created),
            created_inspections=created,
            pending_inspections=pending_inspections,
            line_summaries=line_summaries,
            message=message,
        )

    async def _ensure_missing_incoming_inspections_for_customer_material(
        self,
        tenant_id: int,
        registration: Any,
        registration_items: List[Any],
        created_by: int,
        *,
        selected_item_ids: Optional[List[int]] = None,
    ) -> List[IncomingInspectionResponse]:
        """为代工来料明细补齐缺失的来料检验单（已有则跳过）。"""
        registration_items = _filter_items_by_selected_item_ids(
            registration_items,
            selected_item_ids,
            id_getter=_customer_material_line_item_id,
        )
        from apps.master_data.models.material import Material

        registration_id = int(registration.id)
        mat_rows = await Material.filter(
            tenant_id=tenant_id,
            id__in=[it.material_id for it in registration_items if it.material_id],
            deleted_at__isnull=True,
        ).all()
        mat_by_id = {m.id: m for m in mat_rows}
        initial_review_fields = await _quality_inspection_initial_review_fields(
            tenant_id, "incoming_inspection"
        )
        inspections: List[IncomingInspectionResponse] = []

        for item in registration_items:
            if not item.material_id:
                continue
            existing = await IncomingInspection.filter(
                tenant_id=tenant_id,
                customer_material_registration_id=registration_id,
                material_id=item.material_id,
                deleted_at__isnull=True,
            ).first()
            if existing:
                continue

            eff, _, _ = await resolve_inspection_policy(
                tenant_id, "iqc", material_id=item.material_id
            )
            if eff == "none":
                continue

            mat = mat_by_id.get(item.material_id)
            template = await _resolve_inspection_template_fields(
                tenant_id, item.material_id, "iqc"
            )
            today = today_site_str()
            code = await self.generate_code(
                tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}"
            )
            create_kwargs: Dict[str, Any] = {
                "tenant_id": tenant_id,
                "inspection_code": code,
                "source_type": "customer_material_inbound",
                "customer_material_registration_id": registration_id,
                "customer_material_registration_code": registration.registration_code,
                "customer_id": registration.customer_id,
                "customer_name": registration.customer_name,
                "material_id": item.material_id,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "material_spec": getattr(mat, "specification", None) if mat else None,
                "material_unit": getattr(mat, "base_unit", None) or "件" if mat else "件",
                "inspection_quantity": item.quantity,
                "qualified_quantity": 0,
                "unqualified_quantity": 0,
                "inspection_result": "待检验",
                "quality_status": "待判定",
                "status": "待检验",
                "created_by": created_by,
                **template,
            }
            create_kwargs.update(initial_review_fields)
            if created_by:
                creator_name = await self.get_user_name(created_by)
                create_kwargs["created_by_name"] = creator_name
                create_kwargs["updated_by"] = created_by
                create_kwargs["updated_by_name"] = creator_name
            inspection = await IncomingInspection.create(**create_kwargs)
            inspections.append(IncomingInspectionResponse.model_validate(inspection))

            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="customer_material_inbound",
                        source_id=registration_id,
                        source_code=registration.registration_code,
                        source_name=None,
                        target_type="incoming_inspection",
                        target_id=inspection.id,
                        target_code=inspection.inspection_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="从代工来料单创建来料检验单",
                    ),
                    created_by=created_by,
                )
            except Exception as rel_e:
                logger.warning("创建代工来料→来料检验 单据关联失败: %s", rel_e)

        return inspections

    async def ensure_iqc_for_customer_material_registration(
        self,
        tenant_id: int,
        registration_id: int,
        created_by: int,
    ) -> EnsureIqcForCustomerMaterialRegistrationResponse:
        """确认代工来料入库前：按物料 IQC 策略自动补齐缺失检验单，并评估是否允许确认入库。"""
        from apps.kuaizhizao.models.customer_material_registration import CustomerMaterialRegistration
        from apps.kuaizhizao.services.customer_material_registration_service import (
            CustomerMaterialRegistrationService,
        )

        cfg = await get_quality_effective_config(tenant_id)
        gate_enabled = bool(cfg["gate"]["require_iqc_before_customer_material_confirm"])
        iqc_can_create = bool(cfg["stage_enabled"]["iqc"] and cfg["module_enabled"]["incoming"])

        registration = await CustomerMaterialRegistration.get_or_none(
            tenant_id=tenant_id, id=registration_id, deleted_at__isnull=True
        )
        if not registration:
            raise NotFoundError(f"代工来料单不存在: {registration_id}")

        registration_items = await CustomerMaterialRegistrationService()._effective_items(registration)
        if not registration_items:
            raise BusinessLogicError("代工来料单没有明细项")

        needs_qc_mids = await _collect_iqc_required_material_ids(tenant_id, registration_items)
        requires_iqc = bool(needs_qc_mids)

        created: List[IncomingInspectionResponse] = []
        if requires_iqc and iqc_can_create and _customer_material_allows_iqc_creation(registration):
            async with in_transaction():
                created = await self._ensure_missing_incoming_inspections_for_customer_material(
                    tenant_id=tenant_id,
                    registration=registration,
                    registration_items=registration_items,
                    created_by=created_by,
                )

        inspections = await IncomingInspection.filter(
            tenant_id=tenant_id,
            customer_material_registration_id=registration_id,
            deleted_at__isnull=True,
        ).all()
        needs_qc_set = set(needs_qc_mids)
        passed_by_material: Dict[int, bool] = {}
        for inspection in inspections:
            if inspection.material_id and await iqc_inspection_passed_for_inbound(tenant_id, inspection):
                passed_by_material[int(inspection.material_id)] = True

        pending_inspections: List[IncomingInspectionResponse] = []
        for i in inspections:
            if not i.material_id or int(i.material_id) not in needs_qc_set:
                continue
            if await iqc_inspection_passed_for_inbound(tenant_id, i):
                continue
            pending_inspections.append(IncomingInspectionResponse.model_validate(i))

        all_iqc_passed = (not requires_iqc) or all(passed_by_material.get(mid) for mid in needs_qc_mids)
        can_confirm_inbound = (not gate_enabled) or all_iqc_passed
        message: Optional[str] = None
        if gate_enabled and requires_iqc and not all_iqc_passed:
            if not inspections:
                message = "已启用「代工来料入库前必须来料检验」，请先创建并完成来料检验，检验合格后再确认入库"
            else:
                message = (
                    "已启用「代工来料入库前必须来料检验」，相关物料的来料检验须合格"
                    "（需审核时须审核通过）后才能确认入库"
                )

        inspection_by_material: Dict[int, IncomingInspection] = {}
        for inspection in inspections:
            mid = getattr(inspection, "material_id", None)
            if mid and int(mid) not in inspection_by_material:
                inspection_by_material[int(mid)] = inspection

        plan_label_cache: Dict[int, Optional[str]] = {}
        line_material_ids: List[int] = []
        for item in registration_items:
            mid = getattr(item, "material_id", None)
            if not mid:
                continue
            qty = getattr(item, "quantity", None) or getattr(item, "receipt_quantity", None) or 0
            try:
                if float(qty) <= 0:
                    continue
            except (TypeError, ValueError):
                continue
            line_material_ids.append(int(mid))
        iqc_policy_cache = await build_material_policy_cache(tenant_id, line_material_ids, "iqc")

        line_summaries: List[EnsureIqcForPurchaseReceiptLineSummary] = []
        for item in registration_items:
            mid = getattr(item, "material_id", None)
            if not mid:
                continue
            qty = getattr(item, "quantity", None) or getattr(item, "receipt_quantity", None) or 0
            try:
                qty_f = float(qty)
            except (TypeError, ValueError):
                qty_f = 0.0
            if qty_f <= 0:
                continue
            mid_int = int(mid)
            eff_mode = iqc_policy_cache.get(mid_int, ("none", None, ""))[0]
            iqc_required = eff_mode != "none"
            plan_label: Optional[str] = None
            if iqc_required:
                if mid_int not in plan_label_cache:
                    plan_label_cache[mid_int] = await resolve_iqc_plan_label_for_material(tenant_id, mid_int)
                plan_label = plan_label_cache[mid_int]

            linked = inspection_by_material.get(mid_int)
            passed = False
            if not iqc_required:
                passed = True
            elif linked:
                passed = await iqc_inspection_passed_for_inbound(tenant_id, linked)

            item_id = getattr(item, "id", None) or mid_int
            line_summaries.append(
                EnsureIqcForPurchaseReceiptLineSummary(
                    receipt_item_id=int(item_id),
                    material_id=mid_int,
                    material_code=str(getattr(item, "material_code", "") or ""),
                    material_name=str(getattr(item, "material_name", "") or ""),
                    receipt_quantity=qty_f,
                    iqc_required=iqc_required,
                    iqc_mode=eff_mode if iqc_required else "none",
                    plan_label=plan_label,
                    inspection_id=int(linked.id) if linked else None,
                    inspection_code=getattr(linked, "inspection_code", None) if linked else None,
                    inspection_status=getattr(linked, "status", None) if linked else None,
                    quality_status=getattr(linked, "quality_status", None) if linked else None,
                    review_status=getattr(linked, "review_status", None) if linked else None,
                    passed=passed,
                    can_inbound=passed,
                )
            )

        return EnsureIqcForCustomerMaterialRegistrationResponse(
            can_confirm_inbound=can_confirm_inbound,
            requires_iqc=requires_iqc,
            gate_enabled=gate_enabled,
            iqc_stage_enabled=bool(cfg["stage_enabled"]["iqc"]),
            iqc_module_enabled=bool(cfg["module_enabled"]["incoming"]),
            registration_code=getattr(registration, "registration_code", None),
            created_count=len(created),
            created_inspections=created,
            pending_inspections=pending_inspections,
            line_summaries=line_summaries,
            message=message,
        )

    async def _resolve_iqc_policy_eff(
        self,
        tenant_id: int,
        material_id: int,
        cache: Dict[int, str],
    ) -> str:
        mid = int(material_id)
        if mid not in cache:
            batch = await build_material_policy_cache(tenant_id, [mid], "iqc")
            cache[mid] = batch.get(mid, ("none", None, ""))[0]
        return cache[mid]

    def _derive_iqc_pull_capability(
        self,
        *,
        source_allowed: bool,
        preview_items: List[Dict[str, Any]],
        not_allowed_reason: str = "incoming_inspection.pull_from_purchase_receipt.not_allowed",
        no_lines_reason: str = "incoming_inspection.pull_from_purchase_receipt.no_lines",
        already_pulled_reason: str = "incoming_inspection.pull_from_purchase_receipt.already_pulled",
    ) -> tuple[bool, Optional[str]]:
        if not source_allowed:
            return False, not_allowed_reason
        if not preview_items:
            return False, no_lines_reason
        pushable = any(float(row.get("max_push_quantity") or 0) > 0 for row in preview_items)
        if not pushable:
            return False, already_pulled_reason
        return True, None

    async def _build_pull_preview_items_for_purchase_receipt(
        self,
        tenant_id: int,
        receipt: Any,
        receipt_items: List[Any],
        *,
        existing_by_material: Optional[Dict[int, Any]] = None,
        policy_cache: Optional[Dict[int, str]] = None,
    ) -> List[Dict[str, Any]]:
        purchase_receipt_id = int(receipt.id)
        if existing_by_material is None:
            material_ids = [int(i.material_id) for i in receipt_items if i.material_id]
            existing_rows = await IncomingInspection.filter(
                tenant_id=tenant_id,
                purchase_receipt_id=purchase_receipt_id,
                material_id__in=material_ids,
                deleted_at__isnull=True,
            ).all()
            existing_by_material = {
                int(row.material_id): row for row in existing_rows if row.material_id is not None
            }

        cache: Dict[int, str] = policy_cache if policy_cache is not None else {}
        preview_items: List[Dict[str, Any]] = []
        for item in receipt_items:
            mid = getattr(item, "material_id", None)
            if not mid:
                continue
            qty = float(getattr(item, "receipt_quantity", 0) or 0)
            if qty <= 0:
                continue
            if await self._resolve_iqc_policy_eff(tenant_id, int(mid), cache) == "none":
                continue
            existing = existing_by_material.get(int(mid))
            pushed = float(existing.inspection_quantity or 0) if existing else 0.0
            max_push = qty if not existing else 0.0
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": int(mid),
                    "material_code": str(getattr(item, "material_code", "") or ""),
                    "material_name": str(getattr(item, "material_name", "") or ""),
                    "quantity": qty,
                    "pushed_quantity": pushed,
                    "max_push_quantity": max_push,
                }
            )
        return preview_items

    async def _build_pull_preview_items_for_customer_material(
        self,
        tenant_id: int,
        registration: Any,
        registration_items: List[Any],
        *,
        existing_by_material: Optional[Dict[int, Any]] = None,
        policy_cache: Optional[Dict[int, str]] = None,
    ) -> List[Dict[str, Any]]:
        registration_id = int(registration.id)
        if existing_by_material is None:
            material_ids = [int(i.material_id) for i in registration_items if i.material_id]
            existing_rows = await IncomingInspection.filter(
                tenant_id=tenant_id,
                customer_material_registration_id=registration_id,
                material_id__in=material_ids,
                deleted_at__isnull=True,
            ).all()
            existing_by_material = {
                int(row.material_id): row for row in existing_rows if row.material_id is not None
            }

        cache: Dict[int, str] = policy_cache if policy_cache is not None else {}
        preview_items: List[Dict[str, Any]] = []
        for item in registration_items:
            mid = getattr(item, "material_id", None)
            if not mid:
                continue
            qty = float(getattr(item, "quantity", 0) or 0)
            if qty <= 0:
                continue
            if await self._resolve_iqc_policy_eff(tenant_id, int(mid), cache) == "none":
                continue
            existing = existing_by_material.get(int(mid))
            pushed = float(existing.inspection_quantity or 0) if existing else 0.0
            max_push = qty if not existing else 0.0
            line_id = getattr(item, "id", None) or getattr(item, "line_id", None) or mid
            preview_items.append(
                {
                    "item_id": int(line_id),
                    "material_id": int(mid),
                    "material_code": str(getattr(item, "material_code", "") or ""),
                    "material_name": str(getattr(item, "material_name", "") or ""),
                    "quantity": qty,
                    "pushed_quantity": pushed,
                    "max_push_quantity": max_push,
                }
            )
        return preview_items

    async def preview_pull_from_purchase_receipt(
        self,
        tenant_id: int,
        purchase_receipt_id: int,
    ) -> Dict[str, Any]:
        """从采购入库单加载创建来料检验单预览（不实际创建）。"""
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            raise BusinessLogicError("当前组织未开启来料检验，禁止从采购入库单加载来料检验")

        receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
        if not receipt:
            raise NotFoundError(f"采购入库单不存在: {purchase_receipt_id}")

        receipt_items = await PurchaseReceiptItem.filter(
            tenant_id=tenant_id,
            receipt_id=purchase_receipt_id,
        ).all()
        source_allowed = _purchase_receipt_allows_iqc_creation(receipt) and bool(receipt_items)
        preview_items = await self._build_pull_preview_items_for_purchase_receipt(
            tenant_id, receipt, receipt_items
        )
        allowed, reason = self._derive_iqc_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
        )
        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "incoming_inspection",
            "source_id": purchase_receipt_id,
            "source_code": receipt.receipt_code,
            "summary": (
                f"将从采购入库单 {receipt.receipt_code} 创建来料检验（{pushable_count}/{len(preview_items)} 条可加载）"
                if preview_items and allowed
                else f"采购入库单 {receipt.receipt_code} 当前不可加载来料检验"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "确认后将按可加载明细创建来料检验单；删除来料检验单后，可加载数量自动回退。",
        }

    async def preview_pull_from_customer_material_registration(
        self,
        tenant_id: int,
        registration_id: int,
    ) -> Dict[str, Any]:
        """从代工来料单加载创建来料检验单预览（不实际创建）。"""
        from apps.kuaizhizao.models.customer_material_registration import CustomerMaterialRegistration
        from apps.kuaizhizao.services.customer_material_registration_service import (
            CustomerMaterialRegistrationService,
        )

        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            raise BusinessLogicError("当前组织未开启来料检验，禁止从代工来料单加载来料检验")

        registration = await CustomerMaterialRegistration.get_or_none(
            tenant_id=tenant_id, id=registration_id, deleted_at__isnull=True
        )
        if not registration:
            raise NotFoundError(f"代工来料单不存在: {registration_id}")

        lines = await CustomerMaterialRegistrationService()._effective_items(registration)
        source_allowed = _customer_material_allows_iqc_creation(registration) and bool(lines)
        preview_items = await self._build_pull_preview_items_for_customer_material(
            tenant_id, registration, lines
        )
        allowed, reason = self._derive_iqc_pull_capability(
            source_allowed=source_allowed,
            preview_items=preview_items,
            not_allowed_reason="incoming_inspection.pull_from_customer_material_registration.not_allowed",
            no_lines_reason="incoming_inspection.pull_from_customer_material_registration.no_lines",
            already_pulled_reason="incoming_inspection.pull_from_customer_material_registration.already_pulled",
        )
        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        reg_code = getattr(registration, "registration_code", None) or registration_id
        return {
            "target_type": "incoming_inspection",
            "source_id": registration_id,
            "source_code": reg_code,
            "summary": (
                f"将从代工来料单 {reg_code} 创建来料检验（{pushable_count}/{len(preview_items)} 条可加载）"
                if preview_items and allowed
                else f"代工来料单 {reg_code} 当前不可加载来料检验"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "确认后将按可加载明细创建来料检验单；删除来料检验单后，可加载数量自动回退。",
        }

    async def list_purchase_receipt_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        receipt_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """来料检验加载：采购入库单候选列表（含 capabilities）。"""
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            return {"data": [], "total": 0, "success": True}

        query = PurchaseReceipt.filter(
            tenant_id=tenant_id,
            status__in=list(_PURCHASE_RECEIPT_IQC_ELIGIBLE_STATUSES),
        )
        kw = str(keyword or "").strip()
        rc = str(receipt_code or "").strip()
        if rc:
            query = query.filter(receipt_code__icontains=rc)
        elif kw:
            query = query.filter(
                Q(receipt_code__icontains=kw) | Q(supplier_name__icontains=kw)
            )
        total = await query.count()
        receipts = await query.offset(skip).limit(limit).order_by("-created_at")
        receipt_ids = [int(r.id) for r in receipts]
        if not receipt_ids:
            return {"data": [], "total": total, "success": True}

        all_items = await PurchaseReceiptItem.filter(
            tenant_id=tenant_id,
            receipt_id__in=receipt_ids,
        ).all()
        items_by_receipt: Dict[int, List[Any]] = {}
        for item in all_items:
            items_by_receipt.setdefault(int(item.receipt_id), []).append(item)

        inspections = await IncomingInspection.filter(
            tenant_id=tenant_id,
            purchase_receipt_id__in=receipt_ids,
            deleted_at__isnull=True,
        ).all()

        policy_cache: Dict[int, str] = {}
        rows: List[Dict[str, Any]] = []
        for receipt in receipts:
            rid = int(receipt.id)
            receipt_items = items_by_receipt.get(rid, [])
            existing_by_material: Dict[int, Any] = {}
            for insp in inspections:
                if insp.purchase_receipt_id == rid and insp.material_id:
                    existing_by_material[int(insp.material_id)] = insp
            preview_items = await self._build_pull_preview_items_for_purchase_receipt(
                tenant_id,
                receipt,
                receipt_items,
                existing_by_material=existing_by_material,
                policy_cache=policy_cache,
            )
            allowed, reason = self._derive_iqc_pull_capability(
                source_allowed=_purchase_receipt_allows_iqc_creation(receipt) and bool(receipt_items),
                preview_items=preview_items,
            )
            pull_summary = _summarize_pull_preview_items(preview_items)
            label = f"{receipt.receipt_code or rid}"
            if getattr(receipt, "supplier_name", None):
                label = f"{label} - {receipt.supplier_name}"
            rows.append(
                {
                    "id": rid,
                    "code": label,
                    "receipt_code": receipt.receipt_code,
                    "purchase_order_code": getattr(receipt, "purchase_order_code", None),
                    "supplier_name": receipt.supplier_name,
                    "status": getattr(receipt, "status", None),
                    "updated_at": getattr(receipt, "updated_at", None),
                    **pull_summary,
                    "capabilities": {
                        "pull_incoming_inspection": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

    async def list_customer_material_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        registration_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """来料检验加载：代工来料单候选列表（含 capabilities）。"""
        from apps.kuaizhizao.models.customer_material_registration import CustomerMaterialRegistration
        from apps.kuaizhizao.services.customer_material_registration_service import (
            CustomerMaterialRegistrationService,
        )

        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            return {"data": [], "total": 0, "success": True}

        query = CustomerMaterialRegistration.filter(
            tenant_id=tenant_id,
            status__in=list(_CUSTOMER_MATERIAL_IQC_ELIGIBLE_STATUSES),
            deleted_at__isnull=True,
        )
        kw = str(keyword or "").strip()
        reg_code = str(registration_code or "").strip()
        if reg_code:
            query = query.filter(registration_code__icontains=reg_code)
        elif kw:
            query = query.filter(
                Q(registration_code__icontains=kw) | Q(customer_name__icontains=kw)
            )
        total = await query.count()
        registrations = await query.offset(skip).limit(limit).order_by("-created_at")
        if not registrations:
            return {"data": [], "total": total, "success": True}

        reg_svc = CustomerMaterialRegistrationService()
        policy_cache: Dict[int, str] = {}
        reg_lines: Dict[int, List[Any]] = {}
        all_material_ids: set[int] = set()
        for registration in registrations:
            rid = int(registration.id)
            lines = await reg_svc._effective_items(registration)
            reg_lines[rid] = lines
            for item in lines:
                if item.material_id:
                    all_material_ids.add(int(item.material_id))
        material_snaps = await reg_svc._material_snapshot_map(tenant_id, list(all_material_ids))
        customer_name_map = await _resolve_customer_material_pull_customer_name_map(
            tenant_id, registrations
        )

        rows: List[Dict[str, Any]] = []
        for registration in registrations:
            rid = int(registration.id)
            lines = reg_lines.get(rid, [])
            material_ids = [int(i.material_id) for i in lines if i.material_id]
            existing_rows = await IncomingInspection.filter(
                tenant_id=tenant_id,
                customer_material_registration_id=rid,
                material_id__in=material_ids,
                deleted_at__isnull=True,
            ).all()
            existing_by_material = {
                int(row.material_id): row for row in existing_rows if row.material_id is not None
            }
            preview_items = await self._build_pull_preview_items_for_customer_material(
                tenant_id,
                registration,
                lines,
                existing_by_material=existing_by_material,
                policy_cache=policy_cache,
            )
            enriched_preview = _apply_material_snapshots_to_preview_items(
                preview_items, material_snaps
            )
            allowed, reason = self._derive_iqc_pull_capability(
                source_allowed=_customer_material_allows_iqc_creation(registration) and bool(lines),
                preview_items=enriched_preview,
                not_allowed_reason="incoming_inspection.pull_from_customer_material_registration.not_allowed",
                no_lines_reason="incoming_inspection.pull_from_customer_material_registration.no_lines",
                already_pulled_reason="incoming_inspection.pull_from_customer_material_registration.already_pulled",
            )
            pull_summary = _summarize_pull_preview_items(enriched_preview)
            reg_code = getattr(registration, "registration_code", None) or rid
            customer_name = str(getattr(registration, "customer_name", "") or "").strip()
            if not customer_name and registration.customer_id:
                customer_name = customer_name_map.get(int(registration.customer_id), "")
            label = f"{reg_code}"
            if customer_name:
                label = f"{label} - {customer_name}"
            total_qty = float(getattr(registration, "total_quantity", 0) or 0)
            if total_qty <= 0:
                total_qty = sum(float(getattr(i, "quantity", 0) or 0) for i in lines)
            rows.append(
                {
                    "id": rid,
                    "code": label,
                    "registration_code": reg_code,
                    "customer_name": customer_name or None,
                    "status": getattr(registration, "status", None),
                    "sales_order_code": getattr(registration, "sales_order_code", None),
                    "work_order_code": getattr(registration, "work_order_code", None),
                    "registration_date": getattr(registration, "registration_date", None),
                    "total_quantity": total_qty if total_qty > 0 else None,
                    "updated_at": getattr(registration, "updated_at", None),
                    **pull_summary,
                    "capabilities": {
                        "pull_incoming_inspection": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

    async def create_inspection_from_purchase_receipt(
        self,
        tenant_id: int,
        purchase_receipt_id: int,
        created_by: int,
        *,
        selected_item_ids: Optional[List[int]] = None,
    ) -> List[IncomingInspectionResponse]:
        """
        从采购入库单创建来料检验单
        
        为采购入库单的每个明细项创建一个来料检验单
        """
        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            raise BusinessLogicError("当前组织未开启来料检验，禁止从采购入库单下推来料检验")
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

        async with in_transaction():
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
            if not receipt:
                raise NotFoundError(f"采购入库单不存在: {purchase_receipt_id}")

            if not _purchase_receipt_allows_iqc_creation(receipt):
                raise BusinessLogicError("只有待入库、已入库或草稿状态的采购入库单才能创建来料检验单")

            receipt_items = await PurchaseReceiptItem.filter(
                tenant_id=tenant_id,
                receipt_id=purchase_receipt_id
            ).all()

            if not receipt_items:
                raise BusinessLogicError("采购入库单没有明细项")

            inspections = await self._ensure_missing_incoming_inspections_for_purchase_receipt(
                tenant_id=tenant_id,
                receipt=receipt,
                receipt_items=receipt_items,
                created_by=created_by,
                selected_item_ids=selected_item_ids,
            )

            if not inspections:
                raise BusinessLogicError(
                    "未生成任何来料检验单：各明细可能已有检验单，或物料质检模式为无质检（与组织 IQC 总开关、业务参数「来料检验」共同生效）"
                )

            return inspections

    async def create_inspection_from_customer_material_registration(
        self,
        tenant_id: int,
        registration_id: int,
        created_by: int,
        *,
        selected_item_ids: Optional[List[int]] = None,
    ) -> List[IncomingInspectionResponse]:
        """从代工来料单创建来料检验单"""
        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            raise BusinessLogicError("当前组织未开启来料检验，禁止从代工来料单下推来料检验")

        from apps.kuaizhizao.models.customer_material_registration import CustomerMaterialRegistration
        from apps.kuaizhizao.services.customer_material_registration_service import (
            CustomerMaterialRegistrationService,
        )

        async with in_transaction():
            registration = await CustomerMaterialRegistration.get_or_none(
                tenant_id=tenant_id, id=registration_id, deleted_at__isnull=True
            )
            if not registration:
                raise NotFoundError(f"代工来料单不存在: {registration_id}")
            if registration.status not in ("pending", "processed"):
                raise BusinessLogicError("仅待入库或已入库状态的代工来料单可创建来料检验单")

            lines = await CustomerMaterialRegistrationService()._effective_items(registration)
            if not lines:
                raise BusinessLogicError("代工来料单没有明细项")

            inspections = await self._ensure_missing_incoming_inspections_for_customer_material(
                tenant_id=tenant_id,
                registration=registration,
                registration_items=lines,
                created_by=created_by,
                selected_item_ids=selected_item_ids,
            )
            if not inspections:
                raise BusinessLogicError(
                    "未生成任何来料检验单：各明细可能已有检验单，或物料质检模式为无质检"
                )
            return inspections

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据导入来料检验单
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从uni_import组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")

        await _require_iqc_stage_enabled(tenant_id)

        # 解析表头（第一行）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射
        header_map = {
            '采购入库单号': 'purchase_receipt_code',
            '物料编码': 'material_code',
            '检验数量': 'inspection_quantity',
            '合格数量': 'qualified_quantity',
            '不合格数量': 'unqualified_quantity',
            '备注': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header in header_map:
                header_index_map[header_map[header]] = idx
        
        if 'purchase_receipt_code' not in header_index_map or 'material_code' not in header_index_map:
            raise ValidationError("导入数据必须包含'采购入库单号'和'物料编码'字段")
        
        success_count = 0
        failure_count = 0
        errors = []
        initial_review_fields = await _quality_inspection_initial_review_fields(
            tenant_id, "incoming_inspection"
        )
        
        # 从第三行开始处理数据（跳过表头和示例行）
        for row_idx, row in enumerate(data[2:], start=3):
            try:
                # 获取采购入库单
                receipt_code = str(row[header_index_map['purchase_receipt_code']]).strip()
                from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
                receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, receipt_code=receipt_code)
                if not receipt:
                    raise ValidationError(f"采购入库单不存在: {receipt_code}")
                
                # 获取物料
                material_code = str(row[header_index_map['material_code']]).strip()
                from apps.master_data.models.material import Material
                material = await Material.get_or_none(tenant_id=tenant_id, material_code=material_code)
                if not material:
                    raise ValidationError(f"物料不存在: {material_code}")
                
                # 获取采购入库单明细
                from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
                receipt_item = await PurchaseReceiptItem.get_or_none(
                    tenant_id=tenant_id,
                    receipt_id=receipt.id,
                    material_id=material.id
                )
                if not receipt_item:
                    raise ValidationError(f"采购入库单中不存在该物料: {material_code}")
                
                # 检查是否已存在检验单
                existing = await IncomingInspection.filter(
                    tenant_id=tenant_id,
                    purchase_receipt_id=receipt.id,
                    material_id=material.id
                ).first()
                
                if existing:
                    continue  # 跳过已存在的检验单

                eff_iqc, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "iqc",
                    material_id=material.id,
                )
                if eff_iqc == "none":
                    continue

                # 创建检验单
                today = today_site_str()
                code = await self.generate_code(tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}")
                
                inspection_quantity = float(row[header_index_map.get('inspection_quantity', -1)]) if header_index_map.get('inspection_quantity', -1) >= 0 and row[header_index_map.get('inspection_quantity', -1)] else receipt_item.receipt_quantity
                qualified_quantity = float(row[header_index_map.get('qualified_quantity', -1)]) if header_index_map.get('qualified_quantity', -1) >= 0 and row[header_index_map.get('qualified_quantity', -1)] else 0
                unqualified_quantity = float(row[header_index_map.get('unqualified_quantity', -1)]) if header_index_map.get('unqualified_quantity', -1) >= 0 and row[header_index_map.get('unqualified_quantity', -1)] else 0
                notes = str(row[header_index_map.get('notes', -1)]) if header_index_map.get('notes', -1) >= 0 and row[header_index_map.get('notes', -1)] else None
                
                await IncomingInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    purchase_receipt_id=receipt.id,
                    purchase_receipt_code=receipt.receipt_code,
                    supplier_id=receipt.supplier_id,
                    supplier_name=receipt.supplier_name,
                    material_id=material.id,
                    material_code=material.material_code,
                    material_name=material.material_name,
                    material_spec=material.material_spec,
                    material_unit=material.base_unit,
                    inspection_quantity=inspection_quantity,
                    qualified_quantity=qualified_quantity,
                    unqualified_quantity=unqualified_quantity,
                    inspection_result="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    quality_status="待判定" if qualified_quantity == 0 and unqualified_quantity == 0 else ("合格" if unqualified_quantity == 0 else "不合格"),
                    status="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    notes=notes,
                    created_by=created_by,
                    created_by_name=(await self.get_user_name(created_by)) if created_by else None,
                    updated_by=created_by,
                    updated_by_name=(await self.get_user_name(created_by)) if created_by else None,
                    **initial_review_fields,
                )
                success_count += 1
            except Exception as e:
                failure_count += 1
                errors.append({
                    "row": row_idx,
                    "message": str(e)
                })
        
        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出来料检验单到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        
        # 查询来料检验单
        inspections = await self.list_incoming_inspections(
            tenant_id=tenant_id,
            skip=0,
            limit=10000,
            **filters
        )
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = resolve_business_datetime().strftime('%Y%m%d_%H%M%S')
        filename = f"incoming_inspections_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '检验单号', '采购入库单号', '供应商', '物料编码', '物料名称',
                '检验数量', '合格数量', '不合格数量', '检验结果', '质量状态',
                '检验员', '检验时间', '审核人', '审核时间', '状态', '备注'
            ])
            
            # 写入数据
            for inspection in inspections:
                writer.writerow([
                    inspection.inspection_code,
                    inspection.purchase_receipt_code,
                    inspection.supplier_name,
                    inspection.material_code,
                    inspection.material_name,
                    str(inspection.inspection_quantity),
                    str(inspection.qualified_quantity),
                    str(inspection.unqualified_quantity),
                    inspection.inspection_result,
                    inspection.quality_status,
                    inspection.inspector_name or '',
                    to_api_isoformat(inspection.inspection_time) if inspection.inspection_time else '',
                    inspection.reviewer_name or '',
                    to_api_isoformat(inspection.review_time) if inspection.review_time else '',
                    inspection.status,
                    inspection.notes or '',
                ])
        
        return file_path


class ProcessInspectionService(AppBaseService[ProcessInspection]):
    """过程检验单服务"""

    def __init__(self):
        super().__init__(ProcessInspection)

    async def create_process_inspection(self, tenant_id: int, inspection_data: ProcessInspectionCreate, created_by: int) -> ProcessInspectionResponse:
        """创建过程检验单"""
        await _require_ipqc_stage_enabled(tenant_id)
        _, process_enabled = await _get_quality_policy_flags(tenant_id)
        if not process_enabled:
            raise BusinessLogicError("当前组织未开启过程检验，禁止创建过程检验单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = today_site_str()
            code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")

            create_data = inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            template = await _resolve_inspection_template_fields(
                tenant_id,
                create_data.get("material_id"),
                "ipqc",
                operation_id=create_data.get("operation_id"),
                use_quality_characteristics=True,
            )
            for k, v in template.items():
                create_data.setdefault(k, v)
            create_data.update(
                await _quality_inspection_initial_review_fields(tenant_id, "process_inspection")
            )
            await _ensure_inspection_material_unit(tenant_id, create_data)

            inspection = await ProcessInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
                **create_data
            )
            return ProcessInspectionResponse.model_validate(inspection)

    async def get_process_inspection_by_id(self, tenant_id: int, inspection_id: int) -> ProcessInspectionResponse:
        """根据ID获取过程检验单"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_process_inspection_lifecycle,
            get_document_milestones
        )

        inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"过程检验单不存在: {inspection_id}")
        
        milestones = await get_document_milestones(tenant_id, "process_inspection", inspection_id)
        resp = ProcessInspectionResponse.model_validate(inspection)
        resp = resp.model_copy(update={"lifecycle": get_process_inspection_lifecycle(inspection, milestones=milestones)})
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_quality_inspection_capabilities_on_response,
        )
        from core.services.approval.audit_record_enricher import enrich_record

        resp = enrich_quality_inspection_capabilities_on_response(inspection, resp)
        return await enrich_record(tenant_id, "process_inspection", resp)

    async def _heal_duplicate_pending_process_inspections(self, tenant_id: int) -> None:
        """合并同工单同工序的多张待检验单（列表加载时自愈）。"""
        from collections import defaultdict

        pending = await ProcessInspection.filter(
            tenant_id=tenant_id,
            status="待检验",
            deleted_at__isnull=True,
        ).all()
        groups: Dict[Tuple[int, int], List[Any]] = defaultdict(list)
        for row in pending:
            groups[(int(row.work_order_id), int(row.operation_id))].append(row)
        for rows in groups.values():
            if len(rows) > 1:
                await self._dedupe_pending_process_inspections(rows)

    async def list_process_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> Dict[str, Any]:
        """获取过程检验单列表"""
        await self._heal_duplicate_pending_process_inspections(tenant_id)
        query = ProcessInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])
        if filters.get('operation_id'):
            query = query.filter(operation_id=filters['operation_id'])
        if filters.get('id') is not None:
            try:
                query = query.filter(id=int(filters['id']))
            except (TypeError, ValueError):
                query = query.filter(id=-1)
        if filters.get("scoped_work_order_ids") is not None:
            query = query.filter(work_order_id__in=filters["scoped_work_order_ids"])
        query = _apply_quality_inspection_list_filters(
            query,
            filters,
            keyword_fields=[
                "inspection_code",
                "work_order_code",
                "operation_name",
                "material_code",
                "material_name",
            ],
        )

        total = await query.count()
        order_clause = _resolve_quality_list_order_by(
            filters.get("order_by"),
            PROCESS_INSPECTION_SORTABLE_FIELDS,
            "-created_at",
        )
        inspections = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_quality_inspection_list_capabilities,
        )
        from core.services.approval.audit_record_enricher import enrich_data_payload

        inspection_models = list(inspections)
        rows = enrich_quality_inspection_list_capabilities(
            inspection_models,
            [ProcessInspectionListResponse.model_validate(i) for i in inspection_models],
        )
        return await enrich_data_payload(tenant_id, "process_inspection", {
            "data": [r.model_dump() for r in rows],
            "total": total,
            "success": True,
        })

    async def delete_process_inspection(
        self, tenant_id: int, inspection_id: int, deleted_by: int
    ) -> None:
        """软删除过程检验单（仅待检验）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            row = await ProcessInspection.get_or_none(
                tenant_id=tenant_id, id=inspection_id, deleted_at__isnull=True
            )
            if not row:
                raise NotFoundError(f"过程检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(row, "delete")
            _ = deleted_by
            row.deleted_at = resolve_business_datetime()
            await row.save(update_fields=["deleted_at"])

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> ProcessInspectionResponse:
        """执行过程检验"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            inspection_model = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection_model:
                raise NotFoundError(f"过程检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(inspection_model, "conduct")

            inspector_id = await _resolve_conduct_inspector_id(tenant_id, inspection_data, inspected_by)
            inspector_name = await self.get_user_name(inspector_id)
            operator_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity, unqualified_quantity = assert_inspection_quantities_balanced(
                inspection_data.get("qualified_quantity", 0),
                inspection_data.get("unqualified_quantity", 0),
                inspection_model.inspection_quantity,
            )
            _assert_unqualified_qty_when_steps_fail(
                inspection_model, "quality_characteristics", inspection_data, unqualified_quantity
            )

            quality_status = "合格" if unqualified_quantity == Decimal("0") else "不合格"

            conduct_payload = _apply_template_conduct_to_payload(
                inspection_model, "quality_characteristics", inspection_data
            )

            conduct_update: Dict[str, Any] = {
                "qualified_quantity": qualified_quantity,
                "unqualified_quantity": unqualified_quantity,
                "inspection_result": "已检验",
                "quality_status": quality_status,
                "inspector_id": inspector_id,
                "inspector_name": inspector_name,
                "updated_by": inspected_by,
                "updated_by_name": operator_name,
                **conduct_payload,
            }
            conduct_update.update(
                await _quality_inspection_conduct_finalize_fields(
                    tenant_id,
                    "process_inspection",
                    quality_status=quality_status,
                    inspected_by=inspector_id,
                    inspector_name=inspector_name,
                )
            )
            conduct_update["inspection_time"] = resolve_business_datetime()
            if "review_time" in conduct_update and conduct_update["review_time"] is not None:
                conduct_update["review_time"] = resolve_business_datetime()
            await ProcessInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                **conduct_update
            )

            updated_inspection = await self.get_process_inspection_by_id(tenant_id, inspection_id)
            
            if updated_inspection.quality_status == "不合格" and updated_inspection.unqualified_quantity > 0:
                await _maybe_create_quality_exception_from_inspection(
                    tenant_id=tenant_id,
                    source_type="process_inspection",
                    source_id=inspection_id,
                    inspected_by=inspected_by,
                    problem_description=inspection_data.get("nonconformance_reason")
                    or f"过程检验不合格：{updated_inspection.inspection_code}",
                )

            await _maybe_record_spc_samples_from_inspection(
                tenant_id=tenant_id,
                inspection=updated_inspection,
                template_attr="quality_characteristics",
                inspection_data=inspection_data,
                user_id=inspected_by,
                source_type="process_inspection",
            )

            # 方案质检完成后，用检验不合格回写工单工序质量口径（不合格不占可报）
            if inspection_model.work_order_id:
                await self._reconcile_operation_quality_after_inspection(
                    tenant_id=tenant_id,
                    work_order_id=int(inspection_model.work_order_id),
                    operation_id=int(inspection_model.operation_id),
                )
                from apps.kuaizhizao.services.work_order_service import WorkOrderService

                await WorkOrderService().refresh_work_order_operation_transfer_state(
                    tenant_id=tenant_id,
                    work_order_id=int(inspection_model.work_order_id),
                )
            
            return updated_inspection

    async def approve_inspection(
        self, tenant_id: int, inspection_id: int, approved_by: int, rejection_reason: Optional[str] = None
    ) -> ProcessInspectionResponse:
        """审核工序检验单"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection:
                raise NotFoundError(f"过程检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(
                inspection,
                "reject" if rejection_reason else "approve",
            )

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await ProcessInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=resolve_business_datetime(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by,
                updated_by_name=approver_name,
            )

            if not rejection_reason and inspection.work_order_id:
                from apps.kuaizhizao.services.work_order_service import WorkOrderService

                await WorkOrderService().refresh_work_order_operation_transfer_state(
                    tenant_id=tenant_id,
                    work_order_id=int(inspection.work_order_id),
                )

            return await self.get_process_inspection_by_id(tenant_id, inspection_id)

    async def revoke_approval(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> ProcessInspectionResponse:
        """撤销工序检验审核（已审核 → 已检验；人工审→待审，关审→清空）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )
        from core.services.approval.audit_transition import resolve_revoke_landing_phase

        async with in_transaction():
            inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection:
                raise NotFoundError(f"过程检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(inspection, "revoke_approval")

            audit_required = await _is_quality_audit_required(tenant_id, "process_inspection")
            landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
            updater_name = await self.get_user_name(user_id)

            await ProcessInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                status="已检验",
                review_status="待审核" if landing == "pending" else "",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=user_id,
                updated_by_name=updater_name,
            )

            if inspection.work_order_id:
                from apps.kuaizhizao.services.work_order_service import WorkOrderService

                await WorkOrderService().refresh_work_order_operation_transfer_state(
                    tenant_id=tenant_id,
                    work_order_id=int(inspection.work_order_id),
                )

            return await self.get_process_inspection_by_id(tenant_id, inspection_id)

    async def revoke_conduct(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> ProcessInspectionResponse:
        """撤回过程检验（已检验/已驳回 → 待检验，清空检验结果）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )
        from apps.kuaizhizao.services.quality_inspection_lifecycle import (
            assert_revoke_conduct_no_downstream,
            build_quality_inspection_revoke_conduct_fields,
        )

        async with in_transaction():
            inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection:
                raise NotFoundError(f"过程检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(inspection, "revoke_conduct")
            await assert_revoke_conduct_no_downstream(
                tenant_id,
                entity_type="process_inspection",
                source_id=inspection_id,
            )
            updater_name = await self.get_user_name(user_id)
            await ProcessInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                **build_quality_inspection_revoke_conduct_fields(
                    entity_type="process_inspection",
                    updated_by=user_id,
                    updated_by_name=updater_name,
                )
            )
            if inspection.work_order_id:
                from apps.kuaizhizao.services.work_order_service import WorkOrderService

                await WorkOrderService().refresh_work_order_operation_transfer_state(
                    tenant_id=tenant_id,
                    work_order_id=int(inspection.work_order_id),
                )
            return await self.get_process_inspection_by_id(tenant_id, inspection_id)

    async def _reconcile_operation_quality_after_inspection(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
    ) -> None:
        """
        方案质检落单后回写工单工序合格/不合格。

        口径：检验不合格从已完成中拆出；其余（含已报未检）仍计合格。
        completed_quantity 不变，以便按「完成 − 不合格」释放可报数量。
        """
        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.kuaizhizao.services.inspection_policy_service import resolve_inspection_policy
        from apps.kuaizhizao.services.operation_transfer_service import (
            sum_process_inspection_quality_quantities,
        )

        mode, _, _ = await resolve_inspection_policy(
            tenant_id, "ipqc", operation_id=operation_id
        )
        if mode != "plan":
            return

        insp_rows = await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=operation_id,
            deleted_at__isnull=True,
        ).all()
        insp_q, insp_u = sum_process_inspection_quality_quantities(insp_rows)
        if insp_q + insp_u <= 0:
            return

        woo = await WorkOrderOperation.get_or_none(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=operation_id,
            deleted_at__isnull=True,
        )
        if not woo:
            return

        completed = Decimal(str(woo.completed_quantity or 0))
        reconciled_qualified = completed - insp_u
        if reconciled_qualified < 0:
            reconciled_qualified = Decimal("0")

        await WorkOrderOperation.filter(tenant_id=tenant_id, id=woo.id).update(
            qualified_quantity=reconciled_qualified,
            unqualified_quantity=insp_u,
            updated_at=resolve_business_datetime(),
        )
        logger.info(
            "过程质检已回写工序质量口径: 工单%s 工序%s 合格%s 不合格%s",
            work_order_id,
            operation_id,
            reconciled_qualified,
            insp_u,
        )

    @staticmethod
    async def _dedupe_pending_process_inspections(pending_rows: List[Any]) -> Any:
        """同工单工序多张待检验时保留一张（优先有报工关联、再取最新），其余软删。"""
        if not pending_rows:
            raise ValidationError("待去重的过程检验单列表为空")
        if len(pending_rows) == 1:
            return pending_rows[0]
        keep = max(
            pending_rows,
            key=lambda r: (
                1 if getattr(r, "reporting_record_id", None) else 0,
                int(getattr(r, "id", 0) or 0),
            ),
        )
        now = resolve_business_datetime()
        for row in pending_rows:
            if int(row.id) == int(keep.id):
                continue
            row.deleted_at = now
            await row.save(update_fields=["deleted_at"])
            logger.info(
                "过程检验重复待检单已软删: keep=%s removed=%s wo=%s op=%s",
                keep.inspection_code,
                row.inspection_code,
                row.work_order_id,
                row.operation_id,
            )
        return keep

    async def dedupe_pending_process_inspections_for_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_ids: List[int],
    ) -> Optional[ProcessInspectionResponse]:
        """清理指定工序上重复的待检验单；若有则返回保留的一张。"""
        ids = [int(x) for x in operation_ids if x is not None]
        if not ids:
            return None
        async with in_transaction():
            pending_rows = (
                await ProcessInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    operation_id__in=ids,
                    status="待检验",
                    deleted_at__isnull=True,
                )
                .select_for_update()
                .order_by("id")
                .all()
            )
            if not pending_rows:
                return None
            keep = await self._dedupe_pending_process_inspections(pending_rows)
            return ProcessInspectionResponse.model_validate(keep)

    async def create_inspection_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        created_by: int,
        reporting_record_id: Optional[int] = None,
    ) -> ProcessInspectionResponse:
        """
        从工单和工序创建过程检验单
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            operation_id: 工序ID
            created_by: 创建人ID
            
        Returns:
            ProcessInspectionResponse: 创建的过程检验单
        """
        await _require_ipqc_stage_enabled(tenant_id)
        _, process_enabled = await _get_quality_policy_flags(tenant_id)
        if not process_enabled:
            raise BusinessLogicError("当前组织未开启过程检验，禁止从工单下推过程检验")
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.master_data.models.material import Material
        from apps.master_data.models.process import Operation as MasterOperation

        async with in_transaction():
            # 获取工单
            work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
            )
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")

            # operation_id 与报工一致：主数据工序 ID；兼容传入工单工序行主键
            woo = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
                deleted_at__isnull=True,
            )
            master_op_id = operation_id
            if not woo:
                woo = await WorkOrderOperation.get_or_none(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    id=operation_id,
                    deleted_at__isnull=True,
                )
                if woo:
                    master_op_id = int(woo.operation_id)
            if not woo:
                raise NotFoundError(
                    f"工单工序不存在: 工单ID={work_order_id}, 工序ID={operation_id}"
                )

            master_op = await MasterOperation.get_or_none(
                tenant_id=tenant_id, id=master_op_id, deleted_at__isnull=True
            )
            wf = _work_order_product_fields(work_order)
            mid = wf.get("material_id")
            mat = None
            if mid:
                mat = await Material.get_or_none(
                    tenant_id=tenant_id, id=mid, deleted_at__isnull=True
                )

            eff, _, _reason = await resolve_inspection_policy(
                tenant_id,
                "ipqc",
                material_id=mid,
                operation_id=master_op_id,
            )
            if eff == "none":
                raise BusinessLogicError(
                    "当前工单工序未配置过程检验（工序/成品质检模式均为无质检），无需下推过程检验单"
                )
            if not wf.get("material_id"):
                raise BusinessLogicError(
                    f"工单 {work_order.code} 未关联生产物料，无法创建过程检验单"
                )
            if not (wf.get("material_code") and wf.get("material_name")):
                raise BusinessLogicError(
                    f"工单 {work_order.code} 物料编码/名称缺失，无法创建过程检验单"
                )

            if reporting_record_id:
                existing_by_report = await ProcessInspection.filter(
                    tenant_id=tenant_id,
                    reporting_record_id=reporting_record_id,
                    deleted_at__isnull=True,
                ).select_for_update().first()
                if existing_by_report:
                    return ProcessInspectionResponse.model_validate(existing_by_report)

            # 同工单同工序仅保留一张待检验单（兼容误存工单工序行 id）
            op_id_aliases = {master_op_id, int(woo.id)}
            pending_rows = (
                await ProcessInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    operation_id__in=list(op_id_aliases),
                    status="待检验",
                    deleted_at__isnull=True,
                )
                .select_for_update()
                .order_by("id")
                .all()
            )
            if pending_rows:
                keep = await self._dedupe_pending_process_inspections(pending_rows)
                if reporting_record_id and not keep.reporting_record_id:
                    keep.reporting_record_id = reporting_record_id
                    await keep.save(update_fields=["reporting_record_id"])
                return ProcessInspectionResponse.model_validate(keep)

            # 创建检验单
            today = today_site_str()
            code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")
            
            # 获取报工数量作为检验数量
            from apps.kuaizhizao.models.reporting_record import ReportingRecord
            reporting = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=master_op_id
            ).order_by('-created_at').first()
            
            planned_qty = wf.get("planned_qty") or work_order.quantity
            inspection_quantity = reporting.reported_quantity if reporting else planned_qty

            template = await _resolve_inspection_template_fields(
                tenant_id,
                wf["material_id"],
                "ipqc",
                operation_id=master_op_id,
                use_quality_characteristics=True,
            )
            initial_review_fields = await _quality_inspection_initial_review_fields(
                tenant_id, "process_inspection"
            )
            material_unit = await _resolve_material_base_unit(tenant_id, wf["material_id"])
            
            inspection = await ProcessInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                reporting_record_id=reporting_record_id,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                operation_id=master_op_id,
                operation_code=woo.operation_code,
                operation_name=woo.operation_name,
                workshop_id=work_order.workshop_id,
                workshop_name=work_order.workshop_name,
                material_id=wf["material_id"],
                material_code=wf["material_code"],
                material_name=wf["material_name"],
                material_spec=wf["material_spec"],
                material_unit=material_unit,
                batch_number=wf["batch_number"],
                inspection_quantity=inspection_quantity,
                qualified_quantity=0,
                unqualified_quantity=0,
                inspection_result="待检验",
                quality_status="待判定",
                status="待检验",
                created_by=created_by,
                **template,
                **initial_review_fields,
            )
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="work_order",
                        source_id=work_order_id,
                        source_code=work_order.code,
                        source_name=work_order.name,
                        target_type="process_inspection",
                        target_id=inspection.id,
                        target_code=inspection.inspection_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="工单创建过程检验单",
                    ),
                    created_by=created_by,
                )
            except Exception as e:
                logger.warning("建立工单→过程检验 单据关联失败: %s", e)
            return ProcessInspectionResponse.model_validate(inspection)

    _PI_PULL_ELIGIBLE_WO_STATUSES = frozenset({"released", "in_progress", "RELEASED", "IN_PROGRESS"})

    def _derive_pi_pull_capability(
        self,
        *,
        work_order: Any,
        preview_items: List[Dict[str, Any]],
        material_id: Optional[int],
        ipqc_required_op_count: int,
    ) -> tuple[bool, Optional[str]]:
        status = str(getattr(work_order, "status", "") or "").strip()
        if status not in self._PI_PULL_ELIGIBLE_WO_STATUSES:
            return False, "process_inspection.pull_from_work_order.not_allowed"
        if not material_id:
            return False, "process_inspection.pull_from_work_order.no_product"
        if ipqc_required_op_count == 0:
            return False, "process_inspection.pull_from_work_order.no_inspection_required"
        if not preview_items:
            return False, "process_inspection.pull_from_work_order.already_pulled"
        pushable = any(float(row.get("max_push_quantity") or 0) > 0 for row in preview_items)
        if not pushable:
            return False, "process_inspection.pull_from_work_order.already_pulled"
        return True, None

    async def _load_reporting_qty_by_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_ids: List[int],
    ) -> Dict[int, float]:
        from apps.kuaizhizao.models.reporting_record import ReportingRecord

        if not operation_ids:
            return {}
        rows = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id__in=operation_ids,
        ).order_by("-created_at")
        qty_by_op: Dict[int, float] = {}
        for row in rows:
            op_id = int(row.operation_id) if row.operation_id is not None else None
            if op_id is None or op_id in qty_by_op:
                continue
            qty_by_op[op_id] = float(row.reported_quantity or 0)
        return qty_by_op

    async def _build_pull_preview_items_for_work_order_ipqc(
        self,
        tenant_id: int,
        work_order: Any,
        *,
        operations: Optional[List[Any]] = None,
        pending_by_operation: Optional[Dict[int, Any]] = None,
        reporting_qty_by_operation: Optional[Dict[int, float]] = None,
        policy_cache: Optional[Dict[tuple, str]] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

        work_order_id = int(work_order.id)
        wf = _work_order_product_fields(work_order)
        mid = wf.get("material_id")
        planned_qty = float(wf.get("planned_qty") or getattr(work_order, "quantity", 0) or 0)
        if planned_qty <= 0:
            planned_qty = float(getattr(work_order, "quantity", 0) or 0)

        if operations is None:
            operations = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True,
            ).order_by("sequence", "id")

        op_ids = [int(op.operation_id) for op in operations if op.operation_id]
        if reporting_qty_by_operation is None:
            reporting_qty_by_operation = await self._load_reporting_qty_by_operation(
                tenant_id, work_order_id, op_ids
            )
        if pending_by_operation is None:
            pending_rows = await ProcessInspection.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                status="待检验",
                deleted_at__isnull=True,
            ).all()
            pending_by_operation = {
                int(row.operation_id): row
                for row in pending_rows
                if row.operation_id is not None
            }

        cache: Dict[tuple, str] = policy_cache if policy_cache is not None else {}
        preview_items: List[Dict[str, Any]] = []
        ipqc_required_op_count = 0

        for woo in operations:
            master_op_id = getattr(woo, "operation_id", None)
            if not master_op_id:
                continue
            master_op_id = int(master_op_id)
            cache_key = (int(mid) if mid else 0, master_op_id)
            if cache_key not in cache:
                eff, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "ipqc",
                    material_id=mid,
                    operation_id=master_op_id,
                )
                cache[cache_key] = eff
            if cache[cache_key] == "none":
                continue
            ipqc_required_op_count += 1

            qty = reporting_qty_by_operation.get(master_op_id, planned_qty)
            if qty <= 0:
                continue

            existing = pending_by_operation.get(master_op_id)
            pushed = float(existing.inspection_quantity or 0) if existing else 0.0
            max_push = qty if not existing else 0.0
            preview_items.append(
                {
                    "item_id": master_op_id,
                    "operation_id": master_op_id,
                    "operation_code": str(getattr(woo, "operation_code", "") or ""),
                    "operation_name": str(getattr(woo, "operation_name", "") or ""),
                    "material_id": int(mid) if mid else None,
                    "material_code": str(wf.get("material_code") or ""),
                    "material_name": str(wf.get("material_name") or ""),
                    "quantity": qty,
                    "pushed_quantity": pushed,
                    "max_push_quantity": max_push,
                }
            )
        return preview_items, ipqc_required_op_count

    async def preview_pull_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.work_order import WorkOrder

        await _require_ipqc_stage_enabled(tenant_id)
        _, process_enabled = await _get_quality_policy_flags(tenant_id)
        if not process_enabled:
            raise BusinessLogicError("当前组织未开启过程检验，禁止从工单加载过程检验")

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        preview_items, ipqc_required_op_count = await self._build_pull_preview_items_for_work_order_ipqc(
            tenant_id, work_order
        )
        wf = _work_order_product_fields(work_order)
        allowed, reason = self._derive_pi_pull_capability(
            work_order=work_order,
            preview_items=preview_items,
            material_id=wf.get("material_id"),
            ipqc_required_op_count=ipqc_required_op_count,
        )
        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        wo_code = str(work_order.code or work_order_id)
        return {
            "target_type": "process_inspection",
            "source_id": work_order_id,
            "source_code": wo_code,
            "summary": (
                f"将从工单 {wo_code} 创建过程检验（{pushable_count}/{len(preview_items)} 条工序可加载）"
                if preview_items and allowed
                else f"工单 {wo_code} 当前不可加载过程检验"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "请勾选可加载工序后确认；删除待检验单后，可加载数量自动回退。",
        }

    async def list_work_order_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

        try:
            await _require_ipqc_stage_enabled(tenant_id)
            _, process_enabled = await _get_quality_policy_flags(tenant_id)
            if not process_enabled:
                return {"data": [], "total": 0, "success": True}
        except BusinessLogicError:
            return {"data": [], "total": 0, "success": True}

        query = WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=list(self._PI_PULL_ELIGIBLE_WO_STATUSES),
            deleted_at__isnull=True,
        )
        wo_code = str(code or "").strip()
        kw = str(keyword or "").strip()
        if wo_code:
            query = query.filter(code__icontains=wo_code)
        elif kw:
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        work_orders = await query.offset(skip).limit(limit).order_by("-created_at")
        wo_ids = [int(wo.id) for wo in work_orders]
        if not wo_ids:
            return {"data": [], "total": total, "success": True}

        all_operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            deleted_at__isnull=True,
        ).order_by("sequence", "id")
        ops_by_wo: Dict[int, List[Any]] = {}
        for op in all_operations:
            ops_by_wo.setdefault(int(op.work_order_id), []).append(op)

        pending_rows = await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            status="待检验",
            deleted_at__isnull=True,
        ).all()
        pending_by_wo_op: Dict[int, Dict[int, Any]] = {}
        for row in pending_rows:
            if row.work_order_id is None or row.operation_id is None:
                continue
            pending_by_wo_op.setdefault(int(row.work_order_id), {})[int(row.operation_id)] = row

        wo_material_ids = [
            int(_work_order_product_fields(wo)["material_id"])
            for wo in work_orders
            if _work_order_product_fields(wo).get("material_id")
        ]
        material_snaps = await _load_material_snapshot_map(tenant_id, wo_material_ids)

        policy_cache: Dict[tuple, str] = {}
        rows: List[Dict[str, Any]] = []
        for work_order in work_orders:
            wid = int(work_order.id)
            wf = _work_order_product_fields(work_order)
            product_display = _resolve_work_order_pull_product_display(
                work_order, wf, material_snaps
            )
            op_ids = [
                int(op.operation_id) for op in ops_by_wo.get(wid, []) if op.operation_id
            ]
            reporting_qty_by_operation = await self._load_reporting_qty_by_operation(
                tenant_id, wid, op_ids
            )
            preview_items, ipqc_required_op_count = await self._build_pull_preview_items_for_work_order_ipqc(
                tenant_id,
                work_order,
                operations=ops_by_wo.get(wid, []),
                pending_by_operation=pending_by_wo_op.get(wid, {}),
                reporting_qty_by_operation=reporting_qty_by_operation,
                policy_cache=policy_cache,
            )
            allowed, reason = self._derive_pi_pull_capability(
                work_order=work_order,
                preview_items=preview_items,
                material_id=wf.get("material_id"),
                ipqc_required_op_count=ipqc_required_op_count,
            )
            pull_summary = _summarize_pull_preview_items(preview_items)
            code = str(work_order.code or wid)
            name = str(product_display.get("product_name") or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": wid,
                    "code": label,
                    "work_order_code": code,
                    "product_name": product_display.get("product_name"),
                    "material_code": product_display.get("material_code"),
                    "status": getattr(work_order, "status", None),
                    "sales_order_code": getattr(work_order, "sales_order_code", None),
                    "planned_quantity": wf.get("planned_qty"),
                    "completed_quantity": getattr(work_order, "completed_quantity", None),
                    "updated_at": getattr(work_order, "updated_at", None),
                    **pull_summary,
                    "capabilities": {
                        "pull_process_inspection": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从二维数组数据导入过程检验单"""
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        header_map = {
            '工单编码': 'work_order_code',
            '工序编码': 'operation_code',
            '检验数量': 'inspection_quantity',
            '合格数量': 'qualified_quantity',
            '不合格数量': 'unqualified_quantity',
            '备注': 'notes',
        }
        
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header in header_map:
                header_index_map[header_map[header]] = idx
        
        if 'work_order_code' not in header_index_map or 'operation_code' not in header_index_map:
            raise ValidationError("导入数据必须包含'工单编码'和'工序编码'字段")

        await _require_ipqc_stage_enabled(tenant_id)

        success_count = 0
        failure_count = 0
        errors = []
        initial_review_fields = await _quality_inspection_initial_review_fields(
            tenant_id, "process_inspection"
        )

        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.master_data.models.material import Material
        from apps.master_data.models.process import Operation as MasterOperation

        for row_idx, row in enumerate(data[2:], start=3):
            try:
                work_order_code = str(row[header_index_map['work_order_code']]).strip()
                work_order = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, code=work_order_code, deleted_at__isnull=True
                )
                if not work_order:
                    raise ValidationError(f"工单不存在: {work_order_code}")

                operation_code = str(row[header_index_map['operation_code']]).strip()
                woo = await WorkOrderOperation.get_or_none(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    operation_code=operation_code,
                    deleted_at__isnull=True,
                )
                if not woo:
                    raise ValidationError(f"工单上不存在工序编码: {operation_code}")

                master_op_id = int(woo.operation_id)
                master_op = await MasterOperation.get_or_none(
                    tenant_id=tenant_id, id=master_op_id, deleted_at__isnull=True
                )
                wf = _work_order_product_fields(work_order)
                mid = wf.get("material_id")
                mat = None
                if mid:
                    mat = await Material.get_or_none(
                        tenant_id=tenant_id, id=mid, deleted_at__isnull=True
                    )

                eff, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "ipqc",
                    material_id=mid,
                    operation_id=master_op_id,
                )
                if eff == "none":
                    continue

                existing = await ProcessInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    operation_id=master_op_id,
                ).first()

                if existing:
                    continue

                today = today_site_str()
                code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")

                base_qty = wf.get("planned_qty") or work_order.quantity
                inspection_quantity = (
                    float(row[header_index_map.get('inspection_quantity', -1)])
                    if header_index_map.get('inspection_quantity', -1) >= 0
                    and row[header_index_map.get('inspection_quantity', -1)]
                    else base_qty
                )
                qualified_quantity = float(row[header_index_map.get('qualified_quantity', -1)]) if header_index_map.get('qualified_quantity', -1) >= 0 and row[header_index_map.get('qualified_quantity', -1)] else 0
                unqualified_quantity = float(row[header_index_map.get('unqualified_quantity', -1)]) if header_index_map.get('unqualified_quantity', -1) >= 0 and row[header_index_map.get('unqualified_quantity', -1)] else 0
                notes = str(row[header_index_map.get('notes', -1)]) if header_index_map.get('notes', -1) >= 0 and row[header_index_map.get('notes', -1)] else None

                await ProcessInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    work_order_id=work_order.id,
                    work_order_code=work_order.code,
                    operation_id=master_op_id,
                    operation_code=woo.operation_code,
                    operation_name=woo.operation_name,
                    workshop_id=work_order.workshop_id,
                    workshop_name=work_order.workshop_name,
                    material_id=wf["material_id"],
                    material_code=wf["material_code"],
                    material_name=wf["material_name"],
                    material_spec=wf["material_spec"],
                    material_unit=(getattr(mat, "base_unit", None) or "个") if mat else await _resolve_material_base_unit(tenant_id, wf["material_id"]),
                    batch_number=wf["batch_number"],
                    inspection_quantity=inspection_quantity,
                    qualified_quantity=qualified_quantity,
                    unqualified_quantity=unqualified_quantity,
                    inspection_result="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    quality_status="待判定" if qualified_quantity == 0 and unqualified_quantity == 0 else ("合格" if unqualified_quantity == 0 else "不合格"),
                    status="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    notes=notes,
                    created_by=created_by,
                    created_by_name=(await self.get_user_name(created_by)) if created_by else None,
                    updated_by=created_by,
                    updated_by_name=(await self.get_user_name(created_by)) if created_by else None,
                    **initial_review_fields,
                )
                success_count += 1
            except Exception as e:
                failure_count += 1
                errors.append({"row": row_idx, "message": str(e)})

        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """导出过程检验单到Excel文件"""
        import csv
        import os
        import tempfile
        
        inspections = await self.list_process_inspections(
            tenant_id=tenant_id,
            skip=0,
            limit=10000,
            **filters
        )
        
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp = resolve_business_datetime().strftime('%Y%m%d_%H%M%S')
        filename = f"process_inspections_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '检验单号', '工单编码', '工序名称', '物料编码', '物料名称',
                '检验数量', '合格数量', '不合格数量', '检验结果', '质量状态',
                '检验员', '检验时间', '状态', '备注'
            ])
            
            for inspection in inspections:
                writer.writerow([
                    inspection.inspection_code,
                    inspection.work_order_code,
                    inspection.operation_name,
                    inspection.material_code,
                    inspection.material_name,
                    str(inspection.inspection_quantity),
                    str(inspection.qualified_quantity),
                    str(inspection.unqualified_quantity),
                    inspection.inspection_result,
                    inspection.quality_status,
                    inspection.inspector_name or '',
                    to_api_isoformat(inspection.inspection_time) if inspection.inspection_time else '',
                    inspection.status,
                    inspection.notes or '',
                ])
        
        return file_path


class FinishedGoodsInspectionService(AppBaseService[FinishedGoodsInspection]):
    """成品检验单服务"""

    def __init__(self):
        super().__init__(FinishedGoodsInspection)

    async def _pushed_rework_qty_by_inspection_ids(
        self,
        tenant_id: int,
        inspection_ids: List[int],
    ) -> Dict[int, "Decimal"]:
        from decimal import Decimal
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        from apps.kuaizhizao.models.rework_order import ReworkOrder

        ids = [int(v) for v in inspection_ids if v is not None]
        if not ids:
            return {}

        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="finished_goods_inspection",
            source_id__in=ids,
            target_type="rework_order",
        ).values_list("source_id", "target_id")

        target_ids = list({int(tgt) for _, tgt in relations if tgt is not None})
        rework_qty_by_id: Dict[int, Decimal] = {}
        if target_ids:
            rows = await ReworkOrder.filter(
                tenant_id=tenant_id,
                id__in=target_ids,
                deleted_at__isnull=True,
            ).exclude(
                status__in=["cancelled", "CANCELLED", "已取消"]
            ).values_list("id", "quantity")
            rework_qty_by_id = {
                int(rid): Decimal(str(qty or 0)) for rid, qty in rows
            }

        pushed: Dict[int, Decimal] = {}
        for src_id, tgt_id in relations:
            qty = rework_qty_by_id.get(int(tgt_id), Decimal("0"))
            if qty <= 0:
                continue
            sid = int(src_id)
            pushed[sid] = pushed.get(sid, Decimal("0")) + qty
        return pushed

    async def _pushed_rework_quantity_for_inspection(
        self,
        tenant_id: int,
        inspection_id: int,
    ) -> float:
        pushed_map = await self._pushed_rework_qty_by_inspection_ids(
            tenant_id, [inspection_id]
        )
        return float(pushed_map.get(int(inspection_id), 0))

    async def preview_push_to_rework(
        self,
        tenant_id: int,
        inspection_id: int,
    ) -> dict:
        """成品检验不合格下推返工单预览（不实际创建）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            derive_quality_inspection_capabilities,
        )

        inspection = await FinishedGoodsInspection.get_or_none(
            tenant_id=tenant_id, id=inspection_id, deleted_at__isnull=True
        )
        if not inspection:
            raise NotFoundError(f"成品检验单不存在: {inspection_id}")

        pushed = await self._pushed_rework_quantity_for_inspection(tenant_id, inspection_id)
        caps = derive_quality_inspection_capabilities(
            inspection,
            supports_push_rework=True,
            pushed_rework_quantity=pushed,
        )
        push_cap = caps.push_rework
        unqualified = float(inspection.unqualified_quantity or 0)
        max_push = max(0.0, unqualified - pushed)
        preview_items: List[Dict[str, Any]] = []
        if max_push > 0:
            preview_items.append(
                {
                    "item_id": int(inspection.id),
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "material_spec": getattr(inspection, "material_spec", None),
                    "quantity": unqualified,
                    "pushed_quantity": pushed,
                    "max_push_quantity": max_push,
                }
            )

        has_blocking = not push_cap.allowed or not preview_items
        blocking_reason = push_cap.reason if not push_cap.allowed else (
            "finished_goods_inspection.push_rework.no_unqualified"
            if not preview_items
            else None
        )
        return {
            "target_type": "rework_order",
            "order_id": inspection.id,
            "order_code": inspection.inspection_code,
            "summary": (
                f"请确认将从不合格数量下推返工单（可下推 {max_push}/{unqualified}）"
                if not has_blocking
                else "当前成品检验单不可下推返工单"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "确认后将按所选数量生成返工单；删除未完成的返工单后，可下推数量自动回退。",
        }

    async def create_finished_goods_inspection(self, tenant_id: int, inspection_data: FinishedGoodsInspectionCreate, created_by: int) -> FinishedGoodsInspectionResponse:
        """创建成品检验单"""
        await _require_fqc_stage_enabled(tenant_id)
        finished_enabled = await _is_finished_inspection_enabled(tenant_id)
        if not finished_enabled:
            raise BusinessLogicError("当前组织未开启成品检验，禁止创建成品检验单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = today_site_str()
            code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")

            create_data = inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            template = await _resolve_inspection_template_fields(
                tenant_id,
                create_data.get("material_id"),
                "fqc",
            )
            for k, v in template.items():
                create_data.setdefault(k, v)
            create_data.update(
                await _quality_inspection_initial_review_fields(tenant_id, "finished_goods_inspection")
            )
            await _ensure_inspection_material_unit(tenant_id, create_data)

            inspection = await FinishedGoodsInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
                **create_data
            )
            return FinishedGoodsInspectionResponse.model_validate(inspection)

    async def get_finished_goods_inspection_by_id(self, tenant_id: int, inspection_id: int) -> FinishedGoodsInspectionResponse:
        """根据ID获取成品检验单"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_finished_goods_inspection_lifecycle,
            get_document_milestones
        )

        inspection = await FinishedGoodsInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"成品检验单不存在: {inspection_id}")
        
        milestones = await get_document_milestones(tenant_id, "finished_goods_inspection", inspection_id)
        resp = FinishedGoodsInspectionResponse.model_validate(inspection)
        resp = resp.model_copy(update={"lifecycle": get_finished_goods_inspection_lifecycle(inspection, milestones=milestones)})
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_quality_inspection_capabilities_on_response,
        )
        from core.services.approval.audit_record_enricher import enrich_record

        resp = enrich_quality_inspection_capabilities_on_response(
            inspection,
            resp,
            supports_push_rework=True,
            pushed_rework_quantity=await self._pushed_rework_quantity_for_inspection(
                tenant_id, inspection_id
            ),
            certificate_issued=bool(getattr(inspection, "certificate_issued", False)),
        )
        return await enrich_record(tenant_id, "finished_goods_inspection", resp)

    async def list_finished_goods_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> Dict[str, Any]:
        """获取成品检验单列表"""
        query = FinishedGoodsInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])
        if filters.get('source_type'):
            query = query.filter(source_type=filters['source_type'])
        if filters.get("scoped_work_order_ids") is not None:
            query = query.filter(work_order_id__in=filters["scoped_work_order_ids"])
        query = _apply_quality_inspection_list_filters(
            query,
            filters,
            keyword_fields=[
                "inspection_code",
                "work_order_code",
                "material_code",
                "material_name",
            ],
        )

        total = await query.count()
        order_clause = _resolve_quality_list_order_by(
            filters.get("order_by"),
            FINISHED_GOODS_INSPECTION_SORTABLE_FIELDS,
            "-created_at",
        )
        inspections = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_action_policy.enricher import (
            enrich_quality_inspection_list_capabilities,
        )
        from core.services.approval.audit_record_enricher import enrich_data_payload

        inspection_models = list(inspections)
        pushed_map = await self._pushed_rework_qty_by_inspection_ids(
            tenant_id,
            [int(i.id) for i in inspection_models if i.id is not None],
        )
        rows = enrich_quality_inspection_list_capabilities(
            inspection_models,
            [FinishedGoodsInspectionListResponse.model_validate(i) for i in inspection_models],
            supports_push_rework=True,
            pushed_rework_qty_by_inspection_id={
                int(k): float(v) for k, v in pushed_map.items()
            },
        )
        return await enrich_data_payload(tenant_id, "finished_goods_inspection", {
            "data": [r.model_dump() for r in rows],
            "total": total,
            "success": True,
        })

    async def delete_finished_goods_inspection(
        self, tenant_id: int, inspection_id: int, deleted_by: int
    ) -> None:
        """软删除成品检验单（仅待检验）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            row = await FinishedGoodsInspection.get_or_none(
                tenant_id=tenant_id, id=inspection_id, deleted_at__isnull=True
            )
            if not row:
                raise NotFoundError(f"成品检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(row, "delete")
            _ = deleted_by
            row.deleted_at = resolve_business_datetime()
            await row.save(update_fields=["deleted_at"])

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> FinishedGoodsInspectionResponse:
        """执行成品检验"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            inspection_model = await FinishedGoodsInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection_model:
                raise NotFoundError(f"成品检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(inspection_model, "conduct")

            inspector_id = await _resolve_conduct_inspector_id(tenant_id, inspection_data, inspected_by)
            inspector_name = await self.get_user_name(inspector_id)
            operator_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity, unqualified_quantity = assert_inspection_quantities_balanced(
                inspection_data.get("qualified_quantity", 0),
                inspection_data.get("unqualified_quantity", 0),
                inspection_model.inspection_quantity,
            )
            _assert_unqualified_qty_when_steps_fail(
                inspection_model, "other_checks", inspection_data, unqualified_quantity
            )

            quality_status = "合格" if unqualified_quantity == Decimal("0") else "不合格"

            conduct_payload = _apply_template_conduct_to_payload(
                inspection_model, "other_checks", inspection_data
            )

            conduct_update: Dict[str, Any] = {
                "qualified_quantity": qualified_quantity,
                "unqualified_quantity": unqualified_quantity,
                "inspection_result": "已检验",
                "quality_status": quality_status,
                "inspector_id": inspector_id,
                "inspector_name": inspector_name,
                "updated_by": inspected_by,
                "updated_by_name": operator_name,
                **conduct_payload,
            }
            conduct_update.update(
                await _quality_inspection_conduct_finalize_fields(
                    tenant_id,
                    "finished_goods_inspection",
                    quality_status=quality_status,
                    inspected_by=inspector_id,
                    inspector_name=inspector_name,
                )
            )
            conduct_update["inspection_time"] = resolve_business_datetime()
            if "review_time" in conduct_update and conduct_update["review_time"] is not None:
                conduct_update["review_time"] = resolve_business_datetime()
            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                **conduct_update
            )

            updated_inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

            if updated_inspection.quality_status == "不合格" and updated_inspection.unqualified_quantity > 0:
                await _maybe_create_quality_exception_from_inspection(
                    tenant_id=tenant_id,
                    source_type="finished_goods_inspection",
                    source_id=inspection_id,
                    inspected_by=inspected_by,
                    problem_description=inspection_data.get("nonconformance_reason")
                    or f"成品检验不合格：{updated_inspection.inspection_code}",
                )

            await _maybe_record_spc_samples_from_inspection(
                tenant_id=tenant_id,
                inspection=updated_inspection,
                template_attr="other_checks",
                inspection_data=inspection_data,
                user_id=inspected_by,
                source_type="finished_goods_inspection",
            )

            return updated_inspection

    async def approve_inspection(
        self, tenant_id: int, inspection_id: int, approved_by: int, rejection_reason: Optional[str] = None
    ) -> FinishedGoodsInspectionResponse:
        """审核成品检验单"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )

        async with in_transaction():
            inspection = await FinishedGoodsInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
            if not inspection:
                raise NotFoundError(f"成品检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(
                inspection,
                "reject" if rejection_reason else "approve",
            )

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=resolve_business_datetime(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by,
                updated_by_name=approver_name,
            )

            return await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

    async def revoke_approval(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> FinishedGoodsInspectionResponse:
        """撤销成品检验审核（已审核 → 已检验；人工审→待审，关审→清空）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )
        from core.services.approval.audit_transition import resolve_revoke_landing_phase

        async with in_transaction():
            inspection = await FinishedGoodsInspection.get_or_none(
                tenant_id=tenant_id, id=inspection_id
            )
            if not inspection:
                raise NotFoundError(f"成品检验单不存在: {inspection_id}")
            assert_quality_inspection_capability(inspection, "revoke_approval")

            audit_required = await _is_quality_audit_required(
                tenant_id, "finished_goods_inspection"
            )
            landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
            updater_name = await self.get_user_name(user_id)

            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                status="已检验",
                review_status="待审核" if landing == "pending" else "",
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                review_remarks=None,
                updated_by=user_id,
                updated_by_name=updater_name,
            )
            return await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

    async def revoke_conduct(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> FinishedGoodsInspectionResponse:
        """撤回成品检验（已检验/已驳回 → 待检验，清空检验结果）。"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )
        from apps.kuaizhizao.services.quality_inspection_lifecycle import (
            assert_revoke_conduct_no_downstream,
            build_quality_inspection_revoke_conduct_fields,
        )

        async with in_transaction():
            inspection = await FinishedGoodsInspection.get_or_none(
                tenant_id=tenant_id, id=inspection_id
            )
            if not inspection:
                raise NotFoundError(f"成品检验单不存在: {inspection_id}")
            pushed_rework_qty = await self._pushed_rework_quantity_for_inspection(
                tenant_id, inspection_id
            )
            assert_quality_inspection_capability(
                inspection,
                "revoke_conduct",
                supports_push_rework=True,
                pushed_rework_quantity=pushed_rework_qty,
                certificate_issued=bool(getattr(inspection, "certificate_issued", False)),
            )
            await assert_revoke_conduct_no_downstream(
                tenant_id,
                entity_type="finished_goods_inspection",
                source_id=inspection_id,
                pushed_rework_quantity=pushed_rework_qty,
                certificate_issued=bool(getattr(inspection, "certificate_issued", False)),
            )
            updater_name = await self.get_user_name(user_id)
            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                **build_quality_inspection_revoke_conduct_fields(
                    entity_type="finished_goods_inspection",
                    updated_by=user_id,
                    updated_by_name=updater_name,
                )
            )
            return await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

    async def issue_certificate(self, tenant_id: int, inspection_id: int, certificate_number: str, issued_by: int) -> FinishedGoodsInspectionResponse:
        """出具放行证书"""
        async with in_transaction():
            inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

            if inspection.quality_status != '合格':
                raise BusinessLogicError("只有合格的成品才能出具放行证书")

            if inspection.certificate_issued:
                raise BusinessLogicError("该检验单已出具放行证书")

            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                release_certificate=certificate_number,
                certificate_issued=True,
                updated_by=issued_by
            )

            # 自动推送至成品/半成品入库（待审核/待入库状态，按 BOM 子件角色分流）
            try:
                if inspection.qualified_quantity > 0:
                    from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService
                    from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
                        SemiFinishedGoodsReceiptService,
                    )
                    from apps.kuaizhizao.schemas.warehouse import (
                        FinishedGoodsReceiptCreate,
                        FinishedGoodsReceiptItemCreate,
                        SemiFinishedGoodsReceiptCreate,
                        SemiFinishedGoodsReceiptItemCreate,
                    )
                    from apps.kuaizhizao.models.work_order import WorkOrder
                    from apps.kuaizhizao.services.work_order_inbound_bom_role import (
                        is_semi_finished_product_by_bom_role,
                    )

                    wo = await WorkOrder.get_or_none(
                        tenant_id=tenant_id,
                        id=inspection.work_order_id,
                        deleted_at__isnull=True,
                    )
                    wh_id: Optional[int] = None
                    wh_name: str = ""
                    if wo:
                        resolved = await FinishedGoodsReceiptService().resolve_default_inbound_warehouse_for_work_order(
                            tenant_id=tenant_id,
                            work_order=wo,
                        )
                        if resolved:
                            wh_id, wh_name = resolved[0], resolved[1]

                    from apps.master_data.models.material import Material as _Mat

                    mat = await _Mat.get_or_none(
                        tenant_id=tenant_id, id=inspection.material_id, deleted_at__isnull=True
                    )
                    material_unit = (getattr(mat, "base_unit", None) or "个") if mat else "个"

                    use_semi = await is_semi_finished_product_by_bom_role(tenant_id, inspection.material_id)
                    if use_semi:
                        sf_svc = SemiFinishedGoodsReceiptService()
                        receipt_data = SemiFinishedGoodsReceiptCreate(
                            work_order_id=inspection.work_order_id,
                            work_order_code=inspection.work_order_code,
                            sales_order_id=inspection.sales_order_id,
                            sales_order_code=inspection.sales_order_code,
                            warehouse_id=wh_id or 0,
                            warehouse_name=wh_name or "",
                            receipt_time=resolve_business_datetime(),
                            status="待入库",
                            notes=f"由成品检验单 {inspection.inspection_code} 合格放行自动生成（半成品入库）",
                        )
                        if not wh_id:
                            logger.warning(
                                "成品检验自动生成半成品入库单跳过：未解析到默认仓库 inspection=%s",
                                inspection.inspection_code,
                            )
                        else:
                            item_data = SemiFinishedGoodsReceiptItemCreate(
                                material_id=inspection.material_id,
                                material_code=inspection.material_code,
                                material_name=inspection.material_name,
                                material_unit=material_unit,
                                receipt_quantity=inspection.qualified_quantity,
                                qualified_quantity=inspection.qualified_quantity,
                                unqualified_quantity=0,
                                batch_number=inspection.batch_number,
                                quality_inspection_id=inspection.id,
                                quality_status="合格",
                            )
                            await sf_svc.create_semi_finished_goods_receipt(
                                tenant_id=tenant_id,
                                receipt_data=receipt_data,
                                created_by=issued_by,
                                items=[item_data],
                            )
                            logger.info(
                                f"成品检验合格 -> 自动生成半成品入库单成功: {inspection.inspection_code}"
                            )
                    else:
                        wh_svc = FinishedGoodsReceiptService()
                        receipt_data = FinishedGoodsReceiptCreate(
                            work_order_id=inspection.work_order_id,
                            work_order_code=inspection.work_order_code,
                            sales_order_id=inspection.sales_order_id,
                            sales_order_code=inspection.sales_order_code,
                            warehouse_id=wh_id or 0,
                            warehouse_name=wh_name or "",
                            receipt_time=resolve_business_datetime(),
                            status="待入库",
                            notes=f"由成品检验单 {inspection.inspection_code} 合格放行自动生成",
                        )
                        if not wh_id:
                            logger.warning(
                                "成品检验自动生成成品入库单跳过：未解析到默认仓库 inspection=%s",
                                inspection.inspection_code,
                            )
                        else:
                            item_data = FinishedGoodsReceiptItemCreate(
                                material_id=inspection.material_id,
                                material_code=inspection.material_code,
                                material_name=inspection.material_name,
                                material_unit=material_unit,
                                receipt_quantity=inspection.qualified_quantity,
                                qualified_quantity=inspection.qualified_quantity,
                                unqualified_quantity=0,
                                batch_number=inspection.batch_number,
                                quality_inspection_id=inspection.id,
                                quality_status="合格",
                            )
                            await wh_svc.create_finished_goods_receipt(
                                tenant_id=tenant_id,
                                receipt_data=receipt_data,
                                created_by=issued_by,
                                items=[item_data],
                            )
                            logger.info(
                                f"成品检验合格 -> 自动生成成品入库单成功: {inspection.inspection_code}"
                            )
            except Exception as e:
                logger.warning(f"成品检验合格 -> 自动生成成品入库单失败: {e}")

            updated_inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

    async def push_to_rework(
        self,
        tenant_id: int,
        inspection_id: int,
        created_by: int,
        *,
        quantity: Optional[float] = None,
    ) -> dict:
        """成品检验不合格 -> 按可下推数量生成返工单"""
        from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
            assert_quality_inspection_capability,
        )
        from decimal import Decimal

        async with in_transaction():
            inspection_model = await FinishedGoodsInspection.get_or_none(
                tenant_id=tenant_id, id=inspection_id, deleted_at__isnull=True
            )
            if not inspection_model:
                raise NotFoundError(f"成品检验单不存在: {inspection_id}")

            pushed = await self._pushed_rework_quantity_for_inspection(tenant_id, inspection_id)
            assert_quality_inspection_capability(
                inspection_model,
                "push_rework",
                supports_push_rework=True,
                pushed_rework_quantity=pushed,
            )

            unqualified = Decimal(str(inspection_model.unqualified_quantity or 0))
            max_push = unqualified - Decimal(str(pushed))
            if max_push <= 0:
                raise BusinessLogicError("不合格数量已全部下推返工单")

            if quantity is None:
                push_qty = max_push
            else:
                push_qty = Decimal(str(quantity))
            if push_qty <= 0:
                raise BusinessLogicError("下推返工数量必须大于 0")
            if push_qty > max_push:
                raise BusinessLogicError(
                    f"下推返工数量 {push_qty} 超过可下推数量 {max_push}"
                )

            inspection = inspection_model

            from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
            from apps.kuaizhizao.schemas.rework_order import ReworkOrderCreate
            
            rework_svc = ReworkOrderService()
            
            rework_data = ReworkOrderCreate(
                original_work_order_id=inspection.work_order_id,
                original_work_order_uuid=None, 
                product_id=inspection.material_id,
                product_code=inspection.material_code,
                product_name=inspection.material_name,
                quantity=float(push_qty),
                rework_reason=inspection.nonconformance_reason or "质量检验不合格",
                rework_type="返工",
                routing_mode="DYNAMIC",
                verification_required=True,
                source_inspection_id=inspection_id,
                remarks=f"由成品检验单 {inspection.inspection_code} 不合格项自动生成"
            )
            
            rework_order = await rework_svc.create_rework_order(
                tenant_id=tenant_id,
                rework_order_data=rework_data,
                created_by=created_by
            )
            
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            
            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="finished_goods_inspection",
                    source_id=inspection_id,
                    source_code=inspection.inspection_code,
                    source_name=None,
                    target_type="rework_order",
                    target_id=rework_order.id,
                    target_code=rework_order.code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="成品检验不合格生成返工单",
                ),
                created_by=created_by,
            )

            return {"rework_order_id": rework_order.id, "rework_order_code": rework_order.code}

    async def _ensure_fqc_for_work_order_inbound_items(
        self,
        tenant_id: int,
        created_by: int,
        *,
        receipt_items: List[Any],
        work_order_id: Optional[int],
        work_order_code: Optional[str],
        allow_auto_create: bool,
    ) -> EnsureFqcForFinishedGoodsReceiptResponse:
        cfg = await get_quality_effective_config(tenant_id)
        gate_enabled = bool(cfg["gate"]["require_fqc_before_finished_goods_receipt"])
        fqc_can_create = bool(cfg["stage_enabled"]["fqc"] and cfg["module_enabled"]["finished"])

        needs_qc_mids = await _collect_fqc_required_material_ids(tenant_id, receipt_items)
        requires_fqc = bool(needs_qc_mids)

        created: List[FinishedGoodsInspectionResponse] = []
        if requires_fqc and fqc_can_create and allow_auto_create and work_order_id:
            before_ids = {
                i.id
                for i in await FinishedGoodsInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=int(work_order_id),
                    deleted_at__isnull=True,
                ).all()
            }
            insp = await _ensure_fqc_for_work_order(
                tenant_id=tenant_id,
                work_order_id=int(work_order_id),
                created_by=created_by,
            )
            if insp and insp.id not in before_ids:
                created.append(insp)

        inspections: List[FinishedGoodsInspection] = []
        if work_order_id:
            inspections = await FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                work_order_id=int(work_order_id),
                deleted_at__isnull=True,
            ).all()

        needs_qc_set = set(needs_qc_mids)
        passed_by_material: Dict[int, bool] = {}
        for inspection in inspections:
            if inspection.material_id and await fqc_inspection_passed_for_inbound(tenant_id, inspection):
                passed_by_material[int(inspection.material_id)] = True

        pending_inspections: List[FinishedGoodsInspectionResponse] = []
        for inspection in inspections:
            if not inspection.material_id or int(inspection.material_id) not in needs_qc_set:
                continue
            if await fqc_inspection_passed_for_inbound(tenant_id, inspection):
                continue
            pending_inspections.append(FinishedGoodsInspectionResponse.model_validate(inspection))

        all_fqc_passed = (not requires_fqc) or all(passed_by_material.get(mid) for mid in needs_qc_mids)
        can_confirm_inbound = all_fqc_passed
        message: Optional[str] = None
        if requires_fqc and not all_fqc_passed:
            if not inspections:
                message = (
                    "已启用「成品检验合格才入库」，请先创建并完成成品检验，检验合格后再确认入库"
                    if gate_enabled
                    else "请先创建并完成成品检验，检验合格后再确认入库"
                )
            elif gate_enabled:
                message = (
                    "已启用「成品检验合格才入库」，相关物料的成品检验须合格"
                    "（需审核时须审核通过）后才能确认入库"
                )
            else:
                message = "相关物料须完成成品检验并合格后方可确认入库"

        inspection_by_material: Dict[int, FinishedGoodsInspection] = {}
        for inspection in inspections:
            mid = getattr(inspection, "material_id", None)
            if mid and int(mid) not in inspection_by_material:
                inspection_by_material[int(mid)] = inspection

        plan_label_cache: Dict[int, Optional[str]] = {}
        line_material_ids: List[int] = []
        for item in receipt_items:
            mid = getattr(item, "material_id", None)
            if not mid:
                continue
            qty = getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None) or 0
            try:
                if float(qty) <= 0:
                    continue
            except (TypeError, ValueError):
                continue
            line_material_ids.append(int(mid))
        fqc_policy_cache = await build_material_policy_cache(tenant_id, line_material_ids, "fqc")

        line_summaries: List[EnsureFqcForFinishedGoodsReceiptLineSummary] = []
        for item in receipt_items:
            mid = getattr(item, "material_id", None)
            if not mid:
                continue
            qty = getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None) or 0
            try:
                qty_f = float(qty)
            except (TypeError, ValueError):
                qty_f = 0.0
            if qty_f <= 0:
                continue
            mid_int = int(mid)
            eff_mode = fqc_policy_cache.get(mid_int, ("none", None, ""))[0]
            fqc_required = eff_mode != "none"
            plan_label: Optional[str] = None
            if fqc_required:
                if mid_int not in plan_label_cache:
                    plan_label_cache[mid_int] = await resolve_fqc_plan_label_for_material(tenant_id, mid_int)
                plan_label = plan_label_cache[mid_int]

            linked = inspection_by_material.get(mid_int)
            passed = False
            if not fqc_required:
                passed = True
            elif linked:
                passed = await fqc_inspection_passed_for_inbound(tenant_id, linked)

            line_summaries.append(
                EnsureFqcForFinishedGoodsReceiptLineSummary(
                    receipt_item_id=int(item.id),
                    material_id=mid_int,
                    material_code=str(getattr(item, "material_code", "") or ""),
                    material_name=str(getattr(item, "material_name", "") or ""),
                    receipt_quantity=qty_f,
                    fqc_required=fqc_required,
                    fqc_mode=eff_mode if fqc_required else "none",
                    plan_label=plan_label,
                    inspection_id=int(linked.id) if linked else None,
                    inspection_code=getattr(linked, "inspection_code", None) if linked else None,
                    inspection_status=getattr(linked, "status", None) if linked else None,
                    quality_status=getattr(linked, "quality_status", None) if linked else None,
                    review_status=getattr(linked, "review_status", None) if linked else None,
                    passed=passed,
                    can_inbound=passed,
                )
            )

        return EnsureFqcForFinishedGoodsReceiptResponse(
            can_confirm_inbound=can_confirm_inbound,
            requires_fqc=requires_fqc,
            gate_enabled=gate_enabled,
            fqc_stage_enabled=bool(cfg["stage_enabled"]["fqc"]),
            fqc_module_enabled=bool(cfg["module_enabled"]["finished"]),
            work_order_id=int(work_order_id) if work_order_id else None,
            work_order_code=work_order_code,
            created_count=len(created),
            created_inspections=created,
            pending_inspections=pending_inspections,
            line_summaries=line_summaries,
            message=message,
        )

    async def ensure_fqc_for_finished_goods_receipt(
        self,
        tenant_id: int,
        finished_goods_receipt_id: int,
        created_by: int,
    ) -> EnsureFqcForFinishedGoodsReceiptResponse:
        """
        确认入库前：按物料 FQC 策略自动补齐缺失检验单，并评估是否允许进入确认预览。
        """
        from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
        from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem

        receipt = await FinishedGoodsReceipt.get_or_none(
            tenant_id=tenant_id,
            id=finished_goods_receipt_id,
            deleted_at__isnull=True,
        )
        if not receipt:
            raise NotFoundError(f"成品入库单不存在: {finished_goods_receipt_id}")

        receipt_items = await FinishedGoodsReceiptItem.filter(
            tenant_id=tenant_id,
            receipt_id=finished_goods_receipt_id,
        ).all()
        if not receipt_items:
            raise BusinessLogicError("成品入库单没有明细项")

        return await self._ensure_fqc_for_work_order_inbound_items(
            tenant_id=tenant_id,
            created_by=created_by,
            receipt_items=receipt_items,
            work_order_id=getattr(receipt, "work_order_id", None),
            work_order_code=getattr(receipt, "work_order_code", None),
            allow_auto_create=_finished_goods_receipt_allows_fqc_creation(receipt),
        )

    async def ensure_fqc_for_semi_finished_goods_receipt(
        self,
        tenant_id: int,
        semi_finished_goods_receipt_id: int,
        created_by: int,
    ) -> EnsureFqcForFinishedGoodsReceiptResponse:
        """确认半成品入库前：同工单 FQC 策略评估与自动补齐检验单。"""
        from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
        from apps.kuaizhizao.models.semi_finished_goods_receipt_item import SemiFinishedGoodsReceiptItem

        receipt = await SemiFinishedGoodsReceipt.get_or_none(
            tenant_id=tenant_id,
            id=semi_finished_goods_receipt_id,
            deleted_at__isnull=True,
        )
        if not receipt:
            raise NotFoundError(f"半成品入库单不存在: {semi_finished_goods_receipt_id}")

        receipt_items = await SemiFinishedGoodsReceiptItem.filter(
            tenant_id=tenant_id,
            receipt_id=semi_finished_goods_receipt_id,
        ).all()
        if not receipt_items:
            raise BusinessLogicError("半成品入库单没有明细项")

        return await self._ensure_fqc_for_work_order_inbound_items(
            tenant_id=tenant_id,
            created_by=created_by,
            receipt_items=receipt_items,
            work_order_id=getattr(receipt, "work_order_id", None),
            work_order_code=getattr(receipt, "work_order_code", None),
            allow_auto_create=_semi_finished_goods_receipt_allows_fqc_creation(receipt),
        )

    # 与成品入库对齐：工单完成后仍可补建 FQC；末道报工自动建单失败时也可手工加载
    _FGI_PULL_ELIGIBLE_WO_STATUSES = frozenset({
        "released",
        "in_progress",
        "completed",
        "RELEASED",
        "IN_PROGRESS",
        "COMPLETED",
        "已下达",
        "执行中",
        "进行中",
        "已完成",
    })

    def _derive_fgi_pull_capability(
        self,
        *,
        work_order: Any,
        preview_items: List[Dict[str, Any]],
        material_id: Optional[int],
        fqc_eff: Optional[str],
    ) -> tuple[bool, Optional[str]]:
        status = str(getattr(work_order, "status", "") or "").strip()
        if status not in self._FGI_PULL_ELIGIBLE_WO_STATUSES:
            return False, "finished_goods_inspection.pull_from_work_order.not_allowed"
        if not material_id:
            return False, "finished_goods_inspection.pull_from_work_order.no_product"
        if fqc_eff == "none":
            return False, "finished_goods_inspection.pull_from_work_order.no_inspection_required"
        if not preview_items:
            return False, "finished_goods_inspection.pull_from_work_order.already_pulled"
        pushable = any(float(row.get("max_push_quantity") or 0) > 0 for row in preview_items)
        if not pushable:
            return False, "finished_goods_inspection.pull_from_work_order.already_pulled"
        return True, None

    async def _build_pull_preview_items_for_work_order(
        self,
        tenant_id: int,
        work_order: Any,
        *,
        pending_inspection: Optional[Any] = None,
        fqc_eff: Optional[str] = None,
    ) -> tuple[List[Dict[str, Any]], Optional[str]]:
        wf = _work_order_product_fields(work_order)
        mid = wf.get("material_id")
        if fqc_eff is None and mid:
            fqc_eff, _, _ = await resolve_inspection_policy(tenant_id, "fqc", material_id=int(mid))
        elif fqc_eff is None:
            fqc_eff = "none"

        qty = float(wf.get("planned_qty") or getattr(work_order, "quantity", 0) or 0)
        if qty <= 0:
            qty = float(getattr(work_order, "quantity", 0) or 0)

        if pending_inspection is None and mid:
            # 已有任意有效成品检（含末道报工自动生成）即视为已下推，避免重复建单
            pending_inspection = await FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                work_order_id=int(work_order.id),
                deleted_at__isnull=True,
            ).exclude(status="已取消").first()

        preview_items: List[Dict[str, Any]] = []
        if fqc_eff != "none" and qty > 0 and mid:
            pushed = float(pending_inspection.inspection_quantity or 0) if pending_inspection else 0.0
            max_push = qty if not pending_inspection else 0.0
            preview_items.append(
                {
                    "item_id": int(work_order.id),
                    "material_id": int(mid),
                    "material_code": str(wf.get("material_code") or ""),
                    "material_name": str(wf.get("material_name") or ""),
                    "quantity": qty,
                    "pushed_quantity": pushed,
                    "max_push_quantity": max_push,
                }
            )
        return preview_items, fqc_eff

    async def preview_pull_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> Dict[str, Any]:
        """从工单加载创建成品检验单预览（不实际创建）。"""
        from apps.kuaizhizao.models.work_order import WorkOrder

        await _require_fqc_stage_enabled(tenant_id)
        finished_enabled = await _is_finished_inspection_enabled(tenant_id)
        if not finished_enabled:
            raise BusinessLogicError("当前组织未开启成品检验，禁止从工单加载成品检验")

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        preview_items, fqc_eff = await self._build_pull_preview_items_for_work_order(
            tenant_id, work_order
        )
        wf = _work_order_product_fields(work_order)
        allowed, reason = self._derive_fgi_pull_capability(
            work_order=work_order,
            preview_items=preview_items,
            material_id=wf.get("material_id"),
            fqc_eff=fqc_eff,
        )
        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        wo_code = str(work_order.code or work_order_id)
        return {
            "target_type": "finished_goods_inspection",
            "source_id": work_order_id,
            "source_code": wo_code,
            "summary": (
                f"将从工单 {wo_code} 创建成品检验（可加载 {pushable_count}/{len(preview_items)} 条）"
                if preview_items and allowed
                else f"工单 {wo_code} 当前不可加载成品检验"
            ),
            "items": preview_items,
            "has_blocking_issues": not allowed,
            "blocking_reason": reason,
            "tip": "确认后将按可加载数量创建成品检验单；删除待检验单后，可加载数量自动回退。",
        }

    async def list_work_order_pull_candidates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """成品检验加载：工单候选列表（含 capabilities）。"""
        from apps.kuaizhizao.models.work_order import WorkOrder

        await _require_fqc_stage_enabled(tenant_id)
        finished_enabled = await _is_finished_inspection_enabled(tenant_id)
        if not finished_enabled:
            return {"data": [], "total": 0, "success": True}

        query = WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=list(self._FGI_PULL_ELIGIBLE_WO_STATUSES),
            deleted_at__isnull=True,
        )
        wo_code = str(code or "").strip()
        kw = str(keyword or "").strip()
        if wo_code:
            query = query.filter(code__icontains=wo_code)
        elif kw:
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        work_orders = await query.offset(skip).limit(limit).order_by("-created_at")
        wo_ids = [int(wo.id) for wo in work_orders]
        if not wo_ids:
            return {"data": [], "total": total, "success": True}

        pending_rows = await FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            status="待检验",
            deleted_at__isnull=True,
        ).all()
        pending_by_wo = {int(row.work_order_id): row for row in pending_rows if row.work_order_id}

        wo_material_ids = [
            int(_work_order_product_fields(wo)["material_id"])
            for wo in work_orders
            if _work_order_product_fields(wo).get("material_id")
        ]
        material_snaps = await _load_material_snapshot_map(tenant_id, wo_material_ids)

        full_policy_cache = await build_material_policy_cache(tenant_id, wo_material_ids, "fqc")
        policy_cache: Dict[int, str] = {
            mid: row[0] for mid, row in full_policy_cache.items()
        }
        rows: List[Dict[str, Any]] = []
        for work_order in work_orders:
            wid = int(work_order.id)
            wf = _work_order_product_fields(work_order)
            product_display = _resolve_work_order_pull_product_display(
                work_order, wf, material_snaps
            )
            mid = wf.get("material_id")
            fqc_eff: Optional[str] = None
            if mid:
                fqc_eff = policy_cache.get(int(mid), "none")

            preview_items, fqc_eff = await self._build_pull_preview_items_for_work_order(
                tenant_id,
                work_order,
                pending_inspection=pending_by_wo.get(wid),
                fqc_eff=fqc_eff,
            )
            allowed, reason = self._derive_fgi_pull_capability(
                work_order=work_order,
                preview_items=preview_items,
                material_id=mid,
                fqc_eff=fqc_eff,
            )
            pull_summary = _summarize_pull_preview_items(preview_items)
            code = str(work_order.code or wid)
            name = str(product_display.get("product_name") or "").strip()
            label = f"{code} - {name}" if name else code
            rows.append(
                {
                    "id": wid,
                    "code": label,
                    "work_order_code": code,
                    "product_name": product_display.get("product_name"),
                    "material_code": product_display.get("material_code"),
                    "status": getattr(work_order, "status", None),
                    "sales_order_code": getattr(work_order, "sales_order_code", None),
                    "planned_quantity": wf.get("planned_qty"),
                    "completed_quantity": getattr(work_order, "completed_quantity", None),
                    "updated_at": getattr(work_order, "updated_at", None),
                    **pull_summary,
                    "capabilities": {
                        "pull_finished_goods_inspection": {
                            "allowed": allowed,
                            "reason": reason,
                        }
                    },
                }
            )
        return {"data": rows, "total": total, "success": True}

    async def create_inspection_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
        reporting_record_id: Optional[int] = None,
    ) -> FinishedGoodsInspectionResponse:
        """
        从工单创建成品检验单
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            created_by: 创建人ID
            
        Returns:
            FinishedGoodsInspectionResponse: 创建的成品检验单
        """
        await _require_fqc_stage_enabled(tenant_id)
        finished_enabled = await _is_finished_inspection_enabled(tenant_id)
        if not finished_enabled:
            raise BusinessLogicError("当前组织未开启成品检验，禁止从工单下推成品检验")
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.master_data.models.material import Material

        async with in_transaction():
            # 获取工单
            work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
            )
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")

            wf = _work_order_product_fields(work_order)
            mid = wf.get("material_id")
            mat = None
            if mid:
                mat = await Material.get_or_none(
                    tenant_id=tenant_id, id=mid, deleted_at__isnull=True
                )

            eff, _, _ = await resolve_inspection_policy(
                tenant_id,
                "fqc",
                material_id=mid,
            )
            if eff == "none":
                raise BusinessLogicError(
                    "当前成品物料未配置成品检验（质检模式为无质检），无需下推成品检验单"
                )

            if reporting_record_id:
                existing_by_report = await FinishedGoodsInspection.filter(
                    tenant_id=tenant_id,
                    reporting_record_id=reporting_record_id,
                    deleted_at__isnull=True,
                ).first()
                if existing_by_report:
                    return FinishedGoodsInspectionResponse.model_validate(existing_by_report)
            
            # 检查是否已存在检验单（含自动生成的待检/已检，取消除外）
            existing = await FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True,
            ).exclude(status="已取消").first()

            if existing:
                raise BusinessLogicError(
                    "该工单已有成品检验单（含自动生成），无需重复下推；可在成品检验中查看"
                )
            
            # 创建检验单
            today = today_site_str()
            code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")

            inspection_qty = wf.get("planned_qty") or work_order.quantity

            template = await _resolve_inspection_template_fields(
                tenant_id,
                wf["material_id"],
                "fqc",
            )
            initial_review_fields = await _quality_inspection_initial_review_fields(
                tenant_id, "finished_goods_inspection"
            )
            material_unit = await _resolve_material_base_unit(tenant_id, wf["material_id"])
            
            inspection = await FinishedGoodsInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                reporting_record_id=reporting_record_id,
                source_type="work_order",
                source_id=work_order_id,
                source_code=work_order.code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                sales_order_id=work_order.sales_order_id,
                sales_order_code=work_order.sales_order_code,
                customer_id=getattr(work_order, "customer_id", None),
                customer_name=getattr(work_order, "customer_name", None),
                material_id=wf["material_id"],
                material_code=wf["material_code"],
                material_name=wf["material_name"],
                material_spec=wf["material_spec"],
                material_unit=material_unit,
                batch_number=wf["batch_number"],
                inspection_quantity=inspection_qty,
                qualified_quantity=0,
                unqualified_quantity=0,
                inspection_result="待检验",
                quality_status="待判定",
                status="待检验",
                created_by=created_by,
                created_by_name=(await self.get_user_name(created_by)) if created_by else None,
                updated_by=created_by,
                updated_by_name=(await self.get_user_name(created_by)) if created_by else None,
                **template,
                **initial_review_fields,
            )
            # 建立工单→成品检验 的 DocumentRelation
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="work_order",
                        source_id=work_order_id,
                        source_code=work_order.code,
                        source_name=work_order.name,
                        target_type="finished_goods_inspection",
                        target_id=inspection.id,
                        target_code=inspection.inspection_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="工单创建成品检验单",
                    ),
                    created_by=created_by,
                )
            except Exception as e:
                logger.warning("建立工单→成品检验 单据关联失败: %s", e)
            return FinishedGoodsInspectionResponse.model_validate(inspection)

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从二维数组数据导入成品检验单"""
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        header_map = {
            '工单编码': 'work_order_code',
            '检验数量': 'inspection_quantity',
            '合格数量': 'qualified_quantity',
            '不合格数量': 'unqualified_quantity',
            '备注': 'notes',
        }
        
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header in header_map:
                header_index_map[header_map[header]] = idx
        
        if 'work_order_code' not in header_index_map:
            raise ValidationError("导入数据必须包含'工单编码'字段")

        await _require_fqc_stage_enabled(tenant_id)

        success_count = 0
        failure_count = 0
        errors = []
        initial_review_fields = await _quality_inspection_initial_review_fields(
            tenant_id, "finished_goods_inspection"
        )

        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.master_data.models.material import Material

        for row_idx, row in enumerate(data[2:], start=3):
            try:
                work_order_code = str(row[header_index_map['work_order_code']]).strip()
                work_order = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, code=work_order_code, deleted_at__isnull=True
                )
                if not work_order:
                    raise ValidationError(f"工单不存在: {work_order_code}")

                wf = _work_order_product_fields(work_order)
                mid = wf.get("material_id")
                mat = None
                if mid:
                    mat = await Material.get_or_none(
                        tenant_id=tenant_id, id=mid, deleted_at__isnull=True
                    )

                eff, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "fqc",
                    material_id=mid,
                )
                if eff == "none":
                    continue

                existing = await FinishedGoodsInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id
                ).first()

                if existing:
                    continue

                today = today_site_str()
                code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")

                base_qty = wf.get("planned_qty") or work_order.quantity
                inspection_quantity = (
                    float(row[header_index_map.get('inspection_quantity', -1)])
                    if header_index_map.get('inspection_quantity', -1) >= 0
                    and row[header_index_map.get('inspection_quantity', -1)]
                    else base_qty
                )
                qualified_quantity = float(row[header_index_map.get('qualified_quantity', -1)]) if header_index_map.get('qualified_quantity', -1) >= 0 and row[header_index_map.get('qualified_quantity', -1)] else 0
                unqualified_quantity = float(row[header_index_map.get('unqualified_quantity', -1)]) if header_index_map.get('unqualified_quantity', -1) >= 0 and row[header_index_map.get('unqualified_quantity', -1)] else 0
                notes = str(row[header_index_map.get('notes', -1)]) if header_index_map.get('notes', -1) >= 0 and row[header_index_map.get('notes', -1)] else None

                await FinishedGoodsInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    source_type="work_order",
                    source_id=work_order.id,
                    source_code=work_order.code,
                    work_order_id=work_order.id,
                    work_order_code=work_order.code,
                    sales_order_id=work_order.sales_order_id,
                    sales_order_code=work_order.sales_order_code,
                    customer_id=getattr(work_order, "customer_id", None),
                    customer_name=getattr(work_order, "customer_name", None),
                    material_id=wf["material_id"],
                    material_code=wf["material_code"],
                    material_name=wf["material_name"],
                    material_spec=wf["material_spec"],
                    material_unit=(getattr(mat, "base_unit", None) or "个") if mat else await _resolve_material_base_unit(tenant_id, wf["material_id"]),
                    batch_number=wf["batch_number"],
                    inspection_quantity=inspection_quantity,
                    qualified_quantity=qualified_quantity,
                    unqualified_quantity=unqualified_quantity,
                    inspection_result="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    quality_status="待判定" if qualified_quantity == 0 and unqualified_quantity == 0 else ("合格" if unqualified_quantity == 0 else "不合格"),
                    status="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    notes=notes,
                    created_by=created_by,
                    created_by_name=(await self.get_user_name(created_by)) if created_by else None,
                    updated_by=created_by,
                    updated_by_name=(await self.get_user_name(created_by)) if created_by else None,
                    **initial_review_fields,
                )
                success_count += 1
            except Exception as e:
                failure_count += 1
                errors.append({"row": row_idx, "message": str(e)})

        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """导出成品检验单到Excel文件"""
        import csv
        import os
        import tempfile
        
        inspections = await self.list_finished_goods_inspections(
            tenant_id=tenant_id,
            skip=0,
            limit=10000,
            **filters
        )
        
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp = resolve_business_datetime().strftime('%Y%m%d_%H%M%S')
        filename = f"finished_goods_inspections_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '检验单号', '工单编码', '物料编码', '物料名称',
                '检验数量', '合格数量', '不合格数量', '检验结果', '质量状态',
                '检验员', '检验时间', '状态', '备注'
            ])
            
            for inspection in inspections:
                writer.writerow([
                    inspection.inspection_code,
                    inspection.work_order_code,
                    inspection.material_code,
                    inspection.material_name,
                    str(inspection.inspection_quantity),
                    str(inspection.qualified_quantity),
                    str(inspection.unqualified_quantity),
                    inspection.inspection_result,
                    inspection.quality_status,
                    inspection.inspector_name or '',
                    to_api_isoformat(inspection.inspection_time) if inspection.inspection_time else '',
                    inspection.status,
                    inspection.notes or '',
                ])
        
        return file_path

    # ============ 质量异常检测和统计分析 ============

    async def get_quality_anomalies(
        self,
        tenant_id: int,
        inspection_type: Optional[str] = None,  # "incoming", "process", "finished"
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        material_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        limit: int = 100,
    ) -> List[dict]:
        """
        查询质量异常记录（不合格的检验单）

        Args:
            tenant_id: 租户ID
            inspection_type: 检验类型（可选：incoming/process/finished）
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            supplier_id: 供应商ID（可选，仅用于来料检验）
            limit: 返回条数上限（全类型合并排序后截取）

        Returns:
            List[dict]: 质量异常记录列表
        """
        anomalies = []

        # 查询来料检验异常
        if inspection_type is None or inspection_type == "incoming":
            query = IncomingInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)
            if supplier_id:
                query = query.filter(supplier_id=supplier_id)

            incoming_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in incoming_anomalies:
                anomalies.append({
                    "inspection_type": "incoming",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "supplier_id": inspection.supplier_id,
                    "supplier_name": inspection.supplier_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": to_api_isoformat(inspection.inspection_time) if inspection.inspection_time else None
                })

        # 查询过程检验异常
        if inspection_type is None or inspection_type == "process":
            query = ProcessInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            process_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in process_anomalies:
                anomalies.append({
                    "inspection_type": "process",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "work_order_id": inspection.work_order_id,
                    "work_order_code": inspection.work_order_code,
                    "operation_id": inspection.operation_id,
                    "operation_name": inspection.operation_name,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": to_api_isoformat(inspection.inspection_time) if inspection.inspection_time else None
                })

        # 查询成品检验异常
        if inspection_type is None or inspection_type == "finished":
            query = FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            finished_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in finished_anomalies:
                anomalies.append({
                    "inspection_type": "finished",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "work_order_id": inspection.work_order_id,
                    "work_order_code": inspection.work_order_code,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": to_api_isoformat(inspection.inspection_time) if inspection.inspection_time else None
                })

        # 按检验时间降序排序
        anomalies.sort(key=lambda x: x.get("inspection_time") or "", reverse=True)
        return anomalies[: max(1, min(limit, 500))]

    async def get_quality_statistics(
        self,
        tenant_id: int,
        inspection_type: Optional[str] = None,  # "incoming", "process", "finished"
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        material_id: Optional[int] = None,
        supplier_id: Optional[int] = None
    ) -> dict:
        """
        获取质量统计分析

        Args:
            tenant_id: 租户ID
            inspection_type: 检验类型（可选：incoming/process/finished）
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            supplier_id: 供应商ID（可选，仅用于来料检验）

        Returns:
            dict: 质量统计数据
        """
        stats = {
            "total_inspections": 0,
            "total_quantity": Decimal(0),
            "qualified_quantity": Decimal(0),
            "unqualified_quantity": Decimal(0),
            "by_type": {}
        }

        # 统计来料检验
        if inspection_type is None or inspection_type == "incoming":
            query = IncomingInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)
            if supplier_id:
                query = query.filter(supplier_id=supplier_id)

            incoming_inspections = await query.all()
            incoming_stats = {
                "total_inspections": len(incoming_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in incoming_inspections:
                incoming_stats["total_quantity"] += inspection.inspection_quantity
                incoming_stats["qualified_quantity"] += inspection.qualified_quantity
                incoming_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if incoming_stats["total_quantity"] > 0:
                incoming_stats["qualified_rate"] = float(
                    incoming_stats["qualified_quantity"] / incoming_stats["total_quantity"] * 100
                )
                incoming_stats["unqualified_rate"] = float(
                    incoming_stats["unqualified_quantity"] / incoming_stats["total_quantity"] * 100
                )
            else:
                incoming_stats["qualified_rate"] = 0.0
                incoming_stats["unqualified_rate"] = 0.0

            stats["by_type"]["incoming"] = incoming_stats
            stats["total_inspections"] += incoming_stats["total_inspections"]
            stats["total_quantity"] += incoming_stats["total_quantity"]
            stats["qualified_quantity"] += incoming_stats["qualified_quantity"]
            stats["unqualified_quantity"] += incoming_stats["unqualified_quantity"]

        # 统计过程检验
        if inspection_type is None or inspection_type == "process":
            query = ProcessInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            process_inspections = await query.all()
            process_stats = {
                "total_inspections": len(process_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in process_inspections:
                process_stats["total_quantity"] += inspection.inspection_quantity
                process_stats["qualified_quantity"] += inspection.qualified_quantity
                process_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if process_stats["total_quantity"] > 0:
                process_stats["qualified_rate"] = float(
                    process_stats["qualified_quantity"] / process_stats["total_quantity"] * 100
                )
                process_stats["unqualified_rate"] = float(
                    process_stats["unqualified_quantity"] / process_stats["total_quantity"] * 100
                )
            else:
                process_stats["qualified_rate"] = 0.0
                process_stats["unqualified_rate"] = 0.0

            stats["by_type"]["process"] = process_stats
            stats["total_inspections"] += process_stats["total_inspections"]
            stats["total_quantity"] += process_stats["total_quantity"]
            stats["qualified_quantity"] += process_stats["qualified_quantity"]
            stats["unqualified_quantity"] += process_stats["unqualified_quantity"]

        # 统计成品检验
        if inspection_type is None or inspection_type == "finished":
            query = FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            finished_inspections = await query.all()
            finished_stats = {
                "total_inspections": len(finished_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in finished_inspections:
                finished_stats["total_quantity"] += inspection.inspection_quantity
                finished_stats["qualified_quantity"] += inspection.qualified_quantity
                finished_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if finished_stats["total_quantity"] > 0:
                finished_stats["qualified_rate"] = float(
                    finished_stats["qualified_quantity"] / finished_stats["total_quantity"] * 100
                )
                finished_stats["unqualified_rate"] = float(
                    finished_stats["unqualified_quantity"] / finished_stats["total_quantity"] * 100
                )
            else:
                finished_stats["qualified_rate"] = 0.0
                finished_stats["unqualified_rate"] = 0.0

            stats["by_type"]["finished"] = finished_stats
            stats["total_inspections"] += finished_stats["total_inspections"]
            stats["total_quantity"] += finished_stats["total_quantity"]
            stats["qualified_quantity"] += finished_stats["qualified_quantity"]
            stats["unqualified_quantity"] += finished_stats["unqualified_quantity"]

        # 计算总体合格率
        if stats["total_quantity"] > 0:
            stats["qualified_rate"] = float(
                stats["qualified_quantity"] / stats["total_quantity"] * 100
            )
            stats["unqualified_rate"] = float(
                stats["unqualified_quantity"] / stats["total_quantity"] * 100
            )
        else:
            stats["qualified_rate"] = 0.0
            stats["unqualified_rate"] = 0.0

        # 转换为float以便JSON序列化
        stats["total_quantity"] = float(stats["total_quantity"])
        stats["qualified_quantity"] = float(stats["qualified_quantity"])
        stats["unqualified_quantity"] = float(stats["unqualified_quantity"])

        # 转换 by_type 中的 Decimal 值为 float
        for inspection_type_key, type_stats in stats["by_type"].items():
            if "total_quantity" in type_stats:
                type_stats["total_quantity"] = float(type_stats["total_quantity"])
            if "qualified_quantity" in type_stats:
                type_stats["qualified_quantity"] = float(type_stats["qualified_quantity"])
            if "unqualified_quantity" in type_stats:
                type_stats["unqualified_quantity"] = float(type_stats["unqualified_quantity"])

        return stats

    async def get_inspection_center_summary(self, tenant_id: int) -> dict:
        """
        获取质检中心看板汇总数据：待检验数量、合格率趋势等。
        """
        import asyncio
        from datetime import datetime, timedelta
        from decimal import Decimal
        from tortoise.functions import Sum
        from apps.kuaizhizao.models.oqc_inspection import OQCInspection

        now = resolve_business_datetime()
        today_start = datetime(now.year, now.month, now.day)
        month_start = datetime(now.year, now.month, 1)
        last_month_end = month_start - timedelta(seconds=1)
        last_month_start = datetime(last_month_end.year, last_month_end.month, 1)

        # 1. 并行获取待检验数量
        pending_tasks = [
            IncomingInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
            ProcessInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
            FinishedGoodsInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
            OQCInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
        ]

        async def sum_qualified_between(start: datetime, end: datetime, *, end_inclusive: bool = False) -> tuple:
            """使用聚合函数计算特定时间范围内的合格率数据，避免加载全部行。"""
            time_kw = {"inspection_time__gte": start, "inspection_time__lte": end} if end_inclusive else {"inspection_time__gte": start, "inspection_time__lt": end}
            
            total_sum = Decimal(0)
            qual_sum = Decimal(0)
            
            # 对三种检验类型并行获取数据
            agg_tasks = []
            for model in (IncomingInspection, ProcessInspection, FinishedGoodsInspection):
                agg_tasks.append(model.filter(
                    tenant_id=tenant_id, deleted_at__isnull=True, status="已检验", **time_kw
                ).values_list("inspection_quantity", "qualified_quantity"))
            
            results = await asyncio.gather(*agg_tasks)
            for model_results in results:
                for t, q in model_results:
                    total_sum += Decimal(str(t or 0))
                    qual_sum += Decimal(str(q or 0))
                
            return total_sum, qual_sum

        # 2. 获取汇总数据（今日、本月、上月）
        (
            (pending_incoming, pending_process, pending_finished, pending_oqc), 
            (t_today, q_today),
            (t_month, q_month),
            (t_last_month, q_last_month)
        ) = await asyncio.gather(
            asyncio.gather(*pending_tasks),
            sum_qualified_between(today_start, now, end_inclusive=True),
            sum_qualified_between(month_start, now, end_inclusive=True),
            sum_qualified_between(last_month_start, last_month_end, end_inclusive=True)
        )
        
        today_qualified_rate = float(q_today / t_today * 100) if t_today > 0 else 0.0
        month_qualified_rate = float(q_month / t_month * 100) if t_month > 0 else 0.0
        last_month_qualified_rate = float(q_last_month / t_last_month * 100) if t_last_month > 0 else 0.0

        total_inspected_today = float(t_today)

        # 3. 并行获取近 7 日趋势
        daily_trend = []
        today_d = now.date()
        trend_tasks = []
        dates = []

        for i in range(6, -1, -1):
            d = today_d - timedelta(days=i)
            dates.append(d)
            ds = datetime(d.year, d.month, d.day)
            if d == today_d:
                trend_tasks.append(sum_qualified_between(ds, now, end_inclusive=True))
            else:
                de = ds + timedelta(days=1)
                trend_tasks.append(sum_qualified_between(ds, de, end_inclusive=False))
        
        trend_results = await asyncio.gather(*trend_tasks)
        for d, (tq, qq) in zip(dates, trend_results):
            rate = float(qq / tq * 100) if tq > 0 else 0.0
            daily_trend.append({"date": to_api_isoformat(d), "rate": round(rate, 2)})

        sparkline_rates = [x["rate"] for x in daily_trend]

        return {
            "pending_incoming": pending_incoming,
            "pending_process": pending_process,
            "pending_finished": pending_finished,
            "pending_oqc": pending_oqc,
            "total_inspected_today": total_inspected_today,
            "today_qualified_rate": round(today_qualified_rate, 2),
            "month_qualified_rate": round(month_qualified_rate, 2),
            "last_month_qualified_rate": round(last_month_qualified_rate, 2),
            "daily_pass_rate_trend": daily_trend,
            "sparkline_rates": sparkline_rates,
        }

