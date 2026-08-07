"""售后服务看板聚合统计"""

from __future__ import annotations

from decimal import Decimal

from apps.kuaizhizao.models.after_sales_service import (
    CustomerReturnVisit,
    RepairOrder,
    ServiceAsset,
    ServiceDispatchOrder,
)
from apps.kuaizhizao.models.after_sales_ticket import AfterSalesTicket
from apps.kuaizhizao.schemas.after_sales_service import AfterSalesDashboardResponse


class AfterSalesDashboardService:
    @classmethod
    async def get_summary(cls, tenant_id: int) -> AfterSalesDashboardResponse:
        ticket_count = await AfterSalesTicket.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).count()
        open_ticket_count = await AfterSalesTicket.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).exclude(status="已关闭").count()

        repair_order_count = await RepairOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).count()
        open_repair_order_count = await RepairOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).exclude(status="已关闭").count()

        dispatch_total = await ServiceDispatchOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).exclude(status="已取消").count()
        dispatch_completed = await ServiceDispatchOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="完工",
        ).count()
        dispatch_completion_rate: Decimal | None = None
        if dispatch_total > 0:
            dispatch_completion_rate = (
                Decimal(dispatch_completed) / Decimal(dispatch_total) * Decimal("100")
            ).quantize(Decimal("0.01"))

        return_visit_count = await CustomerReturnVisit.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).count()
        scores = await CustomerReturnVisit.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            satisfaction_score__not_isnull=True,
        ).values_list("satisfaction_score", flat=True)
        average_satisfaction: Decimal | None = None
        if scores:
            average_satisfaction = (
                Decimal(sum(scores)) / Decimal(len(scores))
            ).quantize(Decimal("0.01"))

        service_asset_count = await ServiceAsset.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).count()

        return AfterSalesDashboardResponse(
            ticket_count=ticket_count,
            open_ticket_count=open_ticket_count,
            repair_order_count=repair_order_count,
            open_repair_order_count=open_repair_order_count,
            dispatch_total=dispatch_total,
            dispatch_completed=dispatch_completed,
            dispatch_completion_rate=dispatch_completion_rate,
            return_visit_count=return_visit_count,
            average_satisfaction=average_satisfaction,
            service_asset_count=service_asset_count,
        )
