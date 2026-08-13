"""
菜单徽章：扩展单据域 COUNT（销售合同/变更、采购询价、计划需求、售后、物流、设备单据、财务分菜单等）。

与 menu_badge_counts_service 共用三态结构 {overdue, pending, in_progress}；
前端展示时 pending 与 in_progress 合并为蓝色「进行中」，逾期优先红色。
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, List

from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
from apps.kuaizhizao.constants.purchase_inquiry import PurchaseInquiryStatus
from apps.kuaizhizao.services.menu_badge_counts_service import (
    _DOC_TERMINAL_STATUSES,
    _RV_PENDING,
    _safe_section,
)

BadgeFragment = Dict[str, Any]

_CHANGE_TERMINAL: List[str] = list(
    dict.fromkeys(
        [
            *_DOC_TERMINAL_STATUSES,
            DocumentStatus.DRAFT.value,
            "草稿",
            "APPLIED",
            "已生效",
            "WITHDRAWN",
            "已撤回",
        ]
    )
)

_CONTRACT_TERMINAL: List[str] = list(
    dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已关闭", "已完成", "已到期", "已转订单"])
)

_CONTRACT_IN_PROGRESS: List[str] = ["已生效", "执行中", "EFFECTIVE", "IN_PROGRESS", "已审核", "AUDITED"]

_INQUIRY_OPEN: List[str] = [
    PurchaseInquiryStatus.DRAFT.value,
    PurchaseInquiryStatus.QUOTING.value,
    PurchaseInquiryStatus.PENDING_COMPARE.value,
    PurchaseInquiryStatus.AWARDED.value,
    "草稿",
    "询价中",
    "待比价",
    "已定标",
]

_FREIGHT_TERMINAL = ["signed", "cancelled", "已签收", "已取消"]


def _tri(overdue: int = 0, pending: int = 0, in_progress: int = 0) -> Dict[str, int]:
    return {"overdue": overdue, "pending": pending, "in_progress": in_progress}


async def _section_contracts_and_changes(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.purchase_order_change_order import PurchaseOrderChangeOrder
    from apps.kuaizhizao.models.sales_contract import SalesContract
    from apps.kuaizhizao.models.sales_order_change_order import SalesOrderChangeOrder

    sc = SalesContract.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)
    soc = SalesOrderChangeOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)
    poc = PurchaseOrderChangeOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)

    change_pending_q = {"review_status__in": _RV_PENDING, "status__in": ["PENDING_REVIEW", "待审核"]}
    change_prog_q = {
        "applied_at__isnull": True,
        "status__in": [DocumentStatus.AUDITED.value, "已审核", "AUDITED"],
    }

    (
        sc_od,
        sc_p,
        sc_x,
        soc_od,
        soc_p,
        soc_x,
        poc_od,
        poc_p,
        poc_x,
    ) = await asyncio.gather(
        sc.filter(valid_to__lt=now_date, valid_to__isnull=False).exclude(status__in=_CONTRACT_TERMINAL).count(),
        sc.filter(review_status__in=_RV_PENDING).exclude(status__in=[*_CONTRACT_TERMINAL, "草稿", "DRAFT"]).count(),
        sc.filter(status__in=_CONTRACT_IN_PROGRESS).exclude(status__in=_CONTRACT_TERMINAL).count(),
        soc.filter(effective_date__lt=now_date, effective_date__isnull=False)
        .exclude(status__in=_CHANGE_TERMINAL)
        .count(),
        soc.filter(**change_pending_q).exclude(status__in=_CHANGE_TERMINAL).count(),
        soc.filter(**change_prog_q).exclude(status__in=_CHANGE_TERMINAL).count(),
        poc.filter(effective_date__lt=now_date, effective_date__isnull=False)
        .exclude(status__in=_CHANGE_TERMINAL)
        .count(),
        poc.filter(**change_pending_q).exclude(status__in=_CHANGE_TERMINAL).count(),
        poc.filter(**change_prog_q).exclude(status__in=_CHANGE_TERMINAL).count(),
    )
    return {
        "sales_contract": _tri(sc_od, sc_p, sc_x),
        "sales_order_change": _tri(soc_od, soc_p, soc_x),
        "purchase_order_change": _tri(poc_od, poc_p, poc_x),
    }


async def _section_purchase_inquiry(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.purchase_inquiry import PurchaseInquiry

    qs = PurchaseInquiry.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    inquiry_done = list(
        dict.fromkeys(
            [
                *_DOC_TERMINAL_STATUSES,
                PurchaseInquiryStatus.CONVERTED.value,
                PurchaseInquiryStatus.CANCELLED.value,
                "已转单",
                "已取消",
            ]
        )
    )
    od, pending, prog = await asyncio.gather(
        qs.filter(quote_deadline__lt=now_date, quote_deadline__isnull=False)
        .filter(status__in=_INQUIRY_OPEN)
        .count(),
        qs.filter(review_status__in=_RV_PENDING).exclude(status__in=inquiry_done).count(),
        qs.filter(
            status__in=[
                PurchaseInquiryStatus.QUOTING.value,
                PurchaseInquiryStatus.AWARDED.value,
                PurchaseInquiryStatus.PENDING_COMPARE.value,
                "询价中",
                "已定标",
                "待比价",
            ]
        )
        .exclude(review_status__in=_RV_PENDING)
        .exclude(status__in=inquiry_done)
        .count(),
    )
    return {"purchase_inquiry": _tri(od, pending, prog)}


async def _section_demand_and_reporting(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.demand import Demand
    from apps.kuaizhizao.models.demand_computation import DemandComputation
    from apps.kuaizhizao.models.reporting_record import ReportingRecord

    demand_term = list(dict.fromkeys([*_DOC_TERMINAL_STATUSES, "已关闭", "已取消"]))
    audited = [DocumentStatus.AUDITED.value, "已审核", "AUDITED", "CONFIRMED", "已确认"]
    # 与列表「进行中」及 statistics.pending_count 对齐；含执行中的计算中态
    dc_open_statuses = ["进行中", "计算中", "pending", "running"]
    dm = Demand.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    dm_od, dm_p, dm_x, dc_x, rep_p = await asyncio.gather(
        dm.filter(end_date__lt=now_date, end_date__isnull=False).exclude(status__in=demand_term).count(),
        dm.filter(review_status__in=_RV_PENDING).exclude(status__in=[*demand_term, "DRAFT", "草稿"]).count(),
        dm.filter(status__in=audited, review_status__in=[ReviewStatus.APPROVED.value, "APPROVED", "已通过"])
        .filter(pushed_to_computation=False)
        .exclude(status__in=demand_term)
        .count(),
        DemandComputation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            computation_status__in=dc_open_statuses,
        ).count(),
        ReportingRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="pending").count(),
    )
    return {
        "demand": _tri(dm_od, dm_p, dm_x),
        # 需求计算菜单：计进行中的需求计算单（非「未下推需求」）
        "demand_computation": _tri(in_progress=dc_x),
        "reporting_record": _tri(pending=rep_p),
    }


async def _section_oqc(tenant_id: int) -> BadgeFragment:
    from apps.kuaizhizao.models.oqc_inspection import OQCInspection

    qs = OQCInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    pending, prog = await asyncio.gather(
        qs.filter(status="待检验").count(),
        qs.filter(status__in=["已检验", "待审核"], review_status__in=_RV_PENDING).count(),
    )
    return {"oqc_inspection": _tri(pending=pending, in_progress=prog)}


async def _section_finance_menus(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaicaiwu.models.invoice import Invoice
    from apps.kuaicaiwu.models.payable import Payable
    from apps.kuaicaiwu.models.payment import Payment
    from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
    from apps.kuaicaiwu.models.receipt import Receipt
    from apps.kuaicaiwu.models.receivable import Receivable

    recv_od, recv_open, pay_open, pay_od = await asyncio.gather(
        Receivable.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            remaining_amount__gt=0,
            due_date__lt=now_date,
            due_date__isnull=False,
        ).count(),
        Receivable.filter(tenant_id=tenant_id, deleted_at__isnull=True, remaining_amount__gt=0).count(),
        Payable.filter(tenant_id=tenant_id, deleted_at__isnull=True, remaining_amount__gt=0).count(),
        Payable.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            remaining_amount__gt=0,
            due_date__lt=now_date,
            due_date__isnull=False,
        ).count(),
    )
    recv_prog = max(0, recv_open - recv_od)
    pay_prog = max(0, pay_open - pay_od)
    rc_draft, rc_open, pm_draft, pm_open = await asyncio.gather(
        Receipt.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="Draft").count(),
        Receipt.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="Confirmed", unsettled_amount__gt=0)
        .exclude(status="Cancelled")
        .count(),
        Payment.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="Draft").count(),
        Payment.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="Confirmed", unsettled_amount__gt=0)
        .exclude(status="Cancelled")
        .count(),
    )
    si_p, pi_p, prep_p, prep_x = await asyncio.gather(
        Invoice.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            category="OUT",
            status__in=["DRAFT", "未审核", "待审核"],
        )
        .exclude(status__in=["VOID", "已作废", "已红冲"])
        .count(),
        PurchaseInvoice.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            review_status__in=_RV_PENDING,
        )
        .exclude(status__in=["已作废", "已关闭", *_DOC_TERMINAL_STATUSES])
        .count(),
        Receipt.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            settlement_type="prepayment",
            status="Draft",
        ).count(),
        Receipt.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            settlement_type="prepayment",
            status="Confirmed",
            unsettled_amount__gt=0,
        ).count(),
    )
    prep_pm_d, prep_pm_x = await asyncio.gather(
        Payment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            settlement_type="prepayment",
            status="Draft",
        ).count(),
        Payment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            settlement_type="prepayment",
            status="Confirmed",
            unsettled_amount__gt=0,
        ).count(),
    )
    return {
        "finance_receivable": _tri(recv_od, in_progress=recv_prog),
        "finance_payable": _tri(pay_od, in_progress=pay_prog),
        "finance_receipt": _tri(pending=rc_draft, in_progress=rc_open),
        "finance_payment": _tri(pending=pm_draft, in_progress=pm_open),
        "sales_invoice": _tri(pending=si_p),
        "purchase_invoice": _tri(pending=pi_p),
        "prepayment": _tri(pending=prep_p + prep_pm_d, in_progress=prep_x + prep_pm_x),
    }


async def _section_after_sales(tenant_id: int, now: datetime) -> BadgeFragment:
    from apps.kuaizhizao.models.after_sales_service import (
        AfterSalesSparePartRequisition,
        RepairOrder,
        ServiceDispatchOrder,
        ServiceSettlement,
    )
    from apps.kuaizhizao.models.after_sales_ticket import AfterSalesTicket
    from apps.kuaizhizao.models.install_execution_job import InstallExecutionJob

    ticket_p, ticket_x, install_p, install_x, repair_p, repair_x = await asyncio.gather(
        AfterSalesTicket.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待处理").count(),
        AfterSalesTicket.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="处理中").count(),
        InstallExecutionJob.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待派工").count(),
        InstallExecutionJob.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["进行中", "待验收"]).count(),
        RepairOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待派工").count(),
        RepairOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["维修中", "待验收"]).count(),
    )
    dispatch_od, dispatch_p, dispatch_x = await asyncio.gather(
        ServiceDispatchOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            planned_end_at__lt=now,
            planned_end_at__isnull=False,
        )
        .exclude(status__in=["完工", "已取消"])
        .count(),
        ServiceDispatchOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待接单").count(),
        ServiceDispatchOrder.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=["已接单", "到场"]
        ).count(),
    )
    as_spare_p, settle_p = await asyncio.gather(
        AfterSalesSparePartRequisition.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status="待审核"
        ).count(),
        ServiceSettlement.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待审核").count(),
    )
    return {
        "after_sales_ticket": _tri(pending=ticket_p, in_progress=ticket_x),
        "install_execution": _tri(pending=install_p, in_progress=install_x),
        "after_sales_repair_order": _tri(pending=repair_p, in_progress=repair_x),
        "service_dispatch": _tri(dispatch_od, dispatch_p, dispatch_x),
        "after_sales_spare_part_requisition": _tri(pending=as_spare_p),
        "service_settlement": _tri(pending=settle_p),
    }


async def _section_logistics(tenant_id: int, now: datetime) -> BadgeFragment:
    from apps.kuaizhizao.models.logistics import FreightBill, FreightOrder

    fo = FreightOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    fo_od, fo_p, fo_x = await asyncio.gather(
        fo.filter(planned_arrive_at__lt=now, planned_arrive_at__isnull=False)
        .exclude(status__in=_FREIGHT_TERMINAL)
        .count(),
        fo.filter(status__in=["draft", "scheduled", "草稿", "已计划"]).count(),
        fo.filter(status__in=["shipped", "in_transit", "arrived", "已发运", "运输中", "已到达"]).count(),
    )
    fb_p, fb_x = await asyncio.gather(
        FreightBill.filter(tenant_id=tenant_id, deleted_at__isnull=True, review_status="pending").count(),
        FreightBill.filter(tenant_id=tenant_id, deleted_at__isnull=True, review_status="approved")
        .exclude(status__in=["paid", "已支付"])
        .count(),
    )
    freight_tri = _tri(fo_od, fo_p, fo_x)
    return {
        "freight_order": freight_tri,
        "freight_tracking": freight_tri,
        "freight_bill": _tri(pending=fb_p, in_progress=fb_x),
    }


async def _section_equipment_documents(tenant_id: int, now: datetime, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.equipment_fault import EquipmentRepair
    from apps.kuaizhizao.models.equipment_ops import EquipmentScrapApplication, EquipmentTransferApplication
    from apps.kuaizhizao.models.maintenance_plan import MaintenanceExecution
    from apps.kuaizhizao.models.mold_ops import (
        MoldBorrow,
        MoldMaintenance,
        MoldRepair,
        MoldScrapApplication,
        MoldTrial,
    )
    from apps.kuaizhizao.models.spare_part import SparePartRequisition
    from apps.kuaizhizao.models.tool import Tool
    from apps.kuaizhizao.models.tool_ops import (
        ToolBorrow,
        ToolMaintenance,
        ToolRepair,
        ToolScrapApplication,
    )

    app_term = ["已审核", "已驳回", "已完成", "已取消"]
    mold_maint_term = list(dict.fromkeys([*app_term, *_DOC_TERMINAL_STATUSES]))

    eq_rep, eq_xfer, eq_scrap, spr, maint_exec_od, maint_exec_x, mold_trial_x = await asyncio.gather(
        EquipmentRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="进行中").count(),
        EquipmentTransferApplication.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
        EquipmentScrapApplication.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
        SparePartRequisition.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
        MaintenanceExecution.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            execution_date__lt=now,
            status__in=["草稿", "已确认"],
        ).count(),
        MaintenanceExecution.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=["草稿", "已确认"]
        ).count(),
        MoldTrial.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="进行中").count(),
    )
    mold_b_od, mold_b_x, mold_m_od, mold_m_p, mold_m_x, mold_r_od, mold_r_p, mold_r_x, mold_s = await asyncio.gather(
        MoldBorrow.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="领用中",
            expected_return_date__lt=now_date,
            expected_return_date__isnull=False,
        ).count(),
        MoldBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="领用中").count(),
        MoldMaintenance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            planned_date__lt=now_date,
            planned_date__isnull=False,
        )
        .exclude(status__in=mold_maint_term)
        .count(),
        MoldMaintenance.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
        MoldMaintenance.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=["进行中", "已审核"]
        ).count(),
        MoldRepair.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            planned_date__lt=now_date,
            planned_date__isnull=False,
        )
        .exclude(status__in=mold_maint_term)
        .count(),
        MoldRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
        MoldRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["进行中", "已审核"]).count(),
        MoldScrapApplication.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
    )
    tool_b_od, tool_b_x, tool_m_od, tool_m_p, tool_m_x, tool_r_od, tool_r_p, tool_r_x, tool_s, tool_led = await asyncio.gather(
        ToolBorrow.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="领用中",
            expected_return_date__lt=now_date,
            expected_return_date__isnull=False,
        ).count(),
        ToolBorrow.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="领用中").count(),
        ToolMaintenance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            planned_date__lt=now_date,
            planned_date__isnull=False,
        )
        .exclude(status__in=mold_maint_term)
        .count(),
        ToolMaintenance.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
        ToolMaintenance.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=["进行中", "已审核"]
        ).count(),
        ToolRepair.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            planned_date__lt=now_date,
            planned_date__isnull=False,
        )
        .exclude(status__in=mold_maint_term)
        .count(),
        ToolRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
        ToolRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["进行中", "已审核"]).count(),
        ToolScrapApplication.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已提交").count(),
        Tool.filter(tenant_id=tenant_id, deleted_at__isnull=True, status__in=["维修中", "校验中"]).count(),
    )
    return {
        "equipment_repair": _tri(in_progress=eq_rep),
        "equipment_transfer": _tri(pending=eq_xfer),
        "equipment_scrap": _tri(pending=eq_scrap),
        "spare_part_requisition": _tri(pending=spr),
        "mold_borrow": _tri(mold_b_od, in_progress=mold_b_x),
        "mold_maintenance": _tri(mold_m_od, mold_m_p, mold_m_x),
        "mold_repair": _tri(mold_r_od, mold_r_p, mold_r_x),
        "mold_scrap": _tri(pending=mold_s),
        "tool_borrow": _tri(tool_b_od, in_progress=tool_b_x),
        "tool_maintenance": _tri(tool_m_od, tool_m_p, tool_m_x),
        "tool_repair": _tri(tool_r_od, tool_r_p, tool_r_x),
        "tool_scrap": _tri(pending=tool_s),
        "tool_ledger": _tri(in_progress=tool_led),
        "maintenance_execution": _tri(maint_exec_od, in_progress=maint_exec_x),
        "mold_trial": _tri(in_progress=mold_trial_x),
    }


async def _section_warehouse_extra(tenant_id: int, now_date) -> BadgeFragment:
    from apps.kuaizhizao.models.backflush_record import BackflushRecord
    from apps.kuaizhizao.models.inventory_alert import InventoryAlert
    from apps.kuaizhizao.models.replenishment_suggestion import ReplenishmentSuggestion

    bf_p, alert_p, alert_x, rep_od, rep_p = await asyncio.gather(
        BackflushRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="pending").count(),
        InventoryAlert.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="pending").count(),
        InventoryAlert.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="processing").count(),
        ReplenishmentSuggestion.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="pending",
            suggested_order_date__lt=now_date,
            suggested_order_date__isnull=False,
        ).count(),
        ReplenishmentSuggestion.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="pending").count(),
    )
    return {
        "backflush_record": _tri(pending=bf_p),
        "inventory_alert": _tri(pending=alert_p, in_progress=alert_x),
        "replenishment_suggestion": _tri(rep_od, pending=rep_p),
    }


async def fetch_extended_menu_badge_counts(tenant_id: int, now: datetime, now_date) -> BadgeFragment:
    sections = await asyncio.gather(
        _safe_section("contracts_changes", lambda: _section_contracts_and_changes(tenant_id, now_date)),
        _safe_section("purchase_inquiry", lambda: _section_purchase_inquiry(tenant_id, now_date)),
        _safe_section("demand_reporting", lambda: _section_demand_and_reporting(tenant_id, now_date)),
        _safe_section("oqc", lambda: _section_oqc(tenant_id)),
        _safe_section("finance_menus", lambda: _section_finance_menus(tenant_id, now_date)),
        _safe_section("after_sales", lambda: _section_after_sales(tenant_id, now)),
        _safe_section("logistics", lambda: _section_logistics(tenant_id, now)),
        _safe_section("equipment_documents", lambda: _section_equipment_documents(tenant_id, now, now_date)),
        _safe_section("warehouse_extra", lambda: _section_warehouse_extra(tenant_id, now_date)),
    )
    counts: BadgeFragment = {}
    for fragment in sections:
        counts.update(fragment)
    return counts
