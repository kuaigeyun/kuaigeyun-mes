"""
轻管理会计 (kuaicaiwu) APP - 主路由

统一管理所有 API 路由。
"""

from fastapi import APIRouter

# 导入财务管理路由
from .finance.receivables import router as receivables_router
from .finance.payables import router as payables_router
from .finance.purchase_invoices import router as purchase_invoices_router
from .finance.payments import router as payments_router
from .finance.receipts import router as receipts_router
from .finance.sales_invoices import router as sales_invoices_router

# 导入成本核算路由
from .cost import (
    cost_rules_router,
    cost_calculations_router,
    production_cost_router,
    outsource_cost_router,
    purchase_cost_router,
    quality_cost_router,
    cost_comparison_router,
    cost_optimization_router,
    cost_report_router,
    standard_costs_router,
)
from .management_report import router as management_report_router
from .finance_settlement import router as settlement_router
from .finance.partner_statements import router as partner_statements_router
from .document_reconciliation import router as document_reconciliation_router
from .bank_accounts import router as bank_accounts_router
from .prepayments import router as prepayments_router
from .gl import router as gl_router

router = APIRouter(tags=["App - Kuaicaiwu - Overview"])

# 注册财务管理路由
router.include_router(receivables_router)
router.include_router(payables_router)
router.include_router(purchase_invoices_router)
router.include_router(payments_router)
router.include_router(receipts_router)
router.include_router(sales_invoices_router)

# 注册成本核算路由
router.include_router(cost_rules_router)
router.include_router(cost_calculations_router)
router.include_router(production_cost_router)
router.include_router(outsource_cost_router)
router.include_router(purchase_cost_router)
router.include_router(quality_cost_router)
router.include_router(cost_comparison_router)
router.include_router(cost_optimization_router)
router.include_router(cost_report_router)
router.include_router(standard_costs_router)
router.include_router(management_report_router)
router.include_router(settlement_router)
router.include_router(partner_statements_router)
router.include_router(document_reconciliation_router)
router.include_router(bank_accounts_router)
router.include_router(prepayments_router)
router.include_router(gl_router)


@router.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "app": "kuaicaiwu"}
