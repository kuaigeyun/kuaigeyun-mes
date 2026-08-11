"""
左侧菜单徽章计数服务。

- 仅做 COUNT 聚合，不在徽章刷新时触发缺料/延期全量检测（检测留给列表 API / 定时任务）。
- 各业务域并行查询，避免串行 await 放大延迟。
- 徽章只计「待办/进行中」；已完成、已关闭、已取消等终态不得计入（见下方终态集合）。
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List

from loguru import logger
from tortoise.functions import Sum

from core.utils.timezone_utils import resolve_business_datetime
from apps.kuaizhizao.constants import DocumentStatus
from apps.kuaizhizao.services.exception_service import (
    ACTIVE_EXCEPTION_STATUSES,
    ACTIVE_QUALITY_EXCEPTION_STATUSES,
)
from apps.kuaizhizao.utils.rework_order_constants import (
    ACTIVE_REWORK_ORDER_STATUSES,
    TERMINAL_REWORK_ORDER_STATUSES,
)

_RV_PENDING = ["待审核", "PENDING", "PENDING_REVIEW"]
BadgeFragment = Dict[str, Any]

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


async def _section_work_orders(tenant_id: int, now: datetime) -> BadgeFragment:
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.rework_order import ReworkOrder

    wo_overdue, wo_in_progress, ro_overdue, ro_in_progress = await asyncio.gather(
        WorkOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, planned_end_date__lt=now,
        ).exclude(status__in=_WORK_ORDER_TERMINAL).count(),
        WorkOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=_WORK_ORDER_IN_PROGRESS,
        ).count(),
        ReworkOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, planned_end_date__lt=now,
        ).exclude(status__in=_REWORK_TERMINAL).count(),
        ReworkOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=_REWORK_IN_PROGRESS,
        ).count(),
    )
    return {
        "work_order": {"overdue": wo_overdue, "pending": 0, "in_progress": wo_in_progress},
        "rework_order": {"overdue": ro_overdue, "pending": 0, "in_progress": ro_in_progress},
    }


async def _section_exceptions(tenant_id: int) -> BadgeFragment:
    from apps.kuaizhizao.models.material_shortage_exception import MaterialShortageException
    from apps.kuaizhizao.models.delivery_delay_exception import DeliveryDelayException
    from apps.kuaizhizao.models.quality_exception import QualityException

    c1, c2, c3 = await asyncio.gather(
        MaterialShortageException.filter(
            tenant_id=tenant_id,
            status__in=ACTIVE_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        ).count(),
        DeliveryDelayException.filter(
            tenant_id=tenant_id,
            status__in=ACTIVE_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        ).count(),
        QualityException.filter(
            tenant_id=tenant_id,
            status__in=ACTIVE_QUALITY_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        ).count(),
    )
    return {
        "material_shortage_exception": {"overdue": 0, "pending": c1, "in_progress": 0},
        "delivery_delay_exception": {"overdue": 0, "pending": c2, "in_progress": 0},
        "quality_exception": {"overdue": 0, "pending": c3, "in_progress": 0},
    }


async def _section_sales(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from apps.kuaizhizao.models.sales_forecast import SalesForecast

    so_active = [
        "IN_PROGRESS", "进行中", "APPROVED", "已审核", "CONFIRMED", "已确认",
        "AUDITED", "RELEASED", "执行中",
    ]
    so_overdue, so_pending, so_prog, sf_overdue, sf_pending, sf_prog = await asyncio.gather(
        SalesOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, delivery_date__lt=now_date,
        ).exclude(status__in=_DOC_TERMINAL_STATUSES).count(),
        SalesOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True,
            review_status__in=["PENDING", "PENDING_REVIEW", "待审核"],
        ).exclude(status__in=["DRAFT", "草稿", *_DOC_TERMINAL_STATUSES]).count(),
        SalesOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=so_active,
        ).exclude(status__in=_DOC_TERMINAL_STATUSES).count(),
        SalesForecast.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, end_date__lt=now_date,
        ).exclude(status__in=_DOC_TERMINAL_STATUSES).count(),
        SalesForecast.filter(
            tenant_id=tenant_id, deleted_at__isnull=True,
            review_status__in=["PENDING", "PENDING_REVIEW", "待审核"],
        ).exclude(status__in=["DRAFT", "草稿", *_DOC_TERMINAL_STATUSES]).count(),
        SalesForecast.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=so_active,
        ).exclude(status__in=_DOC_TERMINAL_STATUSES).count(),
    )
    return {
        "sales_order": {"overdue": so_overdue, "pending": so_pending, "in_progress": so_prog},
        "sales_forecast": {"overdue": sf_overdue, "pending": sf_pending, "in_progress": sf_prog},
    }


async def _section_purchase(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder
    from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
    from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
        _INBOUND_PENDING_STATUSES,
    )

    po = PurchaseOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    po_terminal = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "关闭"]))
    prq = PurchaseRequisition.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    prq_term = [
        DocumentStatus.CANCELLED.value,
        DocumentStatus.REJECTED.value,
        DocumentStatus.FULL_CONVERTED.value,
        DocumentStatus.CLOSED.value,
        "已取消", "已驳回", "全部转单", "已关闭", "CANCELLED", "REJECTED", "FULL_CONVERTED", "CLOSED",
    ]
    _pr = PurchaseReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    inbound_term = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "关闭", "已入库"]))

    po_od, po_pending, po_prog, prq_pending, prq_prog, pr_pending, pr_exec = await asyncio.gather(
        po.filter(delivery_date__lt=now_date, delivery_date__isnull=False).exclude(status__in=po_terminal).count(),
        po.filter(review_status__in=["PENDING", "PENDING_REVIEW", "待审核"]).exclude(status__in=po_terminal).count(),
        po.filter(status__in=[
            "IN_PROGRESS", "进行中", "APPROVED", "已审核", "CONFIRMED", "已确认",
            "AUDITED", "RELEASED", "执行中", "部分入库",
        ]).exclude(status__in=po_terminal).count(),
        prq.filter(review_status__in=[
            ReviewStatus.PENDING.value, "待审核", "PENDING", "PENDING_REVIEW",
        ]).exclude(status__in=prq_term).count(),
        prq.filter(status__in=[
            DocumentStatus.APPROVED.value, "已通过",
            DocumentStatus.PARTIAL_CONVERTED.value, "部分转单",
            DocumentStatus.AUDITED.value, "已审核",
        ]).exclude(status__in=prq_term).count(),
        _pr.filter(review_status__in=_RV_PENDING).exclude(status__in=inbound_term).count(),
        _pr.filter(status__in=tuple(_INBOUND_PENDING_STATUSES)).exclude(review_status__in=_RV_PENDING).count(),
    )
    return {
        "purchase_order": {"overdue": po_od, "pending": po_pending, "in_progress": po_prog},
        "purchase_requisition": {"overdue": 0, "pending": prq_pending, "in_progress": prq_prog},
        "inbound": {"overdue": 0, "pending": pr_pending, "in_progress": pr_exec},
    }


async def _section_quality_inspection(tenant_id: int) -> BadgeFragment:
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from apps.kuaizhizao.models.process_inspection import ProcessInspection
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

    c1, c2, c3 = await asyncio.gather(
        IncomingInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
        ProcessInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
        FinishedGoodsInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
    )
    return {
        "incoming_inspection": {"overdue": 0, "pending": c1, "in_progress": 0},
        "process_inspection": {"overdue": 0, "pending": c2, "in_progress": 0},
        "finished_goods_inspection": {"overdue": 0, "pending": c3, "in_progress": 0},
        "quality_inspection": {"overdue": 0, "pending": c1 + c2 + c3, "in_progress": 0},
    }


async def _section_equipment_assets(tenant_id: int) -> BadgeFragment:
    from apps.kuaizhizao.models.equipment import Equipment
    from apps.kuaizhizao.models.mold import Mold
    from apps.kuaizhizao.models.demand import Demand
    from apps.kuaizhizao.models.equipment_point_inspection import EquipmentPointInspectionRecord
    from apps.kuaizhizao.constants import DemandStatus, ReviewStatus

    _audited_status = ["AUDITED", "已审核", "CONFIRMED", "已确认", DemandStatus.AUDITED.value]
    _approved_review = ["APPROVED", "审核通过", "通过", "已通过", ReviewStatus.APPROVED.value]

    eq_cnt, mold_cnt, dc_cnt, epi_cnt = await asyncio.gather(
        Equipment.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["维修中", "校验中"]).count(),
        Mold.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["维修中", "校验中"]).count(),
        Demand.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            pushed_to_computation=False,
            status__in=_audited_status,
            review_status__in=_approved_review,
        ).count(),
        EquipmentPointInspectionRecord.filter(
            tenant_id=tenant_id, status="待点检", deleted_at__isnull=True,
        ).count(),
    )
    return {
        "equipment": {"overdue": 0, "pending": 0, "in_progress": eq_cnt},
        "mold": {"overdue": 0, "pending": 0, "in_progress": mold_cnt},
        "demand_computation": {"overdue": 0, "pending": dc_cnt, "in_progress": 0},
        "equipment_inspection": {"overdue": 0, "pending": epi_cnt, "in_progress": 0},
    }


async def _section_spare_part(tenant_id: int) -> BadgeFragment:
    from apps.kuaizhizao.models.spare_part import SparePart, SparePartInventory

    parts, stock_rows = await asyncio.gather(
        SparePart.filter(tenant_id=tenant_id, is_active=True, deleted_at__isnull=True).values_list(
            "id", "safety_stock"
        ),
        SparePartInventory.filter(tenant_id=tenant_id, deleted_at__isnull=True)
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


async def _section_warehouse_docs(tenant_id: int) -> BadgeFragment:
    from apps.kuaizhizao.models.other_inbound import OtherInbound
    from apps.kuaizhizao.models.material_return import MaterialReturn
    from apps.kuaizhizao.models.sales_delivery import SalesDelivery
    from apps.kuaizhizao.models.other_outbound import OtherOutbound
    from apps.kuaizhizao.models.material_borrow import MaterialBorrow
    from apps.kuaizhizao.models.production_picking import ProductionPicking

    oi = OtherInbound.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    mr = MaterialReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    sd = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    oo = OtherOutbound.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    mb = MaterialBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    pp = ProductionPicking.filter(tenant_id=tenant_id, deleted_at__isnull=True)

    wh_term = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已出库", "已领料", "已入库", "已归还"]))

    oi_p, oi_x, mr_p, mr_x, sd_p, sd_x, oo_p, oo_x, mb_p, mb_x, pp_p, pp_x = await asyncio.gather(
        oi.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term).count(),
        oi.filter(status="待入库").exclude(review_status__in=_RV_PENDING).count(),
        mr.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term).count(),
        mr.filter(status="待归还").exclude(review_status__in=_RV_PENDING).count(),
        sd.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term).count(),
        sd.filter(status="待出库").exclude(review_status__in=_RV_PENDING).count(),
        oo.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term).count(),
        oo.filter(status="待出库").exclude(review_status__in=_RV_PENDING).count(),
        mb.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term).count(),
        mb.filter(status="待借出").exclude(review_status__in=_RV_PENDING).count(),
        # 出库 Hub 含生产领料：仅待审核 / 待领料，已领料不计
        pp.filter(review_status__in=_RV_PENDING).exclude(status__in=wh_term).count(),
        pp.filter(status="待领料").exclude(review_status__in=_RV_PENDING).count(),
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


async def _section_warehouse_ops(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
    from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
    from apps.kuaizhizao.models.stocktaking import Stocktaking
    from apps.kuaizhizao.models.inventory_transfer import InventoryTransfer
    from apps.kuaizhizao.models.assembly_order import AssemblyOrder
    from apps.kuaizhizao.models.disassembly_order import DisassemblyOrder
    from apps.kuaizhizao.models.batching_order import BatchingOrder
    from apps.kuaizhizao.models.customer_material_registration import CustomerMaterialRegistration

    dn = DeliveryNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)

    dn_p, dn_x, dn_od, mc_pending, st_cnt, it_cnt, ao_cnt, do_cnt, bo_cnt, cm_cnt = await asyncio.gather(
        dn.filter(status="待发送").count(),
        dn.filter(status="已发送").count(),
        dn.filter(planned_delivery_date__lt=now_date, planned_delivery_date__isnull=False)
        .exclude(status__in=["已签收", "已取消"]).count(),
        MaterialCallRequest.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, is_active=True,
            status__in=["pending", "processing", "partial"],
        ).count(),
        Stocktaking.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["draft", "in_progress"]).count(),
        InventoryTransfer.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["draft", "in_progress"]).count(),
        AssemblyOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["draft", "in_progress"]).count(),
        DisassemblyOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["draft", "in_progress"]).count(),
        BatchingOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["draft", "picking"]).count(),
        CustomerMaterialRegistration.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="pending").count(),
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


async def _section_sales_docs(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.quotation import Quotation
    from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
    from apps.kuaizhizao.models.purchase_return import PurchaseReturn
    from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
    from apps.kuaizhizao.models.sales_return import SalesReturn

    qb = Quotation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    rn = ReceiptNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)
    prt = PurchaseReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    sn = ShipmentNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)
    sr = SalesReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)

    qb_done = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已接受", "已拒绝", "已转订单"]))
    rn_done = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已入库", "已签收"]))
    sn_done = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已出库", "已签收"]))
    # 退货单业务终态是「已退货」（列表阶段亦映射为已完成），须排除，避免待审核+已退货仍进徽章
    return_done = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已退货", "RETURNED", "returned"]))
    qb_od, qb_p, qb_x, rn_od, rn_p, rn_x, prt_p, prt_x, sn_od, sn_p, sn_x, sr_p, sr_x = await asyncio.gather(
        qb.filter(valid_until__lt=now_date, valid_until__isnull=False)
        .exclude(status__in=qb_done).count(),
        qb.filter(review_status__in=_RV_PENDING).exclude(status__in=qb_done).count(),
        qb.filter(status="已发送").exclude(review_status__in=_RV_PENDING).count(),
        rn.filter(planned_receipt_date__lt=now_date, planned_receipt_date__isnull=False)
        .exclude(status__in=rn_done).count(),
        rn.filter(status="待收货").count(),
        rn.filter(status="已通知").count(),
        prt.filter(review_status__in=_RV_PENDING).exclude(status__in=return_done).count(),
        prt.filter(status="待退货").exclude(review_status__in=_RV_PENDING).count(),
        sn.filter(planned_ship_date__lt=now_date, planned_ship_date__isnull=False)
        .exclude(status__in=sn_done).count(),
        sn.filter(status="待发货").count(),
        sn.filter(status="已通知").count(),
        sr.filter(review_status__in=_RV_PENDING).exclude(status__in=return_done).count(),
        sr.filter(status="待退货").exclude(review_status__in=_RV_PENDING).count(),
    )
    return {
        "quotation": {"overdue": qb_od, "pending": qb_p, "in_progress": qb_x},
        "receipt_notice": {"overdue": rn_od, "pending": rn_p, "in_progress": rn_x},
        "purchase_return": {"overdue": 0, "pending": prt_p, "in_progress": prt_x},
        "shipment_notice": {"overdue": sn_od, "pending": sn_p, "in_progress": sn_x},
        "sales_return": {"overdue": 0, "pending": sr_p, "in_progress": sr_x},
    }


async def _section_misc_ops(tenant_id: int, now: datetime, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.customer_follow_up import CustomerFollowUp
    from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
    from apps.kuaizhizao.models.equipment_fault import EquipmentFault
    from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan
    from apps.kuaizhizao.models.maintenance_reminder import MaintenanceReminder
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan

    ow = OutsourceWorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    ow_term = list(dict.fromkeys([*_WORK_ORDER_TERMINAL, *_DOC_TERMINAL_STATUSES]))
    ef = EquipmentFault.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    mp = MaintenancePlan.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    mp_term = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已完成", "已取消"]))

    cfu_od, ow_od, ow_p, ow_x, ef_p, ef_x, mp_od, mp_p, mp_x, mrem, ip_cnt = await asyncio.gather(
        CustomerFollowUp.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            next_follow_up_at__isnull=False,
            next_follow_up_at__lt=now,
        ).count(),
        ow.filter(planned_end_date__lt=now, planned_end_date__isnull=False).exclude(status__in=ow_term).count(),
        ow.filter(status="draft").count(),
        ow.filter(status__in=["released", "in_progress", "已下达", "进行中"]).count(),
        ef.filter(status="待处理").count(),
        ef.filter(status="处理中").count(),
        mp.filter(planned_end_date__lt=now, planned_end_date__isnull=False)
        .exclude(status__in=mp_term).count(),
        mp.filter(status__in=["草稿", "已发布"]).count(),
        mp.filter(status="执行中").count(),
        MaintenanceReminder.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_handled=False).count(),
        InspectionPlan.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=False).count(),
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


async def _section_finance(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaicaiwu.models.receivable import Receivable
    from apps.kuaicaiwu.models.payable import Payable
    from apps.kuaicaiwu.models.receipt import Receipt
    from apps.kuaicaiwu.models.payment import Payment

    recv_pending, pay_pending, recv_voucher, pay_voucher, recv_overdue = await asyncio.gather(
        Receivable.filter(tenant_id=tenant_id, deleted_at__isnull=True, remaining_amount__gt=0).count(),
        Payable.filter(tenant_id=tenant_id, deleted_at__isnull=True, remaining_amount__gt=0).count(),
        Receipt.filter(tenant_id=tenant_id, deleted_at__isnull=True, unsettled_amount__gt=0)
        .exclude(status="Cancelled").count(),
        Payment.filter(tenant_id=tenant_id, deleted_at__isnull=True, unsettled_amount__gt=0)
        .exclude(status="Cancelled").count(),
        Receivable.filter(
            tenant_id=tenant_id,
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


async def fetch_menu_badge_counts(tenant_id: int) -> dict:
    from apps.kuaizhizao.services.menu_badge_counts_extended import fetch_extended_menu_badge_counts

    now = resolve_business_datetime()
    now_date = now.date()

    sections = await asyncio.gather(
        _safe_section("work_orders", lambda: _section_work_orders(tenant_id, now)),
        _safe_section("exceptions", lambda: _section_exceptions(tenant_id)),
        _safe_section("sales", lambda: _section_sales(tenant_id, now_date)),
        _safe_section("purchase", lambda: _section_purchase(tenant_id, now_date)),
        _safe_section("quality_inspection", lambda: _section_quality_inspection(tenant_id)),
        _safe_section("equipment_assets", lambda: _section_equipment_assets(tenant_id)),
        _safe_section("spare_part", lambda: _section_spare_part(tenant_id)),
        _safe_section("warehouse_docs", lambda: _section_warehouse_docs(tenant_id)),
        _safe_section("warehouse_ops", lambda: _section_warehouse_ops(tenant_id, now_date)),
        _safe_section("sales_docs", lambda: _section_sales_docs(tenant_id, now_date)),
        _safe_section("misc_ops", lambda: _section_misc_ops(tenant_id, now, now_date)),
        _safe_section("finance", lambda: _section_finance(tenant_id, now_date)),
        _safe_section("extended", lambda: fetch_extended_menu_badge_counts(tenant_id, now, now_date)),
    )

    counts: dict = {}
    for fragment in sections:
        counts.update(fragment)
    return counts
