"""
左侧菜单徽章计数服务。

- 仅做 COUNT 聚合，不在徽章刷新时触发缺料/延期全量检测（检测留给列表 API / 定时任务）。
- 各业务域并行查询，但 COUNT 经信号量限流，避免打满 Tortoise 连接池（默认 max=10）。
- 徽章只计「待办/进行中」；已完成、已关闭、已取消等终态不得计入（见下方终态集合）。
- COUNT 须与列表相同的数据权限（DataScopeService + manifest data_scope_key）；无 data_scope 的菜单仍计全租户。
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Tuple

from loguru import logger
from tortoise.functions import Sum

from core.utils.timezone_utils import resolve_business_datetime
from apps.kuaizhizao.constants import DocumentStatus
from apps.kuaizhizao.services.exception_service import (
    ACTIVE_EXCEPTION_STATUSES,
    ACTIVE_QUALITY_EXCEPTION_STATUSES,
)
from apps.kuaizhizao.services.menu_badge_scope import (
    RES_CUSTOMER_FOLLOW_UP,
    RES_INBOUND,
    RES_MATERIAL_BORROW,
    RES_MATERIAL_RETURN,
    RES_OTHER_INBOUND,
    RES_OTHER_OUTBOUND,
    RES_OUTBOUND,
    RES_OUTSOURCE_ORDER,
    RES_PURCHASE_ORDER,
    RES_PURCHASE_RETURN,
    RES_QUOTATION,
    RES_REWORK_ORDER,
    RES_SALES_ORDER,
    RES_SALES_RETURN,
    RES_SHIPMENT_NOTICE,
    RES_WORK_ORDER,
    BadgeScopeCtx,
    badge_count,
)
from apps.kuaizhizao.utils.rework_order_constants import (
    ACTIVE_REWORK_ORDER_STATUSES,
    TERMINAL_REWORK_ORDER_STATUSES,
)
from infra.models.user import User

_RV_PENDING = ["待审核", "PENDING", "PENDING_REVIEW"]
BadgeFragment = Dict[str, Any]

# 与 RIVEREDGE_DB_POOL_MAX 默认 10 对齐：徽章 COUNT 最多同时占用 4 个池位
_BADGE_COUNT_SEM = asyncio.Semaphore(4)


async def _gather_counts(*awaitables: Awaitable[Any]) -> Tuple[Any, ...]:
    """并行 COUNT，但经信号量限流，防止菜单徽章打满连接池。"""

    async def _one(aw: Awaitable[Any]) -> Any:
        async with _BADGE_COUNT_SEM:
            return await aw

    return await asyncio.gather(*(_one(a) for a in awaitables))

# 销售/采购等通用单据终态（与 DocumentStatus / 生命周期 closed·completed 对齐）
_DOC_TERMINAL_STATUSES: List[str] = [
    DocumentStatus.COMPLETED.value,
    DocumentStatus.CLOSED.value,
    DocumentStatus.CANCELLED.value,
    DocumentStatus.REJECTED.value,
    "已完成",
    "已关闭",
    "已取消",
    "已驳回",
    "COMPLETED",
    "CLOSED",
    "CANCELLED",
    "REJECTED",
    "FINISHED",
    "finished",
    "closed",
    "cancelled",
    "completed",
]

_WORK_ORDER_TERMINAL: List[str] = [
    "completed",
    "已完成",
    "cancelled",
    "已取消",
    "COMPLETED",
    "CANCELLED",
    "closed",
    "已关闭",
    "CLOSED",
]
_WORK_ORDER_IN_PROGRESS: List[str] = [
    "released",
    "in_progress",
    "已下达",
    "进行中",
    "RELEASED",
    "IN_PROGRESS",
]
_REWORK_TERMINAL: List[str] = sorted(
    set(TERMINAL_REWORK_ORDER_STATUSES)
    | {"已关闭", "已取消", "CLOSED", "CANCELLED", "closed", "cancelled"}
)
_REWORK_IN_PROGRESS: List[str] = sorted(ACTIVE_REWORK_ORDER_STATUSES)


async def _safe_section(name: str, fn: Callable[[], Awaitable[BadgeFragment]]) -> BadgeFragment:
    try:
        return await fn()
    except Exception as e:
        logger.warning(f"menu-badge-counts {name}: {e}")
        return {}


async def _section_work_orders(ctx: BadgeScopeCtx, now: datetime) -> BadgeFragment:
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.rework_order import ReworkOrder

    tid = ctx.tenant_id
    wo_overdue, wo_in_progress, ro_overdue, ro_in_progress = await _gather_counts(
        badge_count(
            WorkOrder.filter(tenant_id=tid, deleted_at__isnull=True, planned_end_date__lt=now).exclude(
                status__in=_WORK_ORDER_TERMINAL
            ),
            ctx,
            RES_WORK_ORDER,
        ),
        badge_count(
            WorkOrder.filter(tenant_id=tid, deleted_at__isnull=True, status__in=_WORK_ORDER_IN_PROGRESS),
            ctx,
            RES_WORK_ORDER,
        ),
        badge_count(
            ReworkOrder.filter(tenant_id=tid, deleted_at__isnull=True, planned_end_date__lt=now).exclude(
                status__in=_REWORK_TERMINAL
            ),
            ctx,
            RES_REWORK_ORDER,
        ),
        badge_count(
            ReworkOrder.filter(tenant_id=tid, deleted_at__isnull=True, status__in=_REWORK_IN_PROGRESS),
            ctx,
            RES_REWORK_ORDER,
        ),
    )
    return {
        "work_order": {"overdue": wo_overdue, "pending": 0, "in_progress": wo_in_progress},
        "rework_order": {"overdue": ro_overdue, "pending": 0, "in_progress": ro_in_progress},
    }


async def _section_exceptions(ctx: BadgeScopeCtx) -> BadgeFragment:
    from apps.kuaizhizao.models.material_shortage_exception import MaterialShortageException
    from apps.kuaizhizao.models.delivery_delay_exception import DeliveryDelayException
    from apps.kuaizhizao.models.quality_exception import QualityException

    tid = ctx.tenant_id
    c1, c2, c3 = await _gather_counts(
        MaterialShortageException.filter(
            tenant_id=tid,
            status__in=ACTIVE_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        ).count(),
        DeliveryDelayException.filter(
            tenant_id=tid,
            status__in=ACTIVE_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        ).count(),
        QualityException.filter(
            tenant_id=tid,
            status__in=ACTIVE_QUALITY_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        ).count(),
    )
    return {
        "material_shortage_exception": {"overdue": 0, "pending": c1, "in_progress": 0},
        "delivery_delay_exception": {"overdue": 0, "pending": c2, "in_progress": 0},
        "quality_exception": {"overdue": 0, "pending": c3, "in_progress": 0},
    }


async def _section_sales(ctx: BadgeScopeCtx, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from apps.kuaizhizao.models.sales_forecast import SalesForecast

    tid = ctx.tenant_id
    so_active = [
        "IN_PROGRESS", "进行中", "APPROVED", "已审核", "CONFIRMED", "已确认",
        "AUDITED", "RELEASED", "执行中",
    ]
    so_overdue, so_pending, so_prog, sf_overdue, sf_pending, sf_prog = await _gather_counts(
        badge_count(
            SalesOrder.filter(tenant_id=tid, deleted_at__isnull=True, delivery_date__lt=now_date).exclude(
                status__in=_DOC_TERMINAL_STATUSES
            ),
            ctx,
            RES_SALES_ORDER,
        ),
        badge_count(
            SalesOrder.filter(
                tenant_id=tid,
                deleted_at__isnull=True,
                review_status__in=["PENDING", "PENDING_REVIEW", "待审核"],
            ).exclude(status__in=["DRAFT", "草稿", *_DOC_TERMINAL_STATUSES]),
            ctx,
            RES_SALES_ORDER,
        ),
        badge_count(
            SalesOrder.filter(tenant_id=tid, deleted_at__isnull=True, status__in=so_active).exclude(
                status__in=_DOC_TERMINAL_STATUSES
            ),
            ctx,
            RES_SALES_ORDER,
        ),
        SalesForecast.filter(tenant_id=tid, deleted_at__isnull=True, end_date__lt=now_date)
        .exclude(status__in=_DOC_TERMINAL_STATUSES)
        .count(),
        SalesForecast.filter(
            tenant_id=tid,
            deleted_at__isnull=True,
            review_status__in=["PENDING", "PENDING_REVIEW", "待审核"],
        )
        .exclude(status__in=["DRAFT", "草稿", *_DOC_TERMINAL_STATUSES])
        .count(),
        SalesForecast.filter(tenant_id=tid, deleted_at__isnull=True, status__in=so_active)
        .exclude(status__in=_DOC_TERMINAL_STATUSES)
        .count(),
    )
    return {
        "sales_order": {"overdue": so_overdue, "pending": so_pending, "in_progress": so_prog},
        "sales_forecast": {"overdue": sf_overdue, "pending": sf_pending, "in_progress": sf_prog},
    }


async def _section_purchase(ctx: BadgeScopeCtx, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder
    from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
    from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
        _INBOUND_PENDING_STATUSES,
    )
    from apps.kuaizhizao.services.purchase_arrival_warning_service import PurchaseArrivalWarningService

    tid = ctx.tenant_id
    po = PurchaseOrder.filter(tenant_id=tid, deleted_at__isnull=True)
    po_terminal = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "关闭"]))
    prq = PurchaseRequisition.filter(tenant_id=tid, deleted_at__isnull=True)
    prq_term = [
        DocumentStatus.CANCELLED.value,
        DocumentStatus.REJECTED.value,
        DocumentStatus.FULL_CONVERTED.value,
        DocumentStatus.CLOSED.value,
        "已取消", "已驳回", "全部转单", "已关闭", "CANCELLED", "REJECTED", "FULL_CONVERTED", "CLOSED",
    ]
    _pr = PurchaseReceipt.filter(tenant_id=tid, deleted_at__isnull=True)
    inbound_term = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "关闭", "已入库"]))

    po_od, po_pending, po_prog, prq_pending, prq_prog, pr_pending, pr_exec = await _gather_counts(
        PurchaseArrivalWarningService().count_overdue_open_lines(tid, current_user=ctx.user),
        badge_count(
            po.filter(review_status__in=["PENDING", "PENDING_REVIEW", "待审核"]).exclude(status__in=po_terminal),
            ctx,
            RES_PURCHASE_ORDER,
        ),
        badge_count(
            po.filter(status__in=[
                "IN_PROGRESS", "进行中", "APPROVED", "已审核", "CONFIRMED", "已确认",
                "AUDITED", "RELEASED", "执行中", "部分入库",
            ]).exclude(status__in=po_terminal),
            ctx,
            RES_PURCHASE_ORDER,
        ),
        prq.filter(review_status__in=[
            ReviewStatus.PENDING.value, "待审核", "PENDING", "PENDING_REVIEW",
        ]).exclude(status__in=prq_term).count(),
        prq.filter(status__in=[
            DocumentStatus.APPROVED.value, "已通过",
            DocumentStatus.PARTIAL_CONVERTED.value, "部分转单",
            DocumentStatus.AUDITED.value, "已审核",
        ]).exclude(status__in=prq_term).count(),
        badge_count(
            _pr.filter(review_status__in=_RV_PENDING).exclude(status__in=inbound_term),
            ctx,
            RES_INBOUND,
        ),
        badge_count(
            _pr.filter(status__in=tuple(_INBOUND_PENDING_STATUSES)).exclude(review_status__in=_RV_PENDING),
            ctx,
            RES_INBOUND,
        ),
    )
    return {
        "purchase_order": {"overdue": po_od, "pending": po_pending, "in_progress": po_prog},
        "purchase_requisition": {"overdue": 0, "pending": prq_pending, "in_progress": prq_prog},
        "inbound": {"overdue": 0, "pending": pr_pending, "in_progress": pr_exec},
    }


async def _section_quality_inspection(ctx: BadgeScopeCtx) -> BadgeFragment:
    from apps.kuaizhizao.models.fai_order import FaiOrder
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from apps.kuaizhizao.models.process_inspection import ProcessInspection
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

    tid = ctx.tenant_id
    c1, c2, c3, fai_pending, fai_prog = await _gather_counts(
        IncomingInspection.filter(tenant_id=tid, deleted_at__isnull=True, status="待检验").count(),
        ProcessInspection.filter(tenant_id=tid, deleted_at__isnull=True, status="待检验").count(),
        FinishedGoodsInspection.filter(tenant_id=tid, deleted_at__isnull=True, status="待检验").count(),
        FaiOrder.filter(tenant_id=tid, deleted_at__isnull=True, status="submitted").count(),
        FaiOrder.filter(
            tenant_id=tid,
            deleted_at__isnull=True,
            status__in=["draft", "in_progress", "rejected"],
        ).count(),
    )
    return {
        "incoming_inspection": {"overdue": 0, "pending": c1, "in_progress": 0},
        "process_inspection": {"overdue": 0, "pending": c2, "in_progress": 0},
        "finished_goods_inspection": {"overdue": 0, "pending": c3, "in_progress": 0},
        "fai_order": {"overdue": 0, "pending": fai_pending, "in_progress": fai_prog},
        "quality_inspection": {
            "overdue": 0,
            "pending": c1 + c2 + c3 + fai_pending,
            "in_progress": fai_prog,
        },
    }


async def _section_equipment_assets(ctx: BadgeScopeCtx) -> BadgeFragment:
    from apps.kuaizhizao.models.equipment import Equipment
    from apps.kuaizhizao.models.mold import Mold
    from apps.kuaizhizao.models.equipment_point_inspection import EquipmentPointInspectionRecord

    tid = ctx.tenant_id
    eq_cnt, mold_cnt, epi_cnt = await _gather_counts(
        Equipment.filter(tenant_id=tid, deleted_at__isnull=True, status__in=["维修中", "校验中"]).count(),
        Mold.filter(tenant_id=tid, deleted_at__isnull=True, status__in=["维修中", "校验中"]).count(),
        EquipmentPointInspectionRecord.filter(
            tenant_id=tid, status="待点检", deleted_at__isnull=True,
        ).count(),
    )
    return {
        "equipment": {"overdue": 0, "pending": 0, "in_progress": eq_cnt},
        "mold": {"overdue": 0, "pending": 0, "in_progress": mold_cnt},
        "equipment_inspection": {"overdue": 0, "pending": epi_cnt, "in_progress": 0},
    }


async def _section_spare_part(ctx: BadgeScopeCtx) -> BadgeFragment:
    from apps.kuaizhizao.models.spare_part import SparePart, SparePartInventory

    tid = ctx.tenant_id
    parts, stock_rows = await _gather_counts(
        SparePart.filter(tenant_id=tid, is_active=True, deleted_at__isnull=True).values_list(
            "id", "safety_stock"
        ),
        SparePartInventory.filter(tenant_id=tid, deleted_at__isnull=True)
        .annotate(total=Sum("stock_quantity"))
        .group_by("spare_part_id")
        .values("spare_part_id", "total"),
    )
    stock_by_part = {int(row["spare_part_id"]): float(row["total"] or 0) for row in stock_rows}
    alert_count = sum(
        1
        for part_id, safety_stock in parts
        if stock_by_part.get(int(part_id), 0) < int(safety_stock or 0)
    )
    return {"spare_part": {"overdue": 0, "pending": alert_count, "in_progress": 0}}


async def _section_warehouse_docs(ctx: BadgeScopeCtx) -> BadgeFragment:
    from apps.kuaizhizao.models.other_inbound import OtherInbound
    from apps.kuaizhizao.models.material_return import MaterialReturn
    from apps.kuaizhizao.models.sales_delivery import SalesDelivery
    from apps.kuaizhizao.models.other_outbound import OtherOutbound
    from apps.kuaizhizao.models.material_borrow import MaterialBorrow
    from apps.kuaizhizao.models.production_picking import ProductionPicking

    tid = ctx.tenant_id
    oi = OtherInbound.filter(tenant_id=tid, deleted_at__isnull=True)
    mr = MaterialReturn.filter(tenant_id=tid, deleted_at__isnull=True)
    sd = SalesDelivery.filter(tenant_id=tid, deleted_at__isnull=True)
    oo = OtherOutbound.filter(tenant_id=tid, deleted_at__isnull=True)
    mb = MaterialBorrow.filter(tenant_id=tid, deleted_at__isnull=True)
    pp = ProductionPicking.filter(tenant_id=tid, deleted_at__isnull=True)

    wh_term = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已出库", "已领料", "已入库", "已归还"]))

    oi_p, oi_x, mr_p, mr_x, sd_p, sd_x, oo_p, oo_x, mb_p, mb_x, pp_p, pp_x = await _gather_counts(
        badge_count(oi.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term), ctx, RES_OTHER_INBOUND),
        badge_count(oi.filter(status="待入库").exclude(review_status__in=_RV_PENDING), ctx, RES_OTHER_INBOUND),
        badge_count(mr.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term), ctx, RES_MATERIAL_RETURN),
        badge_count(mr.filter(status="待归还").exclude(review_status__in=_RV_PENDING), ctx, RES_MATERIAL_RETURN),
        badge_count(sd.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term), ctx, RES_OUTBOUND),
        badge_count(sd.filter(status="待出库").exclude(review_status__in=_RV_PENDING), ctx, RES_OUTBOUND),
        badge_count(oo.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term), ctx, RES_OTHER_OUTBOUND),
        badge_count(oo.filter(status="待出库").exclude(review_status__in=_RV_PENDING), ctx, RES_OTHER_OUTBOUND),
        badge_count(mb.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term), ctx, RES_MATERIAL_BORROW),
        badge_count(mb.filter(status="待借出").exclude(review_status__in=_RV_PENDING), ctx, RES_MATERIAL_BORROW),
        badge_count(pp.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term), ctx, RES_OUTBOUND),
        badge_count(pp.filter(status="待领料").exclude(review_status__in=_RV_PENDING), ctx, RES_OUTBOUND),
    )
    return {
        "other_inbound": {"overdue": 0, "pending": oi_p, "in_progress": oi_x},
        "material_return": {"overdue": 0, "pending": mr_p, "in_progress": mr_x},
        "sales_outbound": {
            "overdue": 0,
            "pending": sd_p + pp_p,
            "in_progress": sd_x + pp_x,
        },
        "other_outbound": {"overdue": 0, "pending": oo_p, "in_progress": oo_x},
        "material_borrow": {"overdue": 0, "pending": mb_p, "in_progress": mb_x},
    }


async def _section_warehouse_ops(ctx: BadgeScopeCtx, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
    from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
    from apps.kuaizhizao.models.stocktaking import Stocktaking
    from apps.kuaizhizao.models.inventory_transfer import InventoryTransfer
    from apps.kuaizhizao.models.assembly_order import AssemblyOrder
    from apps.kuaizhizao.models.disassembly_order import DisassemblyOrder
    from apps.kuaizhizao.models.batching_order import BatchingOrder
    from apps.kuaizhizao.models.customer_material_registration import CustomerMaterialRegistration

    tid = ctx.tenant_id
    dn = DeliveryNotice.filter(tenant_id=tid, deleted_at__isnull=True, is_active=True)

    dn_p, dn_x, dn_od, mc_pending, st_cnt, it_cnt, ao_cnt, do_cnt, bo_cnt, cm_cnt = await _gather_counts(
        dn.filter(status="待发送").count(),
        dn.filter(status="已发送").count(),
        dn.filter(planned_delivery_date__lt=now_date, planned_delivery_date__isnull=False)
        .exclude(status__in=["已签收", "已取消"]).count(),
        MaterialCallRequest.filter(
            tenant_id=tid, deleted_at__isnull=True, is_active=True,
            status__in=["pending", "processing", "partial"],
        ).count(),
        Stocktaking.filter(tenant_id=tid, deleted_at__isnull=True, status__in=["draft", "in_progress"]).count(),
        InventoryTransfer.filter(tenant_id=tid, deleted_at__isnull=True, status__in=["draft", "in_progress"]).count(),
        AssemblyOrder.filter(tenant_id=tid, deleted_at__isnull=True, status__in=["draft", "in_progress"]).count(),
        DisassemblyOrder.filter(tenant_id=tid, deleted_at__isnull=True, status__in=["draft", "in_progress"]).count(),
        BatchingOrder.filter(tenant_id=tid, deleted_at__isnull=True, status__in=["draft", "picking"]).count(),
        CustomerMaterialRegistration.filter(tenant_id=tid, deleted_at__isnull=True, status="pending").count(),
    )
    return {
        "delivery_notice": {"overdue": dn_od, "pending": dn_p, "in_progress": dn_x},
        "material_call": {"overdue": 0, "pending": mc_pending, "in_progress": 0},
        "stocktaking": {"overdue": 0, "pending": st_cnt, "in_progress": 0},
        "inventory_transfer": {"overdue": 0, "pending": it_cnt, "in_progress": 0},
        "assembly_order": {"overdue": 0, "pending": ao_cnt, "in_progress": 0},
        "disassembly_order": {"overdue": 0, "pending": do_cnt, "in_progress": 0},
        "batching_order": {"overdue": 0, "pending": bo_cnt, "in_progress": 0},
        "customer_material_registration": {"overdue": 0, "pending": cm_cnt, "in_progress": 0},
    }


async def _section_sales_docs(ctx: BadgeScopeCtx, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.quotation import Quotation
    from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
    from apps.kuaizhizao.models.purchase_return import PurchaseReturn
    from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
    from apps.kuaizhizao.models.sales_return import SalesReturn

    tid = ctx.tenant_id
    qb = Quotation.filter(tenant_id=tid, deleted_at__isnull=True)
    rn = ReceiptNotice.filter(tenant_id=tid, deleted_at__isnull=True, is_active=True)
    prt = PurchaseReturn.filter(tenant_id=tid, deleted_at__isnull=True)
    sn = ShipmentNotice.filter(tenant_id=tid, deleted_at__isnull=True, is_active=True)
    sr = SalesReturn.filter(tenant_id=tid, deleted_at__isnull=True)

    qb_done = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已接受", "已拒绝", "已转订单"]))
    rn_done = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已入库", "已签收"]))
    sn_done = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已出库", "已签收"]))
    return_done = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已退货", "RETURNED", "returned"]))
    qb_od, qb_p, qb_x, rn_od, rn_p, rn_x, prt_p, prt_x, sn_od, sn_p, sn_x, sr_p, sr_x = await _gather_counts(
        badge_count(
            qb.filter(valid_until__lt=now_date, valid_until__isnull=False).exclude(status__in=qb_done),
            ctx,
            RES_QUOTATION,
        ),
        badge_count(qb.filter(review_status__in=_RV_PENDING).exclude(status__in=qb_done), ctx, RES_QUOTATION),
        badge_count(qb.filter(status="已发送").exclude(review_status__in=_RV_PENDING), ctx, RES_QUOTATION),
        rn.filter(planned_receipt_date__lt=now_date, planned_receipt_date__isnull=False)
        .exclude(status__in=rn_done).count(),
        rn.filter(status="待收货").count(),
        rn.filter(status="已通知").count(),
        badge_count(prt.filter(review_status__in=_RV_PENDING).exclude(status__in=return_done), ctx, RES_PURCHASE_RETURN),
        badge_count(prt.filter(status="待退货").exclude(review_status__in=_RV_PENDING), ctx, RES_PURCHASE_RETURN),
        badge_count(
            sn.filter(planned_ship_date__lt=now_date, planned_ship_date__isnull=False).exclude(status__in=sn_done),
            ctx,
            RES_SHIPMENT_NOTICE,
        ),
        badge_count(sn.filter(status="待发货"), ctx, RES_SHIPMENT_NOTICE),
        badge_count(sn.filter(status="已通知"), ctx, RES_SHIPMENT_NOTICE),
        badge_count(sr.filter(review_status__in=_RV_PENDING).exclude(status__in=return_done), ctx, RES_SALES_RETURN),
        badge_count(sr.filter(status="待退货").exclude(review_status__in=_RV_PENDING), ctx, RES_SALES_RETURN),
    )
    return {
        "quotation": {"overdue": qb_od, "pending": qb_p, "in_progress": qb_x},
        "receipt_notice": {"overdue": rn_od, "pending": rn_p, "in_progress": rn_x},
        "purchase_return": {"overdue": 0, "pending": prt_p, "in_progress": prt_x},
        "shipment_notice": {"overdue": sn_od, "pending": sn_p, "in_progress": sn_x},
        "sales_return": {"overdue": 0, "pending": sr_p, "in_progress": sr_x},
    }


async def _section_misc_ops(ctx: BadgeScopeCtx, now: datetime, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.customer_follow_up import CustomerFollowUp
    from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
    from apps.kuaizhizao.models.equipment_fault import EquipmentFault
    from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan
    from apps.kuaizhizao.models.maintenance_reminder import MaintenanceReminder
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan

    tid = ctx.tenant_id
    ow = OutsourceWorkOrder.filter(tenant_id=tid, deleted_at__isnull=True)
    ow_term = list(dict.fromkeys([*_WORK_ORDER_TERMINAL, *_DOC_TERMINAL_STATUSES]))
    ef = EquipmentFault.filter(tenant_id=tid, deleted_at__isnull=True)
    mp = MaintenancePlan.filter(tenant_id=tid, deleted_at__isnull=True)
    mp_term = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已完成", "已取消"]))

    cfu_od, ow_od, ow_p, ow_x, ef_p, ef_x, mp_od, mp_p, mp_x, mrem, ip_cnt = await _gather_counts(
        badge_count(
            CustomerFollowUp.filter(
                tenant_id=tid,
                deleted_at__isnull=True,
                next_follow_up_at__isnull=False,
                next_follow_up_at__lt=now,
            ),
            ctx,
            RES_CUSTOMER_FOLLOW_UP,
        ),
        badge_count(
            ow.filter(planned_end_date__lt=now, planned_end_date__isnull=False).exclude(status__in=ow_term),
            ctx,
            RES_OUTSOURCE_ORDER,
        ),
        badge_count(ow.filter(status="draft"), ctx, RES_OUTSOURCE_ORDER),
        badge_count(
            ow.filter(status__in=["released", "in_progress", "已下达", "进行中"]),
            ctx,
            RES_OUTSOURCE_ORDER,
        ),
        ef.filter(status="待处理").count(),
        ef.filter(status="处理中").count(),
        mp.filter(planned_end_date__lt=now, planned_end_date__isnull=False)
        .exclude(status__in=mp_term).count(),
        mp.filter(status__in=["草稿", "已发布"]).count(),
        mp.filter(status="执行中").count(),
        MaintenanceReminder.filter(tenant_id=tid, deleted_at__isnull=True, is_handled=False).count(),
        InspectionPlan.filter(tenant_id=tid, deleted_at__isnull=True, is_active=False).count(),
    )
    return {
        "customer_follow_up": {"overdue": cfu_od, "pending": 0, "in_progress": 0},
        "outsource_work_order": {"overdue": ow_od, "pending": ow_p, "in_progress": ow_x},
        # 装箱绑定为已发生记录，无「待办」状态；不得把历史绑定总量当成徽章
        "packing_binding": {"overdue": 0, "pending": 0, "in_progress": 0},
        "equipment_fault": {"overdue": 0, "pending": ef_p, "in_progress": ef_x},
        "maintenance_plan": {"overdue": mp_od, "pending": mp_p, "in_progress": mp_x},
        "maintenance_reminder": {"overdue": 0, "pending": mrem, "in_progress": 0},
        "inspection_plan": {"overdue": 0, "pending": ip_cnt, "in_progress": 0},
    }


async def _section_finance(ctx: BadgeScopeCtx, now_date) -> BadgeFragment:
    from apps.kuaicaiwu.models.receivable import Receivable
    from apps.kuaicaiwu.models.payable import Payable
    from apps.kuaicaiwu.models.receipt import Receipt
    from apps.kuaicaiwu.models.payment import Payment

    tid = ctx.tenant_id
    recv_pending, pay_pending, recv_voucher, pay_voucher, recv_overdue = await _gather_counts(
        Receivable.filter(tenant_id=tid, deleted_at__isnull=True, remaining_amount__gt=0).count(),
        Payable.filter(tenant_id=tid, deleted_at__isnull=True, remaining_amount__gt=0).count(),
        Receipt.filter(tenant_id=tid, deleted_at__isnull=True, unsettled_amount__gt=0)
        .exclude(status="Cancelled").count(),
        Payment.filter(tenant_id=tid, deleted_at__isnull=True, unsettled_amount__gt=0)
        .exclude(status="Cancelled").count(),
        Receivable.filter(
            tenant_id=tid,
            deleted_at__isnull=True,
            remaining_amount__gt=0,
            due_date__lt=now_date,
            due_date__isnull=False,
        ).count(),
    )
    return {
        "finance_settlement": {
            "overdue": recv_overdue,
            "pending": recv_pending + pay_pending,
            "in_progress": recv_voucher + pay_voucher,
        },
    }


async def fetch_menu_badge_counts(tenant_id: int, user: User) -> dict:
    from apps.kuaizhizao.services.menu_badge_counts_extended import fetch_extended_menu_badge_counts

    ctx = BadgeScopeCtx(tenant_id=tenant_id, user=user)
    now = resolve_business_datetime()
    now_date = now.date()

    sections = await asyncio.gather(
        _safe_section("work_orders", lambda: _section_work_orders(ctx, now)),
        _safe_section("exceptions", lambda: _section_exceptions(ctx)),
        _safe_section("sales", lambda: _section_sales(ctx, now_date)),
        _safe_section("purchase", lambda: _section_purchase(ctx, now_date)),
        _safe_section("quality_inspection", lambda: _section_quality_inspection(ctx)),
        _safe_section("equipment_assets", lambda: _section_equipment_assets(ctx)),
        _safe_section("spare_part", lambda: _section_spare_part(ctx)),
        _safe_section("warehouse_docs", lambda: _section_warehouse_docs(ctx)),
        _safe_section("warehouse_ops", lambda: _section_warehouse_ops(ctx, now_date)),
        _safe_section("sales_docs", lambda: _section_sales_docs(ctx, now_date)),
        _safe_section("misc_ops", lambda: _section_misc_ops(ctx, now, now_date)),
        _safe_section("finance", lambda: _section_finance(ctx, now_date)),
        _safe_section("extended", lambda: fetch_extended_menu_badge_counts(ctx, now, now_date)),
    )

    counts: dict = {}
    for fragment in sections:
        counts.update(fragment)
    return counts
