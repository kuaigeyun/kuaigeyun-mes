"""
工单工序转下道数量：按质检模式解析可转入下道的合格数量。

- none / simple：报工累计合格数
- plan：仅统计已通过的过程检验单合格数
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.services.inspection_policy_service import (
    batch_get_operation_inspection_stages,
    get_quality_effective_config,
    ipqc_inspection_passed_for_transfer,
    resolve_inspection_policy,
    resolve_ipqc_plan_label_for_operation,
    resolve_ipqc_policy_from_stages,
)


def material_consumed_against_incoming(
    *,
    is_first_operation: bool,
    inspection_mode: str,
    completed: Decimal,
    qualified: Decimal,
    inspection_qualified: Decimal = Decimal("0"),
    inspection_unqualified: Decimal = Decimal("0"),
) -> Decimal:
    """本道已占用的在制数量。

    首道按合格数扣计划在制，本次可报仍由计划完成数封顶。
    后道合格与不良都占用上道转入：上道合格 81、本道 76 合格 + 5 不良时剩余为 0。
    方案质检已出结果时，检验不合格不占转入，允许补报。
    """
    if inspection_mode == "plan" and inspection_qualified + inspection_unqualified > 0:
        consumed = completed - inspection_unqualified
        return consumed if consumed > 0 else Decimal("0")
    if is_first_operation:
        return qualified if qualified > 0 else Decimal("0")
    return completed if completed > 0 else Decimal("0")


def is_rework_verification_process_inspection(inspection: Any) -> bool:
    """返工完修生成的过程复检单：不计入前道转序/卡片不合格，避免与原检验单双计。"""
    code = str(getattr(inspection, "inspection_code", "") or "").strip()
    notes = str(getattr(inspection, "notes", "") or "")
    return code.startswith("PQ-RW-") or "返工复检" in notes


async def sum_plan_transfer_qualified_from_inspections(
    tenant_id: int,
    inspections: List[Any],
    *,
    audit_required: Optional[bool] = None,
) -> Decimal:
    """
    Args:
        audit_required: 「过程检验需审核」开关，同一租户内恒定。调用方在循环外解析后传入，
            避免逐张检验单重复查询审核绑定。
    """
    if audit_required is None and inspections:
        from infra.services.business_config_service import BusinessConfigService

        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "process_inspection"
        )
    total = Decimal("0")
    for insp in inspections:
        if is_rework_verification_process_inspection(insp):
            continue
        if await ipqc_inspection_passed_for_transfer(
            tenant_id, insp, audit_required=audit_required
        ):
            total += Decimal(str(getattr(insp, "qualified_quantity", None) or 0))
    return total


async def resolve_operation_transfer_qualified(
    tenant_id: int,
    work_order_id: int,
    woo: WorkOrderOperation,
    *,
    policy_cache: Optional[Dict[int, Tuple[str, Optional[int], str]]] = None,
    inspections_by_op: Optional[Dict[int, List[Any]]] = None,
    audit_required: Optional[bool] = None,
) -> Decimal:
    """
    本道工序可转下道的合格数量（方案质检须过程检验放行后计入）。

    Args:
        audit_required: 「过程检验需审核」开关；批量调用时由调用方解析一次后透传。
    """
    master_op_id = int(woo.operation_id) if woo.operation_id is not None else 0
    if master_op_id <= 0:
        return Decimal(str(woo.qualified_quantity or 0))

    cache = policy_cache if policy_cache is not None else {}
    if master_op_id not in cache:
        cache[master_op_id] = await resolve_inspection_policy(
            tenant_id, "ipqc", operation_id=master_op_id, work_order_operation=woo
        )
    cfg = await get_quality_effective_config(tenant_id)
    mode, _, _ = resolve_ipqc_for_work_order_operation(cfg, woo, cache[master_op_id])

    reported_qualified = Decimal(str(woo.qualified_quantity or 0))
    if mode != "plan":
        return reported_qualified

    if inspections_by_op is None:
        from apps.kuaizhizao.models.process_inspection import ProcessInspection

        rows = await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=master_op_id,
            deleted_at__isnull=True,
        ).all()
        inspections = list(rows)
    else:
        inspections = inspections_by_op.get(master_op_id, [])

    from apps.kuaizhizao.utils.ipqc_ordered_plans import resolve_ordered_plan_transfer_qualified
    from apps.kuaizhizao.utils.route_step_ipqc import ipqc_plan_ids_from_wo_operation

    return await resolve_ordered_plan_transfer_qualified(
        tenant_id,
        inspections,
        ipqc_plan_ids_from_wo_operation(woo),
        audit_required=audit_required,
    )


async def resolve_operation_display_unqualified(
    tenant_id: int,
    work_order_id: int,
    woo: WorkOrderOperation,
    *,
    policy_cache: Optional[Dict[int, Tuple[str, Optional[int], str]]] = None,
    inspections_by_op: Optional[Dict[int, List[Any]]] = None,
) -> Decimal:
    """工序卡片/工单头展示用不合格数量（与前端 getOperationQualityMetrics 一致）。"""
    master_op_id = int(woo.operation_id) if woo.operation_id is not None else 0
    if master_op_id <= 0:
        return Decimal(str(woo.unqualified_quantity or 0))

    cache = policy_cache if policy_cache is not None else {}
    if master_op_id not in cache:
        cache[master_op_id] = await resolve_inspection_policy(
            tenant_id, "ipqc", operation_id=master_op_id, work_order_operation=woo
        )
    cfg = await get_quality_effective_config(tenant_id)
    mode, _, _ = resolve_ipqc_for_work_order_operation(cfg, woo, cache[master_op_id])

    if mode == "plan":
        if inspections_by_op is None:
            inspections_by_op = await load_process_inspections_by_operation(
                tenant_id, work_order_id
            )
        inspections = inspections_by_op.get(master_op_id, [])
        _, unqualified = sum_process_inspection_quality_quantities(inspections)
        return unqualified

    return Decimal(str(woo.unqualified_quantity or 0))


async def load_process_inspections_by_operation(
    tenant_id: int,
    work_order_id: int,
) -> Dict[int, List[Any]]:
    from apps.kuaizhizao.models.process_inspection import ProcessInspection

    rows = await ProcessInspection.filter(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        deleted_at__isnull=True,
    ).all()
    grouped: Dict[int, List[Any]] = defaultdict(list)
    for row in rows:
        op_id = getattr(row, "operation_id", None)
        if op_id is not None:
            grouped[int(op_id)].append(row)
    return grouped


async def build_operation_policy_cache(
    tenant_id: int,
    operation_ids: List[int],
) -> Dict[int, Tuple[str, Optional[int], str]]:
    """
    批量解析工序过程检验策略。

    固定 2 次查询（租户质量配置 + 工序批量），不随工序数增长；
    判定复用 ``resolve_ipqc_policy_from_stages``，与单条解析同一套语义。
    """
    uniq: List[int] = []
    seen: set[int] = set()
    for op_id in operation_ids:
        if op_id is None:
            continue
        oid = int(op_id)
        if oid in seen:
            continue
        seen.add(oid)
        uniq.append(oid)
    if not uniq:
        return {}
    cfg = await get_quality_effective_config(tenant_id)
    stages_by_op = await batch_get_operation_inspection_stages(tenant_id, uniq)
    return {
        oid: resolve_ipqc_policy_from_stages(cfg, stages_by_op.get(oid))
        for oid in uniq
    }


def resolve_ipqc_for_work_order_operation(
    cfg: Any,
    wo_op: Any,
    master_policy: Tuple[str, Optional[int], str],
) -> Tuple[str, Optional[int], str]:
    """工单工序落章优先，否则使用工序主数据策略缓存。"""
    from apps.kuaizhizao.services.inspection_policy_service import apply_ipqc_stage_gates
    from apps.kuaizhizao.utils.route_step_ipqc import ipqc_policy_from_wo_operation

    snap = ipqc_policy_from_wo_operation(wo_op)
    if snap is not None:
        return apply_ipqc_stage_gates(cfg, snap[0], snap[1], snap[2])
    return master_policy


async def resolve_operation_inspection_plan_label(
    tenant_id: int,
    operation_id: int,
    *,
    mode: Optional[str] = None,
    plan_id: Optional[int] = None,
) -> Optional[str]:
    if mode is None or plan_id is None:
        mode, plan_id, _ = await resolve_inspection_policy(
            tenant_id, "ipqc", operation_id=operation_id
        )
    if mode == "none":
        return None
    if mode == "simple":
        return None
    return await resolve_ipqc_plan_label_for_operation(tenant_id, operation_id, plan_id=plan_id)


def count_pending_process_inspections(inspections: List[Any]) -> int:
    return sum(
        1
        for insp in inspections
        if str(getattr(insp, "status", "") or "").strip() == "待检验"
    )


def sum_process_inspection_quality_quantities(
    inspections: List[Any],
) -> Tuple[Decimal, Decimal]:
    """已执行过程检验单的合格/不合格数量合计（方案质检卡片展示口径）。"""
    qualified = Decimal("0")
    unqualified = Decimal("0")
    for insp in inspections:
        if is_rework_verification_process_inspection(insp):
            continue
        st = str(getattr(insp, "status", "") or "").strip()
        if st not in ("已检验", "已审核"):
            continue
        qualified += Decimal(str(getattr(insp, "qualified_quantity", None) or 0))
        unqualified += Decimal(str(getattr(insp, "unqualified_quantity", None) or 0))
    return qualified, unqualified


def pending_process_inspection_codes(inspections: List[Any], *, limit: int = 5) -> List[str]:
    codes: List[str] = []
    for insp in inspections:
        if str(getattr(insp, "status", "") or "").strip() != "待检验":
            continue
        code = str(getattr(insp, "inspection_code", "") or "").strip()
        if code:
            codes.append(code)
        if len(codes) >= limit:
            break
    return codes


async def resolve_process_inspection_card_status(
    tenant_id: int,
    inspections: List[Any],
    *,
    reported_qualified: Decimal = Decimal("0"),
) -> str:
    """
    方案质检工序卡片状态徽章（仅展示检验执行态，不含合格/不合格判定）。

    仅依据真实过程检验单：无单据时为 not_started（即使已报工），
    避免「列表无单、卡片却显示待检验」的假象。

    Returns:
        not_started | pending | inspected
    """
    _ = reported_qualified  # 保留入参兼容调用方；不再用报工数伪造 pending
    if not inspections:
        return "not_started"

    has_pending = False
    has_inspected = False

    for insp in inspections:
        st = str(getattr(insp, "status", "") or "").strip()
        if st == "待检验":
            has_pending = True
        elif st in ("已检验", "已审核", "已驳回"):
            has_inspected = True

    if has_pending:
        return "pending"
    if has_inspected:
        return "inspected"
    return "not_started"


def resolve_process_inspection_link_id(inspections: List[Any]) -> Optional[int]:
    """工序卡片跳转用：优先待检验单，否则取最新一张。"""
    if not inspections:
        return None
    pending = [
        i for i in inspections if str(getattr(i, "status", "") or "").strip() == "待检验"
    ]
    pool = pending if pending else list(inspections)
    latest = max(pool, key=lambda x: int(getattr(x, "id", 0) or 0))
    lid = getattr(latest, "id", None)
    return int(lid) if lid is not None else None
