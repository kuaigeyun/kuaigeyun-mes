"""
工单工序跳转与节点工序校验（允许跳转时节点仍不可跳过）
"""

from decimal import Decimal
from typing import Any, List, Optional

from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from infra.exceptions.exceptions import BusinessLogicError


def effective_allow_jump(work_order: Any, work_order_operation: Optional[WorkOrderOperation] = None) -> bool:
    """仅工单快照 allow_operation_jump 决定；工序行 allow_jump 已废弃不参与计算。"""
    return bool(getattr(work_order, "allow_operation_jump", False))


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
        if Decimal(str(n.completed_quantity or 0)) <= 0:
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
    - 数量报工：累计报工不可超过任一前序节点工序的完成数量
    - 状态报工且报完成：前序节点工序须均已 completed
    """
    nodes = await list_node_predecessors(tenant_id, work_order_id, work_order_operation.sequence)
    if not nodes:
        return

    if reporting_type == "status":
        if reported_quantity == 1:
            for n in nodes:
                if n.status != "completed":
                    raise BusinessLogicError(
                        f"节点工序不可跳过：请先完成前序节点工序「{n.operation_name}」后再将当前工序报为完成"
                    )
        return

    current_completed = Decimal(str(work_order_operation.completed_quantity or 0))
    new_total = current_completed + reported_quantity
    for n in nodes:
        n_done = Decimal(str(n.completed_quantity or 0))
        if new_total > n_done:
            raise BusinessLogicError(
                f"节点工序不可跳过：当前工序累计报工数量（{new_total}）不能超过"
                f"前序节点工序「{n.operation_name}」的报工数量（{n_done}）"
            )
