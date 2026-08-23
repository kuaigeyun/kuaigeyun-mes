"""
工单列表树形子行：拆分工单 / 返工单 / 工序委外单挂在原工单下
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Iterable, List, Optional

from apps.kuaizhizao.models.outsource_order import OutsourceOrder
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.work_order import WorkOrderListResponse

def _split_child_response(wo: WorkOrder) -> WorkOrderListResponse:
    item = WorkOrderListResponse.model_validate(wo)
    return item.model_copy(update={"row_kind": "split", "parent_work_order_id": wo.parent_work_order_id})


def _rework_child_response(
    parent_id: int,
    rework: ReworkOrder,
    *,
    rework_operation_names: Optional[str] = None,
) -> WorkOrderListResponse:
    return WorkOrderListResponse(
        id=rework.id,
        uuid=rework.uuid,
        code=rework.code,
        name=rework.rework_type,
        product_name=rework.product_name,
        quantity=rework.quantity,
        production_mode="—",
        status=rework.status,
        planned_start_date=rework.planned_start_date,
        planned_end_date=rework.planned_end_date,
        created_at=rework.created_at,
        row_kind="rework",
        parent_work_order_id=parent_id,
        rework_type=rework.rework_type,
        rework_operation_names=rework_operation_names or None,
    )


def _outsource_child_response(parent_id: int, order: OutsourceOrder) -> WorkOrderListResponse:
    return WorkOrderListResponse(
        id=order.id,
        uuid=order.uuid,
        code=order.code,
        name=order.operation_name,
        product_name=order.operation_name or order.work_order_code,
        quantity=order.outsource_quantity,
        production_mode="—",
        status=order.status,
        planned_start_date=order.planned_start_date,
        planned_end_date=order.planned_end_date,
        created_at=order.created_at,
        row_kind="outsource",
        parent_work_order_id=parent_id,
        operation_name=order.operation_name,
        supplier_name=order.supplier_name,
    )


class WorkOrderTreeService:
    async def attach_tree_children(
        self,
        tenant_id: int,
        roots: Iterable[WorkOrderListResponse],
        *,
        operation_steps_by_wo_id: dict[int, list] | None = None,
        refresh_stale_readiness: bool = True,
    ) -> List[WorkOrderListResponse]:
        root_list = list(roots)
        if not root_list:
            return []

        parent_ids = [r.id for r in root_list if r.id is not None]
        if not parent_ids:
            return [r.model_copy(update={"row_kind": "work_order"}) for r in root_list]

        split_rows = await WorkOrder.filter(
            tenant_id=tenant_id,
            parent_work_order_id__in=parent_ids,
            deleted_at__isnull=True,
        ).order_by("code").all()

        from apps.kuaizhizao.services.work_order_readiness_service import (
            READINESS_ACTIVE_STATUSES,
            WorkOrderReadinessService,
        )

        stale_split_ids = [
            row.id
            for row in split_rows
            if row.id is not None
            and row.readiness_rate is None
            and (row.status or "") in READINESS_ACTIVE_STATUSES
        ]
        if refresh_stale_readiness and stale_split_ids:
            await WorkOrderReadinessService().refresh_work_orders(tenant_id, stale_split_ids)
            split_rows = await WorkOrder.filter(
                tenant_id=tenant_id,
                parent_work_order_id__in=parent_ids,
                deleted_at__isnull=True,
            ).order_by("code").all()

        # 拆分子工单的工序由拆分写入路径 _provision_split_work_order_operations 保证，
        # 历史缺失数据用 scripts/backfill_split_child_operations.py 离线补齐；
        # 列表读路径不再逐子工单补写（原实现为每子工单 2-4 次串行查询且会写库）。

        split_steps_by_id: dict[int, list] = {}
        split_ids = [row.id for row in split_rows if row.id is not None]
        if split_ids:
            from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
            from apps.kuaizhizao.services.work_order_operation_steps import (
                build_work_order_operation_steps,
            )

            split_ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id__in=split_ids,
                deleted_at__isnull=True,
            ).order_by("work_order_id", "sequence").all()
            ops_by_split: dict[int, list] = defaultdict(list)
            for op in split_ops:
                ops_by_split[op.work_order_id].append(op)
            qty_by_split = {row.id: float(row.quantity or 0) for row in split_rows if row.id is not None}
            for sid, ops in ops_by_split.items():
                raw_ops = [
                    {
                        "operation_name": op.operation_name,
                        "sequence": op.sequence,
                        "status": op.status,
                        "qualified_quantity": op.qualified_quantity,
                    }
                    for op in ops
                ]
                split_steps_by_id[sid] = build_work_order_operation_steps(
                    raw_ops,
                    qty_by_split.get(sid, 0),
                )

        rework_rows = await ReworkOrder.filter(
            tenant_id=tenant_id,
            original_work_order_id__in=parent_ids,
            deleted_at__isnull=True,
        ).order_by("code").all()

        rework_op_names_by_rework_id: dict[int, str] = {}
        start_op_ids = [
            row.start_work_order_operation_id
            for row in rework_rows
            if row.start_work_order_operation_id is not None
        ]
        if start_op_ids:
            from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

            start_ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                id__in=start_op_ids,
                deleted_at__isnull=True,
            ).all()
            start_op_name_by_id = {
                op.id: (op.operation_name or op.operation_code or "").strip()
                for op in start_ops
                if op.id is not None
            }
            for row in rework_rows:
                if row.id is not None and row.start_work_order_operation_id is not None:
                    name = start_op_name_by_id.get(row.start_work_order_operation_id, "")
                    if name:
                        rework_op_names_by_rework_id[row.id] = name

        outsource_rows = await OutsourceOrder.filter(
            tenant_id=tenant_id,
            work_order_id__in=parent_ids,
            deleted_at__isnull=True,
        ).order_by("code").all()

        splits_by_parent: dict[int, list[WorkOrderListResponse]] = defaultdict(list)
        for row in split_rows:
            if row.parent_work_order_id is not None:
                child = _split_child_response(row)
                if row.id is not None:
                    steps = (
                        (operation_steps_by_wo_id or {}).get(row.id)
                        or split_steps_by_id.get(row.id)
                        or []
                    )
                    if not steps and row.parent_work_order_id is not None:
                        steps = (operation_steps_by_wo_id or {}).get(row.parent_work_order_id, [])
                    if steps:
                        child = child.model_copy(update={"operation_steps": steps})
                splits_by_parent[row.parent_work_order_id].append(child)

        reworks_by_parent: dict[int, list[WorkOrderListResponse]] = defaultdict(list)
        for row in rework_rows:
            if row.original_work_order_id is not None:
                reworks_by_parent[row.original_work_order_id].append(
                    _rework_child_response(
                        row.original_work_order_id,
                        row,
                        rework_operation_names=rework_op_names_by_rework_id.get(row.id or 0),
                    )
                )

        outsources_by_parent: dict[int, list[WorkOrderListResponse]] = defaultdict(list)
        for row in outsource_rows:
            outsources_by_parent[row.work_order_id].append(_outsource_child_response(row.work_order_id, row))

        def _tree_child_sort_key(item: WorkOrderListResponse) -> tuple:
            kind = item.row_kind or "split"
            kind_order = {"split": 0, "rework": 1, "outsource": 2}.get(kind, 3)
            return (kind_order, item.code or "")

        result: List[WorkOrderListResponse] = []
        for root in root_list:
            pid = root.id
            split_children = splits_by_parent.get(pid, []) if pid is not None else []
            children: List[WorkOrderListResponse] = []
            if pid is not None:
                children.extend(split_children)
                children.extend(reworks_by_parent.get(pid, []))
                children.extend(outsources_by_parent.get(pid, []))
            if children:
                children.sort(key=_tree_child_sort_key)
            split_remaining_quantity = None
            if (root.status or "") == "split" and pid is not None:
                allocated = sum(Decimal(str(c.quantity)) for c in split_children)
                split_remaining_quantity = max(Decimal("0"), root.quantity - allocated)
            result.append(
                root.model_copy(
                    update={
                        "row_kind": "work_order",
                        "parent_work_order_id": None,
                        "split_remaining_quantity": split_remaining_quantity,
                        "children": children or None,
                    }
                )
            )
        return result
