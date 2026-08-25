"""返工单闭环工作流（下达、逐工序推进、完修、复检、关闭）。"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from tortoise.transactions import in_transaction

from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from loguru import logger

from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.rework_order_operation import ReworkOrderOperation
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.schemas.rework_order import (
    ReworkAdvanceNextRequest,
    ReworkCancelRequest,
    ReworkCloseRequest,
    ReworkHoldRequest,
    ReworkQualityReleaseRequest,
    ReworkRequestCompleteRequest,
)
from apps.kuaizhizao.services.document_action_policy.rework_order import (
    assert_rework_order_capability,
    capability_kwargs_from_context,
    derive_rework_order_capabilities,
)
from apps.kuaizhizao.utils.rework_order_constants import (
    OPERATION_ROLE_DYNAMIC,
    OPERATION_ROLE_PLANNED,
    OPERATION_ROLE_START,
    OPERATION_STATUS_ACTIVE,
    OPERATION_STATUS_COMPLETED,
    OPERATION_STATUS_PENDING,
    ROUTING_MODE_DYNAMIC,
    ROUTING_MODE_PREDEFINED,
)


def _dec(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


def recoverable_report_unqualified_take(
    rework_qty: Decimal,
    operation_unqualified: Decimal,
) -> Decimal:
    """
    报工不合格挽回量：不超过返工完修数与工序当前不合格数。
    二次回写时不合格已为 0，take=0，保证幂等。
    """
    qty = _dec(rework_qty)
    op_u = _dec(operation_unqualified)
    if qty <= 0 or op_u <= 0:
        return Decimal("0")
    return min(qty, op_u)


async def load_operation_links(tenant_id: int, rework_order_id: int) -> List[ReworkOrderOperation]:
    return await ReworkOrderOperation.filter(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id,
    ).order_by("sequence", "id").all()


async def sync_link_quantities_from_reports(
    tenant_id: int,
    link: ReworkOrderOperation,
) -> ReworkOrderOperation:
    reports = await ReportingRecord.filter(
        tenant_id=tenant_id,
        rework_order_id=link.rework_order_id,
        rework_order_operation_id=link.id,
        deleted_at__isnull=True,
        status="approved",
    ).all()
    qualified = sum(_dec(r.qualified_quantity) for r in reports)
    unqualified = sum(_dec(r.unqualified_quantity) for r in reports)
    link.qualified_quantity = qualified
    link.unqualified_quantity = unqualified
    await link.save()
    return link


def resolve_awaiting_route_decision(
    *,
    status: str,
    routing_mode: str,
    links: List[Any],
    current_link: Optional[Any],
) -> bool:
    """
    动态路线：当前工序完成后会清空 current_operation_link_id，进入「选择下一工序 / 完修」决策窗。
    不得仅用 current_link.status==completed 判断，否则清空指针后 awaiting 恒为 False，
    前端仍显示「报工」并报「当前无激活工序」。
    """
    if _norm_status(status) != "in_progress":
        return False
    if _norm_status(routing_mode) != _norm_status(ROUTING_MODE_DYNAMIC):
        return False
    has_active = any(_norm_status(l.status) == OPERATION_STATUS_ACTIVE for l in links)
    if has_active:
        return False
    has_completed = any(_norm_status(l.status) == OPERATION_STATUS_COMPLETED for l in links)
    if not has_completed:
        return False
    if current_link is not None and _norm_status(current_link.status) == OPERATION_STATUS_COMPLETED:
        return True
    # 报工完成后清空 current_operation_link_id 的常态
    return current_link is None


async def compute_capability_context(
    tenant_id: int,
    rework_order: ReworkOrder,
) -> Dict[str, Any]:
    links = await load_operation_links(tenant_id, rework_order.id)
    for link in links:
        await sync_link_quantities_from_reports(tenant_id, link)

    has_reports = await ReportingRecord.filter(
        tenant_id=tenant_id,
        rework_order_id=rework_order.id,
        deleted_at__isnull=True,
        status__in=["pending", "approved"],
    ).exists()

    current_link = next((l for l in links if l.id == rework_order.current_operation_link_id), None)
    if current_link is None:
        # 指针丢失时回退到仍为 active 的工序行，避免误报无激活工序
        current_link = next(
            (l for l in links if _norm_status(l.status) == OPERATION_STATUS_ACTIVE),
            None,
        )
    current_op_completed = bool(
        current_link and _norm_status(current_link.status) == OPERATION_STATUS_COMPLETED
    )
    has_completed_operation = any(_norm_status(l.status) == OPERATION_STATUS_COMPLETED for l in links)
    awaiting_route_decision = resolve_awaiting_route_decision(
        status=str(rework_order.status or ""),
        routing_mode=str(rework_order.routing_mode or ROUTING_MODE_DYNAMIC),
        links=links,
        current_link=current_link,
    )

    # 工序返工若误挂了成品检验复检单，在能力计算前纠偏为过程检验
    if (
        str(rework_order.status or "") == "pending_verification"
        and rework_order.verification_required
        and not rework_order.source_inspection_id
    ):
        await _heal_process_verification_inspection(tenant_id, rework_order)

    req_qty = _dec(rework_order.completed_quantity or rework_order.quantity)
    verification_passed = await _is_verification_passed(
        tenant_id, rework_order, req_qty=req_qty
    )

    return {
        "has_reports": has_reports,
        "current_op_completed": current_op_completed,
        "has_completed_operation": has_completed_operation,
        "awaiting_route_decision": awaiting_route_decision,
        "verification_passed": verification_passed,
        "links": links,
        "current_link": current_link,
    }


def _norm_status(value: Any) -> str:
    return str(value or "").strip().lower()


async def activate_operation_link(
    tenant_id: int,
    rework_order: ReworkOrder,
    link: ReworkOrderOperation,
    *,
    input_quantity: Decimal,
    actor_id: int,
    actor_name: str,
) -> None:
    link.status = OPERATION_STATUS_ACTIVE
    link.input_quantity = input_quantity
    link.started_at = link.started_at or resolve_business_datetime()
    await link.save()
    rework_order.current_operation_link_id = link.id
    rework_order.updated_by = actor_id
    rework_order.updated_by_name = actor_name
    await rework_order.save()


async def complete_operation_link(
    tenant_id: int,
    link: ReworkOrderOperation,
) -> ReworkOrderOperation:
    await sync_link_quantities_from_reports(tenant_id, link)
    input_qty = _dec(link.input_quantity)
    if link.qualified_quantity < input_qty:
        return link
    link.status = OPERATION_STATUS_COMPLETED
    link.completed_at = link.completed_at or resolve_business_datetime()
    await link.save()
    return link


async def try_advance_predefined_route(
    tenant_id: int,
    rework_order: ReworkOrder,
    *,
    actor_id: int,
    actor_name: str,
) -> bool:
    if rework_order.routing_mode != ROUTING_MODE_PREDEFINED:
        return False
    links = await load_operation_links(tenant_id, rework_order.id)
    next_link = next(
        (l for l in links if _norm_status(l.status) == OPERATION_STATUS_PENDING),
        None,
    )
    if not next_link:
        return False
    prev_completed = [l for l in links if _norm_status(l.status) == OPERATION_STATUS_COMPLETED]
    if prev_completed:
        input_qty = _dec(prev_completed[-1].qualified_quantity)
    else:
        input_qty = _dec(rework_order.quantity)
    if input_qty <= 0:
        input_qty = _dec(rework_order.quantity)
    await activate_operation_link(
        tenant_id,
        rework_order,
        next_link,
        input_quantity=input_qty,
        actor_id=actor_id,
        actor_name=actor_name,
    )
    return True


async def release_rework_order(
    tenant_id: int,
    rework_order: ReworkOrder,
    *,
    released_by: int,
    released_by_name: str,
    get_user_info,
) -> ReworkOrder:
    ctx = await compute_capability_context(tenant_id, rework_order)
    caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
    assert_rework_order_capability(rework_order, "release", caps)

    links = ctx["links"]
    if not links:
        raise BusinessLogicError("返工单未配置工序路线，无法下达")

    start_link = links[0]
    async with in_transaction():
        await activate_operation_link(
            tenant_id,
            rework_order,
            start_link,
            input_quantity=_dec(rework_order.quantity),
            actor_id=released_by,
            actor_name=released_by_name,
        )
        rework_order.status = "released"
        rework_order.updated_by = released_by
        rework_order.updated_by_name = released_by_name
        await rework_order.save()
    return rework_order


async def advance_next_operation(
    tenant_id: int,
    rework_order: ReworkOrder,
    request: ReworkAdvanceNextRequest,
    *,
    actor_id: int,
    actor_name: str,
) -> ReworkOrder:
    ctx = await compute_capability_context(tenant_id, rework_order)
    caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
    assert_rework_order_capability(rework_order, "advance_next", caps)

    if not rework_order.original_work_order_id:
        raise BusinessLogicError("返工单未关联原工单")

    op = await WorkOrderOperation.get_or_none(
        tenant_id=tenant_id,
        id=request.next_work_order_operation_id,
        work_order_id=rework_order.original_work_order_id,
        deleted_at__isnull=True,
    )
    if not op:
        raise ValidationError("下一道工序不属于原工单或不存在")

    current_link = ctx["current_link"]
    input_qty = _dec(request.input_quantity) if request.input_quantity is not None else _dec(
        current_link.qualified_quantity if current_link else rework_order.quantity
    )
    if input_qty <= 0:
        raise ValidationError("投入数量必须大于 0")

    async with in_transaction():
        max_seq = max((l.sequence for l in ctx["links"]), default=0)
        new_link = await ReworkOrderOperation.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            rework_order_id=rework_order.id,
            work_order_operation_id=request.next_work_order_operation_id,
            sequence=max_seq + 1,
            role=OPERATION_ROLE_DYNAMIC,
            status=OPERATION_STATUS_PENDING,
            decision_reason=request.decision_reason,
            decided_by=actor_id,
            decided_by_name=actor_name,
            decided_at=resolve_business_datetime(),
        )
        await activate_operation_link(
            tenant_id,
            rework_order,
            new_link,
            input_quantity=input_qty,
            actor_id=actor_id,
            actor_name=actor_name,
        )
        rework_order.status = "in_progress"
        rework_order.updated_by = actor_id
        rework_order.updated_by_name = actor_name
        await rework_order.save()
    return rework_order


async def request_completion(
    tenant_id: int,
    rework_order: ReworkOrder,
    request: ReworkRequestCompleteRequest,
    *,
    actor_id: int,
    actor_name: str,
) -> ReworkOrder:
    ctx = await compute_capability_context(tenant_id, rework_order)
    caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
    assert_rework_order_capability(rework_order, "request_complete", caps)

    completed_links = [l for l in ctx["links"] if _norm_status(l.status) == OPERATION_STATUS_COMPLETED]
    if not completed_links:
        raise BusinessLogicError("尚未完成任何返工工序，无法申请完修")

    if request.completed_quantity is not None:
        completed_qty = _dec(request.completed_quantity)
    else:
        completed_qty = _dec(completed_links[-1].qualified_quantity)
    if completed_qty <= 0:
        raise ValidationError("完修数量必须大于 0")
    if completed_qty > _dec(rework_order.quantity):
        raise BusinessLogicError("完修数量不能超过返工数量")

    async with in_transaction():
        rework_order.completed_quantity = completed_qty
        rework_order.completion_requested_at = resolve_business_datetime()
        rework_order.completion_requested_by = actor_id
        rework_order.completion_requested_by_name = actor_name
        rework_order.current_operation_link_id = None
        rework_order.updated_by = actor_id
        rework_order.updated_by_name = actor_name

        if rework_order.verification_required:
            inspection_id = await _create_verification_inspection(
                tenant_id, rework_order, completed_qty, actor_id
            )
            rework_order.verification_inspection_id = inspection_id
            rework_order.status = "pending_verification"
        else:
            rework_order.status = "quality_released"
            rework_order.quality_released_at = resolve_business_datetime()
            rework_order.quality_released_by = actor_id
            rework_order.quality_released_by_name = actor_name

        if request.remarks:
            base = (rework_order.remarks or "").strip()
            rework_order.remarks = f"{base}\n完修申请: {request.remarks}".strip()

        await rework_order.save()
        if rework_order.status == "quality_released":
            await _writeback_start_operation_after_quality_release(
                tenant_id, rework_order, actor_id=actor_id
            )
    return rework_order


def _uses_finished_goods_verification(rework_order: ReworkOrder) -> bool:
    """成品检验下推的返工 → FQC 复检；其余（工序/手工返工）→ 过程检验复检。"""
    return bool(rework_order.source_inspection_id)


async def _inspection_status_passed(inspection: Any) -> bool:
    return (
        _norm_status(getattr(inspection, "review_status", None))
        in ("已通过", "通过", "approved", "audited")
        or _norm_status(getattr(inspection, "status", None))
        in ("已审核", "audited", "approved", "已检验", "inspected")
    )


async def _is_verification_passed(
    tenant_id: int,
    rework_order: ReworkOrder,
    *,
    req_qty: Decimal,
) -> bool:
    vid = rework_order.verification_inspection_id
    if not vid:
        return False
    if _uses_finished_goods_verification(rework_order):
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

        inspection = await FinishedGoodsInspection.get_or_none(
            tenant_id=tenant_id, id=vid, deleted_at__isnull=True
        )
        if not inspection or not await _inspection_status_passed(inspection):
            return False
        return _dec(inspection.qualified_quantity) >= req_qty

    from apps.kuaizhizao.models.process_inspection import ProcessInspection

    process = await ProcessInspection.get_or_none(
        tenant_id=tenant_id, id=vid, deleted_at__isnull=True
    )
    if process:
        if not await _inspection_status_passed(process):
            return False
        return _dec(process.qualified_quantity) >= req_qty

    # 历史误生成的 FQC 复检单：仍认结果，避免卡死
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

    legacy = await FinishedGoodsInspection.get_or_none(
        tenant_id=tenant_id, id=vid, deleted_at__isnull=True
    )
    if not legacy or not await _inspection_status_passed(legacy):
        return False
    return _dec(legacy.qualified_quantity) >= req_qty


async def _resolve_rework_start_work_order_operation(
    tenant_id: int,
    rework_order: ReworkOrder,
) -> WorkOrderOperation:
    woo_id = rework_order.start_work_order_operation_id
    if woo_id:
        woo = await WorkOrderOperation.get_or_none(
            tenant_id=tenant_id, id=int(woo_id), deleted_at__isnull=True
        )
        if woo:
            return woo
    if rework_order.original_work_order_id:
        woo = (
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=int(rework_order.original_work_order_id),
                deleted_at__isnull=True,
            )
            .order_by("sequence", "id")
            .first()
        )
        if woo:
            return woo
    raise BusinessLogicError("工序返工复检需要起始工序，请指定返工起始工序后再申请完修")


async def _create_process_verification_inspection(
    tenant_id: int,
    rework_order: ReworkOrder,
    quantity: Decimal,
    created_by: int,
) -> int:
    from apps.kuaizhizao.models.process_inspection import ProcessInspection
    from apps.kuaizhizao.services.quality_service import (
        ProcessInspectionService,
        _quality_inspection_initial_review_fields,
        _require_ipqc_stage_enabled,
        _resolve_inspection_template_fields,
        _resolve_material_base_unit,
    )

    await _require_ipqc_stage_enabled(tenant_id)
    woo = await _resolve_rework_start_work_order_operation(tenant_id, rework_order)
    wo = await WorkOrder.get_or_none(
        tenant_id=tenant_id,
        id=rework_order.original_work_order_id,
        deleted_at__isnull=True,
    )
    if not wo:
        raise NotFoundError(f"原工单不存在: {rework_order.original_work_order_id}")

    master_op_id = int(woo.operation_id)
    from core.utils.timezone_utils import today_site_str

    code = await ProcessInspectionService().generate_code(
        tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today_site_str()}"
    )
    # 业务可读：返工复检单号带返工单编码，避免与普通 IPQC 混淆
    inspection_code = f"PQ-RW-{rework_order.code}"
    exists = await ProcessInspection.filter(
        tenant_id=tenant_id, inspection_code=inspection_code, deleted_at__isnull=True
    ).exists()
    if exists:
        inspection_code = f"{code}-RW"

    template = await _resolve_inspection_template_fields(
        tenant_id,
        rework_order.product_id,
        "ipqc",
        operation_id=master_op_id,
        use_quality_characteristics=True,
    )
    initial_review_fields = await _quality_inspection_initial_review_fields(
        tenant_id, "process_inspection"
    )
    material_unit = await _resolve_material_base_unit(tenant_id, rework_order.product_id)

    inspection = await ProcessInspection.create(
        tenant_id=tenant_id,
        inspection_code=inspection_code,
        work_order_id=int(wo.id),
        work_order_code=wo.code,
        operation_id=master_op_id,
        operation_code=woo.operation_code,
        operation_name=woo.operation_name,
        workshop_id=getattr(wo, "workshop_id", None),
        workshop_name=getattr(wo, "workshop_name", None),
        material_id=rework_order.product_id,
        material_code=rework_order.product_code,
        material_name=rework_order.product_name,
        material_unit=material_unit,
        inspection_quantity=quantity,
        qualified_quantity=Decimal("0"),
        unqualified_quantity=Decimal("0"),
        inspection_result="待检验",
        quality_status="待判定",
        status="待检验",
        notes=f"返工复检（工序）：{rework_order.code}",
        created_by=created_by,
        **template,
        **initial_review_fields,
    )

    try:
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService

        await DocumentRelationNewService().create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type="rework_order",
                source_id=int(rework_order.id),
                source_code=rework_order.code,
                source_name=None,
                target_type="process_inspection",
                target_id=int(inspection.id),
                target_code=str(inspection.inspection_code),
                target_name=None,
                relation_type="source",
                relation_mode="push",
                relation_desc="返工完修生成过程复检单",
            ),
            created_by=created_by,
        )
    except Exception as exc:
        logger.warning("建立返工单→过程复检关联失败: {}", exc)

    return int(inspection.id)


async def _create_finished_goods_verification_inspection(
    tenant_id: int,
    rework_order: ReworkOrder,
    quantity: Decimal,
    created_by: int,
) -> int:
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

    wo = await WorkOrder.get_or_none(
        tenant_id=tenant_id,
        id=rework_order.original_work_order_id,
        deleted_at__isnull=True,
    )
    inspection = await FinishedGoodsInspection.create(
        tenant_id=tenant_id,
        uuid=str(uuid.uuid4()),
        inspection_code=f"FQC-RW-{rework_order.code}",
        work_order_id=rework_order.original_work_order_id,
        work_order_code=wo.code if wo else "",
        material_id=rework_order.product_id,
        material_code=rework_order.product_code,
        material_name=rework_order.product_name,
        inspection_quantity=quantity,
        qualified_quantity=Decimal("0"),
        unqualified_quantity=Decimal("0"),
        status="待检验",
        source_type="rework_order",
        source_id=rework_order.id,
        source_code=rework_order.code,
    )
    return int(inspection.id)


async def _create_verification_inspection(
    tenant_id: int,
    rework_order: ReworkOrder,
    quantity: Decimal,
    created_by: int,
) -> int:
    if _uses_finished_goods_verification(rework_order):
        return await _create_finished_goods_verification_inspection(
            tenant_id, rework_order, quantity, created_by
        )
    return await _create_process_verification_inspection(
        tenant_id, rework_order, quantity, created_by
    )


async def _heal_process_verification_inspection(
    tenant_id: int,
    rework_order: ReworkOrder,
) -> None:
    """
    工序返工待复检但误挂成品检验单时：若 FQC 仍待检则改为过程检验复检单。
    """
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
    from apps.kuaizhizao.models.process_inspection import ProcessInspection

    vid = rework_order.verification_inspection_id
    if vid:
        process = await ProcessInspection.get_or_none(
            tenant_id=tenant_id, id=int(vid), deleted_at__isnull=True
        )
        if process:
            return
        fqc = await FinishedGoodsInspection.get_or_none(
            tenant_id=tenant_id, id=int(vid), deleted_at__isnull=True
        )
        if fqc and _norm_status(fqc.status) not in ("待检验", "pending", "draft", ""):
            # 已在 FQC 做过检，不再改挂
            return
        if fqc and _norm_status(fqc.status) in ("待检验", "pending", "draft", ""):
            fqc.deleted_at = resolve_business_datetime()
            await fqc.save(update_fields=["deleted_at"])

    qty = _dec(rework_order.completed_quantity or rework_order.quantity)
    if qty <= 0:
        return
    actor_id = int(rework_order.completion_requested_by or rework_order.updated_by or 0) or 0
    new_id = await _create_process_verification_inspection(
        tenant_id, rework_order, qty, actor_id or 1
    )
    rework_order.verification_inspection_id = new_id
    await rework_order.save(update_fields=["verification_inspection_id"])


async def quality_release(
    tenant_id: int,
    rework_order: ReworkOrder,
    request: ReworkQualityReleaseRequest,
    *,
    actor_id: int,
    actor_name: str,
) -> ReworkOrder:
    ctx = await compute_capability_context(tenant_id, rework_order)
    caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
    assert_rework_order_capability(rework_order, "quality_release", caps)

    async with in_transaction():
        rework_order.status = "quality_released"
        rework_order.quality_released_at = resolve_business_datetime()
        rework_order.quality_released_by = actor_id
        rework_order.quality_released_by_name = actor_name
        rework_order.updated_by = actor_id
        rework_order.updated_by_name = actor_name
        if request.remarks:
            base = (rework_order.remarks or "").strip()
            rework_order.remarks = f"{base}\n质量放行: {request.remarks}".strip()
        await rework_order.save()
        await _writeback_start_operation_after_quality_release(
            tenant_id, rework_order, actor_id=actor_id
        )
    return rework_order


async def close_rework_order(
    tenant_id: int,
    rework_order: ReworkOrder,
    request: ReworkCloseRequest,
    *,
    actor_id: int,
    actor_name: str,
) -> ReworkOrder:
    ctx = await compute_capability_context(tenant_id, rework_order)
    caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
    assert_rework_order_capability(rework_order, "close", caps)

    async with in_transaction():
        rework_order.status = "closed"
        rework_order.closed_at = resolve_business_datetime()
        rework_order.closed_by = actor_id
        rework_order.closed_by_name = actor_name
        rework_order.actual_end_date = rework_order.actual_end_date or resolve_business_datetime()
        rework_order.updated_by = actor_id
        rework_order.updated_by_name = actor_name
        if request.remarks:
            base = (rework_order.remarks or "").strip()
            rework_order.remarks = f"{base}\n关闭: {request.remarks}".strip()
        await rework_order.save()
        await _writeback_source_on_close(tenant_id, rework_order, actor_id)
    return rework_order


async def _writeback_start_operation_after_quality_release(
    tenant_id: int,
    rework_order: ReworkOrder,
    *,
    actor_id: int,
) -> None:
    """
    工序返工质量放行/关闭后回写起始工序：
    - 方案质检（plan）：原过程检验不合格→合格，再 reconcile 工序质量口径
    - 报工不合格（none/simple）：工序 unqualified→qualified（completed 不变）
    使后道可报 = 前道转序合格（含返工挽回）。成品检验来源返工不改工序转序。
    可重复调用：已挽回部分不再扣减。
    """
    if rework_order.source_inspection_id:
        return
    if not rework_order.original_work_order_id:
        return
    qty = _dec(rework_order.completed_quantity or rework_order.quantity)
    if qty <= 0:
        return

    from apps.kuaizhizao.models.process_inspection import ProcessInspection
    from apps.kuaizhizao.services.inspection_policy_service import resolve_inspection_policy
    from apps.kuaizhizao.services.operation_transfer_service import (
        is_rework_verification_process_inspection,
    )
    from apps.kuaizhizao.services.quality_service import ProcessInspectionService
    from apps.kuaizhizao.services.work_order_service import WorkOrderService

    try:
        woo = await _resolve_rework_start_work_order_operation(tenant_id, rework_order)
    except Exception as exc:
        logger.warning("返工放行回写跳过（无起始工序）: rework={} err={}", rework_order.code, exc)
        return

    master_op_id = int(woo.operation_id)
    work_order_id = int(rework_order.original_work_order_id)
    remaining = qty

    # 优先消化原检验单不合格；按 id 升序稳定回写
    insp_rows = (
        await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=master_op_id,
            deleted_at__isnull=True,
        )
        .order_by("id")
        .all()
    )
    for insp in insp_rows:
        if remaining <= 0:
            break
        if is_rework_verification_process_inspection(insp):
            continue
        u = _dec(insp.unqualified_quantity)
        if u <= 0:
            continue
        take = min(remaining, u)
        insp.unqualified_quantity = u - take
        insp.qualified_quantity = _dec(insp.qualified_quantity) + take
        await insp.save(
            update_fields=["unqualified_quantity", "qualified_quantity", "updated_at"]
        )
        remaining -= take

    # 复检单本身不参与前道转序合计；放行后软删，避免列表干扰
    vid = rework_order.verification_inspection_id
    if vid and not _uses_finished_goods_verification(rework_order):
        v_insp = await ProcessInspection.get_or_none(
            tenant_id=tenant_id, id=int(vid), deleted_at__isnull=True
        )
        if v_insp and is_rework_verification_process_inspection(v_insp):
            v_insp.deleted_at = resolve_business_datetime()
            await v_insp.save(update_fields=["deleted_at"])

    ipqc_mode, _, _ = await resolve_inspection_policy(
        tenant_id, "ipqc", operation_id=master_op_id
    )

    try:
        await ProcessInspectionService()._reconcile_operation_quality_after_inspection(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=master_op_id,
        )
    except Exception as exc:
        logger.warning(
            "返工放行后过程检验回写工序失败: rework={} wo={} err={}",
            rework_order.code,
            work_order_id,
            exc,
        )

    # none/simple：报工不合格挂在工序上，检验 reconcile 不会改；此处转入合格
    if ipqc_mode != "plan":
        woo = await WorkOrderOperation.get_or_none(
            tenant_id=tenant_id, id=woo.id, deleted_at__isnull=True
        )
        if woo is not None:
            take_op = recoverable_report_unqualified_take(qty, woo.unqualified_quantity)
            if take_op > 0:
                woo.unqualified_quantity = _dec(woo.unqualified_quantity) - take_op
                woo.qualified_quantity = _dec(woo.qualified_quantity) + take_op
                await woo.save(
                    update_fields=[
                        "unqualified_quantity",
                        "qualified_quantity",
                        "updated_at",
                    ]
                )
                remaining = max(Decimal("0"), remaining - take_op)
                logger.info(
                    "返工已挽回报工不合格: rework={} wo={} op={} take={}",
                    rework_order.code,
                    work_order_id,
                    master_op_id,
                    take_op,
                )

    try:
        await WorkOrderService().refresh_work_order_operation_transfer_state(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
        )
    except Exception as exc:
        logger.warning(
            "返工放行后刷新工序转序失败: rework={} wo={} err={}",
            rework_order.code,
            work_order_id,
            exc,
        )
    logger.info(
        "返工质量放行已回写前道可转序: rework={} wo={} op={} qty={} leftover={}",
        rework_order.code,
        work_order_id,
        master_op_id,
        qty,
        remaining,
    )


async def _writeback_source_on_close(
    tenant_id: int,
    rework_order: ReworkOrder,
    actor_id: int,
) -> None:
    """关闭时回写原工单返工数量并建立追溯关联。"""
    if not rework_order.original_work_order_id:
        return
    # 若尚未质量放行就关闭（极少路径），补做工序回写
    close_qty = _dec(rework_order.completed_quantity or rework_order.quantity)
    if (
        not rework_order.source_inspection_id
        and close_qty > 0
        and str(rework_order.status or "") == "closed"
    ):
        await _writeback_start_operation_after_quality_release(
            tenant_id, rework_order, actor_id=actor_id
        )
    try:
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        wo = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=rework_order.original_work_order_id,
            deleted_at__isnull=True,
        )
        if not wo:
            return
        rel_svc = DocumentRelationNewService()
        await rel_svc.create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type="rework_order",
                source_id=rework_order.id,
                source_code=rework_order.code,
                source_name=rework_order.product_name,
                target_type="work_order",
                target_id=wo.id,
                target_code=wo.code,
                target_name=wo.name,
                relation_type="close",
                relation_mode="writeback",
                relation_desc="返工单关闭回写原工单",
            ),
            created_by=actor_id,
        )
    except Exception as e:
        logger.warning("返工单关闭回写关联失败: %s", e)


async def cancel_rework_order(
    tenant_id: int,
    rework_order: ReworkOrder,
    request: ReworkCancelRequest,
    *,
    actor_id: int,
    actor_name: str,
) -> ReworkOrder:
    ctx = await compute_capability_context(tenant_id, rework_order)
    caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
    assert_rework_order_capability(rework_order, "cancel", caps)

    async with in_transaction():
        rework_order.status = "cancelled"
        rework_order.updated_by = actor_id
        rework_order.updated_by_name = actor_name
        if request.reason:
            base = (rework_order.remarks or "").strip()
            rework_order.remarks = f"{base}\n取消: {request.reason}".strip()
        await rework_order.save()
    return rework_order


async def hold_rework_order(
    tenant_id: int,
    rework_order: ReworkOrder,
    request: ReworkHoldRequest,
    *,
    actor_id: int,
    actor_name: str,
) -> Tuple[ReworkOrder, str]:
    ctx = await compute_capability_context(tenant_id, rework_order)
    caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
    assert_rework_order_capability(rework_order, "hold", caps)

    previous_status = rework_order.status
    async with in_transaction():
        rework_order.hold_previous_status = previous_status
        rework_order.status = "on_hold"
        rework_order.on_hold_at = resolve_business_datetime()
        rework_order.on_hold_by = actor_id
        rework_order.on_hold_by_name = actor_name
        rework_order.updated_by = actor_id
        rework_order.updated_by_name = actor_name
        if request.reason:
            base = (rework_order.remarks or "").strip()
            rework_order.remarks = f"{base}\n暂停: {request.reason}".strip()
        await rework_order.save()
    return rework_order, previous_status


async def resume_rework_order(
    tenant_id: int,
    rework_order: ReworkOrder,
    *,
    actor_id: int,
    actor_name: str,
    previous_status: str = "in_progress",
) -> ReworkOrder:
    ctx = await compute_capability_context(tenant_id, rework_order)
    caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
    assert_rework_order_capability(rework_order, "resume", caps)

    restore_status = rework_order.hold_previous_status or "in_progress"
    async with in_transaction():
        rework_order.status = restore_status if restore_status not in ("on_hold", "cancelled", "closed") else "in_progress"
        rework_order.hold_previous_status = None
        rework_order.updated_by = actor_id
        rework_order.updated_by_name = actor_name
        await rework_order.save()
    return rework_order


async def after_rework_report_approved(
    tenant_id: int,
    rework_order_id: int,
    rework_operation_link_id: int,
    *,
    actor_id: int,
    actor_name: str,
) -> None:
    """报工审核通过后推进工序与返工单状态。"""
    rework_order = await ReworkOrder.get_or_none(
        tenant_id=tenant_id,
        id=rework_order_id,
        deleted_at__isnull=True,
    )
    if not rework_order:
        return
    link = await ReworkOrderOperation.get_or_none(
        tenant_id=tenant_id,
        id=rework_operation_link_id,
    )
    if not link:
        return

    await sync_link_quantities_from_reports(tenant_id, link)
    if rework_order.status == "released":
        rework_order.status = "in_progress"
        rework_order.actual_start_date = rework_order.actual_start_date or resolve_business_datetime()

    link = await complete_operation_link(tenant_id, link)
    if _norm_status(link.status) == OPERATION_STATUS_COMPLETED:
        if rework_order.routing_mode == ROUTING_MODE_PREDEFINED:
            advanced = await try_advance_predefined_route(
                tenant_id,
                rework_order,
                actor_id=actor_id,
                actor_name=actor_name,
            )
            if not advanced:
                rework_order.current_operation_link_id = None
        else:
            rework_order.current_operation_link_id = None

    rework_order.updated_by = actor_id
    rework_order.updated_by_name = actor_name
    await rework_order.save()


async def build_operation_items(
    tenant_id: int,
    rework_order: ReworkOrder,
) -> List[Dict[str, Any]]:
    links = await load_operation_links(tenant_id, rework_order.id)
    op_ids = [l.work_order_operation_id for l in links]
    ops = await WorkOrderOperation.filter(
        tenant_id=tenant_id,
        id__in=op_ids,
        deleted_at__isnull=True,
    ).all() if op_ids else []
    op_map = {op.id: op for op in ops}
    items = []
    for link in links:
        op = op_map.get(link.work_order_operation_id)
        await sync_link_quantities_from_reports(tenant_id, link)
        items.append(
            {
                "id": link.id,
                "work_order_operation_id": link.work_order_operation_id,
                "operation_code": op.operation_code if op else None,
                "operation_name": op.operation_name if op else None,
                "sequence": link.sequence,
                "role": link.role,
                "status": link.status,
                "input_quantity": link.input_quantity,
                "qualified_quantity": link.qualified_quantity,
                "unqualified_quantity": link.unqualified_quantity,
                "started_at": link.started_at,
                "completed_at": link.completed_at,
                "decision_reason": link.decision_reason,
                "decided_by_name": link.decided_by_name,
                "decided_at": link.decided_at,
                "is_start": link.role == OPERATION_ROLE_START or link.sequence == 0,
                "is_current": link.id == rework_order.current_operation_link_id,
            }
        )
    return items


async def sync_route_on_create(
    tenant_id: int,
    rework_order_id: int,
    *,
    routing_mode: str,
    start_work_order_operation_id: int,
    predefined_operation_ids: Optional[List[int]],
    quantity: Decimal,
) -> None:
    await ReworkOrderOperation.filter(
        tenant_id=tenant_id,
        rework_order_id=rework_order_id,
    ).delete()

    if routing_mode == ROUTING_MODE_PREDEFINED and predefined_operation_ids:
        for idx, op_id in enumerate(predefined_operation_ids):
            role = OPERATION_ROLE_START if idx == 0 else OPERATION_ROLE_PLANNED
            await ReworkOrderOperation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                rework_order_id=rework_order_id,
                work_order_operation_id=op_id,
                sequence=idx,
                role=role,
                status=OPERATION_STATUS_PENDING,
                input_quantity=quantity if idx == 0 else None,
            )
    else:
        await ReworkOrderOperation.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            rework_order_id=rework_order_id,
            work_order_operation_id=start_work_order_operation_id,
            sequence=0,
            role=OPERATION_ROLE_START,
            status=OPERATION_STATUS_PENDING,
            input_quantity=quantity,
        )
