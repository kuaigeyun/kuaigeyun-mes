"""仓库解析：主仓 / 线边仓（配料、叫料共用）。"""

from __future__ import annotations

from typing import Optional, Tuple

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.master_data.models.warehouse import Warehouse
from infra.exceptions.exceptions import BusinessLogicError, ValidationError

async def resolve_source_warehouse_for_work_order(
    tenant_id: int,
    work_order: Optional[WorkOrder],
    explicit_warehouse_id: Optional[int] = None,
) -> Tuple[int, str]:
    if explicit_warehouse_id:
        wh = await Warehouse.get_or_none(
            id=explicit_warehouse_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if wh:
            return wh.id, wh.name or ""
    qn = Warehouse.filter(
        tenant_id=tenant_id, is_active=True, deleted_at__isnull=True, warehouse_type="normal"
    )
    wh = None
    if work_order and getattr(work_order, "workshop_id", None):
        wh = await qn.filter(workshop_id=work_order.workshop_id).order_by("id").first()
    if not wh:
        wh = await qn.order_by("id").first()
    if not wh:
        wh = (
            await Warehouse.filter(
                tenant_id=tenant_id,
                is_active=True,
                deleted_at__isnull=True,
                warehouse_type__in=["normal", "wip"],
            )
            .order_by("id")
            .first()
        )
    if not wh:
        raise BusinessLogicError("未找到可用主仓，请维护普通仓库或指定来源仓库")
    return wh.id, wh.name or ""


async def resolve_inbound_warehouse_for_purchase_push(
    tenant_id: int,
    *,
    material_id: Optional[int] = None,
    explicit_warehouse_id: Optional[int] = None,
) -> Tuple[int, str]:
    """
    采购下推收货通知/入库的行级入库仓库：
    显式指定 → 物料默认仓库 → 租户首个启用 normal 仓 → 任意启用仓。
    """
    from apps.master_data.services.material_service import (
        resolve_primary_default_warehouse_from_material,
    )

    if explicit_warehouse_id:
        wh = await Warehouse.get_or_none(
            id=int(explicit_warehouse_id),
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        )
        if wh:
            return wh.id, wh.name or ""

    if material_id:
        material_wh = await resolve_primary_default_warehouse_from_material(
            tenant_id,
            material_id=int(material_id),
        )
        if material_wh:
            return material_wh

    wh = await Warehouse.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
        warehouse_type="normal",
    ).order_by("id").first()
    if wh:
        return wh.id, wh.name or ""

    wh = await Warehouse.filter(
        tenant_id=tenant_id,
        is_active=True,
        deleted_at__isnull=True,
    ).order_by("id").first()
    if wh:
        return wh.id, wh.name or ""

    raise ValidationError("未配置可用入库仓库，请先在主数据维护仓库或为物料指定默认仓库")


async def resolve_line_side_warehouse_for_work_order(
    tenant_id: int,
    work_order: Optional[WorkOrder],
    explicit_target_id: Optional[int] = None,
) -> Tuple[int, str]:
    if explicit_target_id:
        wh = await Warehouse.get_or_none(
            id=explicit_target_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        )
        if wh:
            return wh.id, wh.name or ""
        raise BusinessLogicError(f"目标仓库不存在或已停用: {explicit_target_id}")
    ql = Warehouse.filter(
        tenant_id=tenant_id, is_active=True, deleted_at__isnull=True, warehouse_type="line_side"
    )
    wh = None
    if work_order and getattr(work_order, "work_center_id", None):
        wh = await ql.filter(work_center_id=work_order.work_center_id).order_by("id").first()
    if not wh and work_order and getattr(work_order, "workshop_id", None):
        # 优先车间级（无工位/工作中心），避免历史工位级线边仓抢默认目标
        wh = await ql.filter(
            workshop_id=work_order.workshop_id,
            workstation_id__isnull=True,
            work_center_id__isnull=True,
        ).order_by("id").first()
        if not wh:
            wh = await ql.filter(
                workshop_id=work_order.workshop_id,
                workstation_id__isnull=True,
            ).order_by("id").first()
        if not wh:
            wh = await ql.filter(workshop_id=work_order.workshop_id).order_by("id").first()
    if not wh:
        wh = await ql.filter(workstation_id__isnull=True).order_by("id").first()
    if not wh:
        wh = await ql.order_by("id").first()
    if not wh:
        raise BusinessLogicError(
            "未找到线边仓，请维护 warehouse_type=line_side 的仓库",
            details={"reason": "line_side_warehouse_not_found"},
        )
    return wh.id, wh.name or ""
