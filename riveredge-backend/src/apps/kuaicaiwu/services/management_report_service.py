"""
管理会计综合报表服务
"""

from datetime import date, timedelta
from typing import Dict, Any, List
from decimal import Decimal
from tortoise.functions import Sum

from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.cost_calculation import CostCalculation
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaicaiwu.services.finance_service import ReceivableService

class ManagementReportService:
    """
    管理会计报表服务
    
    聚合财务与生产数据，计算 DSO、毛利率、库存周转率等关键指标。
    """
    
    def __init__(self):
        self.receivable_service = ReceivableService()

    async def get_financial_kpis(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        """获取关键财务指标"""
        start_date = date.today() - timedelta(days=days)
        
        # 1. 销售额统计
        sales_total = await SalesOrder.filter(
            tenant_id=tenant_id, 
            order_date__gte=start_date,
            status="已审核",
            deleted_at__isnull=True
        ).annotate(total=Sum("total_amount")).values("total")
        total_sales = Decimal(str(sales_total[0]["total"] or 0))

        # 2. 应收账款余额与 DSO
        receivables = await Receivable.filter(
            tenant_id=tenant_id, 
            remaining_amount__gt=0,
            deleted_at__isnull=True
        ).annotate(total=Sum("remaining_amount")).values("total")
        ar_balance = Decimal(str(receivables[0]["total"] or 0))
        
        # DSO = (AR / Sales) * Days
        dso = (ar_balance / total_sales * days) if total_sales > 0 else Decimal(0)

        # 3. 成本与毛利 (简化版：从已核算的成本中取最近平均)
        avg_cost_records = await CostCalculation.filter(
            tenant_id=tenant_id,
            calculation_status="已审核",
            deleted_at__isnull=True
        ).limit(10).all()
        
        # 实际毛利计算通常需要 SalesDelivery * UnitCost，此处提供一个框架
        gross_margin_rate = Decimal("0.25") # 示例占位，实际应根据业务单据聚合

        # 4. 库存周转率 (简化版：基于物料结存估算)
        # 实际应从库存流水表计算，此处展示计算框架
        inventory_total = Decimal("500000.00") # 示例
        cogs_total = total_sales * Decimal("0.75") # 示例毛利率 25% 推算的 COGS
        inventory_turnover = (cogs_total / inventory_total) if inventory_total > 0 else Decimal(0)

        # 5. 账龄分布摘要 (调用现有服务)
        aging = await self.receivable_service.get_receivable_aging_analysis(tenant_id)

        return {
            "period_days": days,
            "total_sales": float(total_sales),
            "ar_balance": float(ar_balance),
            "dso": round(float(dso), 2),
            "gross_margin_rate": float(gross_margin_rate),
            "inventory_turnover": round(float(inventory_turnover), 2),
            "receivable_aging": aging
        }

    async def get_quality_loss_analysis(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        """质量损失成本分析"""
        start_date = date.today() - timedelta(days=days)
        
        # 聚合报废成本
        scraps = await ScrapRecord.filter(
            tenant_id=tenant_id,
            status="confirmed",
            created_at__gte=start_date,
            deleted_at__isnull=True
        ).annotate(total=Sum("total_cost")).values("total")
        scrap_cost = Decimal(str(scraps[0]["total"] or 0))

        # 聚合报工中的不合格品数
        reportings = await ReportingRecord.filter(
            tenant_id=tenant_id,
            status="approved",
            reported_at__gte=start_date,
            deleted_at__isnull=True
        ).annotate(total_unqualified=Sum("unqualified_quantity")).values("total_unqualified")
        unqualified_qty = Decimal(str(reportings[0]["total_unqualified"] or 0))

        return {
            "period_days": days,
            "scrap_cost": float(scrap_cost),
            "unqualified_quantity": float(unqualified_qty),
            "quality_loss_total": float(scrap_cost) # 简化：仅统计报废金额
        }

    async def get_labor_efficiency_analysis(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        """人工效能分析"""
        start_date = date.today() - timedelta(days=days)
        
        records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            status="approved",
            reported_at__gte=start_date,
            deleted_at__isnull=True
        ).all()
        
        total_actual_hours = sum(r.work_hours for r in records)
        # 简化版：假设标准工时为 0.5 小时/单位
        total_standard_hours = sum(r.qualified_quantity * Decimal("0.5") for r in records)
        
        efficiency = (total_standard_hours / total_actual_hours * 100) if total_actual_hours > 0 else Decimal(0)

        return {
            "period_days": days,
            "actual_work_hours": float(total_actual_hours),
            "standard_work_hours": float(total_standard_hours),
            "labor_efficiency_rate": round(float(efficiency), 2)
        }

    async def get_wip_valuation(self, tenant_id: int) -> Dict[str, Any]:
        """在制品 (WIP) 价值实时跟踪"""
        # 查找所有进行中的工单
        active_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=["released", "in_progress"],
            deleted_at__isnull=True
        ).all()
        
        total_wip_value = Decimal(0)
        # 这里只是一个估算逻辑：工单已领料总额 - 已入库成品总额
        # 实际实现需要查询 ProductionPicking 和 FinishedGoodsReceipt
        
        # 占位实现
        total_wip_value = len(active_orders) * Decimal("5000.00") 

        return {
            "active_work_orders_count": len(active_orders),
            "estimated_wip_value": float(total_wip_value)
        }

    async def get_cost_variance_report(self, tenant_id: int, product_id: int) -> Dict[str, Any]:
        """
        获取成本差异分析报告 (标准 vs 实际)
        """
        # 这里的逻辑可以进一步细化，调用之前的 CostCalculation 比较逻辑
        # 详见 kuaicaiwu.services.cost_service.compare_costs
        from apps.kuaicaiwu.services.cost_service import CostCalculationService
        cs = CostCalculationService()
        try:
            comparison = await cs.compare_costs(tenant_id, product_id)
            return comparison.model_dump()
        except Exception as e:
            return {"error": str(e)}
