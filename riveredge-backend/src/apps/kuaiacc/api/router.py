"""
财务模块 API 路由

整合所有财务相关的 API 路由。
"""

from fastapi import APIRouter
from apps.kuaiacc.api.account_subjects import router as account_subjects_router
from apps.kuaiacc.api.vouchers import router as vouchers_router
from apps.kuaiacc.api.period_closings import router as period_closings_router
from apps.kuaiacc.api.customer_invoices import router as customer_invoices_router
from apps.kuaiacc.api.supplier_invoices import router as supplier_invoices_router
from apps.kuaiacc.api.receipts import router as receipts_router
from apps.kuaiacc.api.payments import router as payments_router
from apps.kuaiacc.api.standard_costs import router as standard_costs_router
from apps.kuaiacc.api.actual_costs import router as actual_costs_router
from apps.kuaiacc.api.cost_centers import router as cost_centers_router
from apps.kuaiacc.api.financial_reports import router as financial_reports_router

router = APIRouter(prefix="/kuaiacc", tags=["财务"])

# 注册子路由
router.include_router(account_subjects_router)
router.include_router(vouchers_router)
router.include_router(period_closings_router)
router.include_router(customer_invoices_router)
router.include_router(supplier_invoices_router)
router.include_router(receipts_router)
router.include_router(payments_router)
router.include_router(standard_costs_router)
router.include_router(actual_costs_router)
router.include_router(cost_centers_router)
router.include_router(financial_reports_router)

