"""
工单齐套率持久化服务

- 计算口径与 get_work_order_kitting_analysis / 库位与叫料弹窗一致
- 结果写入 work_orders.readiness_rate，并缓存 readiness_component_ids 供库存变动定向刷新
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from decimal import Decimal
from typing import Iterable, List, Optional, Sequence

from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.work_order import WorkOrderKittingAnalysisResponse
from core.utils.timezone_utils import now_utc

READINESS_ACTIVE_STATUSES = ("draft", "released", "in_progress", "草稿", "已下达", "执行中")

_DEBOUNCE_SECONDS = 2.0
_pending_materials: dict[int, set[int]] = defaultdict(set)
_pending_tasks: dict[int, asyncio.Task] = {}
_pending_lock = asyncio.Lock()


def _fixed_rate_for_status(status: str) -> Optional[float]:
    if status in ("completed", "已完成"):
        return 100.0
    if status in ("cancelled", "已取消"):
        return 0.0
    if status in ("split", "已拆分"):
        return None
    return None


def _needs_bom_readiness(status: str) -> bool:
    return status in READINESS_ACTIVE_STATUSES


async def persist_kitting_analysis_result(
    tenant_id: int,
    work_order_id: int,
    analysis: WorkOrderKittingAnalysisResponse,
) -> None:
    """将齐套分析结果写入工单持久化字段（与列表齐套率、弹窗同一口径）。"""
    component_ids = sorted(
        {int(item.material_id) for item in analysis.items if item.kitting_applicable}
    )
    await WorkOrder.filter(
        tenant_id=tenant_id,
        id=work_order_id,
        deleted_at__isnull=True,
    ).update(
        readiness_rate=analysis.kitting_rate,
        readiness_component_ids=component_ids,
        readiness_rate_updated_at=now_utc(),
    )


class WorkOrderReadinessService:
    """工单齐套率计算与持久化"""

    async def compute_and_persist(
        self,
        tenant_id: int,
        work_orders: Sequence[WorkOrder],
        inventory_map=None,
        wo_requirements_map=None,
    ) -> None:
        if not work_orders:
            return

        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        wo_svc = WorkOrderService()
        now = now_utc()

        for wo in work_orders:
            fixed = _fixed_rate_for_status(wo.status or "")
            if fixed is not None:
                wo.readiness_rate = Decimal(str(fixed))
                wo.readiness_component_ids = []
                wo.readiness_rate_updated_at = now
                await wo.save(
                    update_fields=[
                        "readiness_rate",
                        "readiness_component_ids",
                        "readiness_rate_updated_at",
                    ]
                )
                continue

            if not _needs_bom_readiness(wo.status or ""):
                wo.readiness_rate = None
                wo.readiness_component_ids = []
                wo.readiness_rate_updated_at = now
                await wo.save(
                    update_fields=[
                        "readiness_rate",
                        "readiness_component_ids",
                        "readiness_rate_updated_at",
                    ]
                )
                continue

            try:
                await wo_svc.get_work_order_kitting_analysis(tenant_id, wo.id)
            except Exception as exc:
                logger.warning(f"工单 {wo.id} 齐套率计算失败: {exc}")
                wo.readiness_rate = None
                wo.readiness_component_ids = []
                wo.readiness_rate_updated_at = now
                await wo.save(
                    update_fields=[
                        "readiness_rate",
                        "readiness_component_ids",
                        "readiness_rate_updated_at",
                    ]
                )

    async def refresh_work_orders(
        self,
        tenant_id: int,
        work_order_ids: Iterable[int],
    ) -> int:
        ids = [int(i) for i in work_order_ids if i is not None]
        if not ids:
            return 0
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).all()
        if not work_orders:
            return 0
        await self.compute_and_persist(tenant_id, work_orders)
        return len(work_orders)

    async def refresh_for_materials(
        self,
        tenant_id: int,
        material_ids: Iterable[int],
    ) -> int:
        material_id_set = {int(m) for m in material_ids if m is not None}
        if not material_id_set:
            return 0

        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=list(READINESS_ACTIVE_STATUSES),
        ).all()

        affected: List[WorkOrder] = []
        for wo in work_orders:
            comp_ids = wo.readiness_component_ids or []
            if not comp_ids or material_id_set.intersection(comp_ids):
                affected.append(wo)

        if not affected:
            return 0
        await self.compute_and_persist(tenant_id, affected)
        return len(affected)

    async def schedule_refresh_for_materials(self, tenant_id: int, material_id: int) -> None:
        if material_id is None:
            return
        async with _pending_lock:
            _pending_materials[tenant_id].add(int(material_id))
            existing = _pending_tasks.get(tenant_id)
            if existing is not None and not existing.done():
                return
            _pending_tasks[tenant_id] = asyncio.create_task(
                _flush_debounced_material_refresh(tenant_id),
                name=f"wo-readiness-refresh-tenant-{tenant_id}",
            )

    async def schedule_refresh_work_order(self, tenant_id: int, work_order_id: int) -> None:
        asyncio.create_task(
            _safe_refresh_work_orders(tenant_id, [work_order_id]),
            name=f"wo-readiness-refresh-{work_order_id}",
        )


async def _flush_debounced_material_refresh(tenant_id: int) -> None:
    await asyncio.sleep(_DEBOUNCE_SECONDS)
    async with _pending_lock:
        material_ids = _pending_materials.pop(tenant_id, set())
        _pending_tasks.pop(tenant_id, None)
    if not material_ids:
        return
    try:
        count = await WorkOrderReadinessService().refresh_for_materials(tenant_id, material_ids)
        if count:
            logger.debug(
                f"库存变动刷新齐套率: tenant={tenant_id} materials={len(material_ids)} work_orders={count}"
            )
    except Exception as exc:
        logger.warning(f"库存变动刷新齐套率失败 tenant={tenant_id}: {exc}")


async def _safe_refresh_work_orders(tenant_id: int, work_order_ids: List[int]) -> None:
    try:
        await WorkOrderReadinessService().refresh_work_orders(tenant_id, work_order_ids)
    except Exception as exc:
        logger.warning(f"工单齐套率刷新失败 ids={work_order_ids}: {exc}")


def notify_inventory_changed(tenant_id: int, material_id: int) -> None:
    """库存变动后调用（异步调度，不阻塞主事务）。"""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(
        WorkOrderReadinessService().schedule_refresh_for_materials(tenant_id, material_id),
        name=f"wo-readiness-schedule-m{material_id}",
    )


async def dispatch_work_order_readiness_refresh(tenant_id: int, work_order_id: int) -> None:
    """工单创建/变更后刷新齐套率（失败不阻断主流程）。"""
    await WorkOrderReadinessService().schedule_refresh_work_order(tenant_id, work_order_id)


def readiness_rate_to_float(wo: WorkOrder) -> Optional[float]:
    raw = getattr(wo, "readiness_rate", None)
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None
