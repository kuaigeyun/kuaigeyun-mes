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
    ipqc_inspection_passed_for_transfer,
    resolve_inspection_policy,
    resolve_ipqc_plan_label_for_operation,
)


async def sum_plan_transfer_qualified_from_inspections(
    tenant_id: int,
    inspections: List[Any],
) -> Decimal:
    total = Decimal("0")
    for insp in inspections:
        if await ipqc_inspection_passed_for_transfer(tenant_id, insp):
            total += Decimal(str(getattr(insp, "qualified_quantity", None) or 0))
    return total


async def resolve_operation_transfer_qualified(
    tenant_id: int,
    work_order_id: int,
    woo: WorkOrderOperation,
    *,
    policy_cache: Optional[Dict[int, Tuple[str, Optional[int], str]]] = None,
    inspections_by_op: Optional[Dict[int, List[Any]]] = None,
) -> Decimal:
    """本道工序可转下道的合格数量（方案质检须过程检验放行后计入）。"""
    master_op_id = int(woo.operation_id) if woo.operation_id is not None else 0
    if master_op_id <= 0:
        return Decimal(str(woo.qualified_quantity or 0))

    cache = policy_cache if policy_cache is not None else {}
    if master_op_id not in cache:
        cache[master_op_id] = await resolve_inspection_policy(
            tenant_id, "ipqc", operation_id=master_op_id
        )
    mode, _, _ = cache[master_op_id]

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

    return await sum_plan_transfer_qualified_from_inspections(tenant_id, inspections)


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
    cache: Dict[int, Tuple[str, Optional[int], str]] = {}
    for op_id in operation_ids:
        if op_id is None:
            continue
        oid = int(op_id)
        if oid not in cache:
            cache[oid] = await resolve_inspection_policy(tenant_id, "ipqc", operation_id=oid)
    return cache


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
