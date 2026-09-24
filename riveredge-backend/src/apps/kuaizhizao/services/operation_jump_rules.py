"""
工单工序跳转与节点工序校验（允许跳转时节点仍不可跳过）
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence

from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.services.operation_transfer_service import resolve_operation_transfer_qualified
from infra.exceptions.exceptions import BusinessLogicError


def effective_allow_jump(work_order: Any, work_order_operation: Optional[WorkOrderOperation] = None) -> bool:
    """工单允许跳转，或当前工序行允许跳转，任一为真即放宽上道流转数量校验。"""
    if bool(getattr(work_order, "allow_operation_jump", False)):
        return True
    if work_order_operation is not None and bool(getattr(work_order_operation, "allow_jump", False)):
        return True
    return False


def qualified_transfer_quantity(operation: WorkOrderOperation) -> Decimal:
    """同步回退：报工合格数（调用方应优先使用 qualified_transfer_quantity_async）。"""
    return Decimal(str(getattr(operation, "qualified_quantity", None) or 0))


async def qualified_transfer_quantity_async(
    tenant_id: int,
    work_order_id: int,
    operation: WorkOrderOperation,
    *,
    policy_cache: Optional[Dict[int, Any]] = None,
    inspections_by_op: Optional[Dict[int, List[Any]]] = None,
) -> Decimal:
    """上道工序转入下道的数量（方案质检须过程检验放行后计入）。"""
    return await resolve_operation_transfer_qualified(
        tenant_id,
        work_order_id,
        operation,
        policy_cache=policy_cache,
        inspections_by_op=inspections_by_op,
    )


async def resolve_material_incoming_qty(
    tenant_id: int,
    work_order: Any,
    work_order_operation: WorkOrderOperation,
    *,
    plan_qty: Decimal,
    adjacent_prev_transfer: Decimal,
    ordered_operations: Optional[Sequence[WorkOrderOperation]] = None,
    policy_cache: Optional[Dict[int, Any]] = None,
    inspections_by_op: Optional[Dict[int, List[Any]]] = None,
) -> Decimal:
    """
    本道可用的在制转入上限。

    - 不允许跳转：紧邻上道合格转出（首道为计划数）
    - 允许跳转：不校验紧邻上道流转量，按计划数；若有前序节点工序则取节点转入量最小值
    """
    plan = plan_qty if plan_qty > 0 else Decimal("0")
    if not effective_allow_jump(work_order, work_order_operation):
        return adjacent_prev_transfer if adjacent_prev_transfer > 0 else Decimal("0")

    work_order_id = int(getattr(work_order_operation, "work_order_id", None) or getattr(work_order, "id") or 0)
    current_seq = int(getattr(work_order_operation, "sequence", None) or 0)
    nodes: List[WorkOrderOperation] = []
    if ordered_operations is not None:
        nodes = [
            op
            for op in ordered_operations
            if int(getattr(op, "sequence", None) or 0) < current_seq
            and bool(getattr(op, "is_node_operation", False))
            and getattr(op, "deleted_at", None) is None
        ]
    else:
        nodes = await list_node_predecessors(tenant_id, work_order_id, current_seq)

    if not nodes:
        return plan

    caps: List[Decimal] = []
    for n in nodes:
        caps.append(
            await qualified_transfer_quantity_async(
                tenant_id,
                work_order_id,
                n,
                policy_cache=policy_cache,
                inspections_by_op=inspections_by_op,
            )
        )
    return min(caps) if caps else plan


async def list_node_predecessors(
    tenant_id: int,
    work_order_id: int,
    current_sequence: int,
) -> List[WorkOrderOperation]:
    return await WorkOrderOperation.filter(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        sequence__lt=current_sequence,
        is_node_operation=True,
        deleted_at__isnull=True,
    ).order_by("sequence").all()


async def validate_start_respects_node_operations(
    tenant_id: int,
    work_order_id: int,
    work_order_operation: WorkOrderOperation,
) -> None:
    """允许跳转时：所有前序节点工序须已有产出。"""
    nodes = await list_node_predecessors(tenant_id, work_order_id, work_order_operation.sequence)
    for n in nodes:
        n_transfer = await qualified_transfer_quantity_async(tenant_id, work_order_id, n)
        if n_transfer <= 0:
            raise BusinessLogicError(
                f"节点工序不可跳过：请先完成前序节点工序「{n.operation_name}」后再开始当前工序"
            )


async def validate_reporting_respects_node_operations(
    tenant_id: int,
    work_order_id: int,
    work_order_operation: WorkOrderOperation,
    reporting_type: str,
    reported_quantity: Decimal,
) -> None:
    """
    允许跳转时：
    - 数量报工：累计报工不可超过任一前序节点工序的合格产出
    - 状态报工且报完成：前序节点工序须均已 completed
    """
    nodes = await list_node_predecessors(tenant_id, work_order_id, work_order_operation.sequence)
    if not nodes:
        return

    if reporting_type == "status":
        if reported_quantity > 0:
            for n in nodes:
                if n.status != "completed":
                    raise BusinessLogicError(
                        f"节点工序不可跳过：请先完成前序节点工序「{n.operation_name}」后再将当前工序报为完成"
                    )
        return

    current_completed = Decimal(str(work_order_operation.completed_quantity or 0))
    new_total = current_completed + reported_quantity
    for n in nodes:
        n_transfer = await qualified_transfer_quantity_async(tenant_id, work_order_id, n)
        if new_total > n_transfer:
            raise BusinessLogicError(
                f"节点工序不可跳过：当前工序累计报工数量（{new_total}）不能超过"
                f"前序节点工序「{n.operation_name}」的合格产出（{n_transfer}）"
            )
