"""
EPM模块 API 路由

整合所有企业绩效管理相关的 API 路由。
"""

from fastapi import APIRouter
from apps.kuaiepm.api.kpis import router as kpis_router
from apps.kuaiepm.api.kpi_monitorings import router as kpi_monitorings_router
from apps.kuaiepm.api.kpi_analyses import router as kpi_analyses_router
from apps.kuaiepm.api.kpi_alerts import router as kpi_alerts_router
from apps.kuaiepm.api.strategy_maps import router as strategy_maps_router
from apps.kuaiepm.api.objectives import router as objectives_router
from apps.kuaiepm.api.performance_evaluations import router as performance_evaluations_router
from apps.kuaiepm.api.business_dashboards import router as business_dashboards_router
from apps.kuaiepm.api.business_data_analyses import router as business_data_analyses_router
from apps.kuaiepm.api.trend_analyses import router as trend_analyses_router
from apps.kuaiepm.api.comparison_analyses import router as comparison_analyses_router
from apps.kuaiepm.api.budgets import router as budgets_router
from apps.kuaiepm.api.budget_variances import router as budget_variances_router
from apps.kuaiepm.api.budget_forecasts import router as budget_forecasts_router

router = APIRouter(prefix="/kuaiepm", tags=["EPM"])

# 注册子路由
router.include_router(kpis_router)
router.include_router(kpi_monitorings_router)
router.include_router(kpi_analyses_router)
router.include_router(kpi_alerts_router)
router.include_router(strategy_maps_router)
router.include_router(objectives_router)
router.include_router(performance_evaluations_router)
router.include_router(business_dashboards_router)
router.include_router(business_data_analyses_router)
router.include_router(trend_analyses_router)
router.include_router(comparison_analyses_router)
router.include_router(budgets_router)
router.include_router(budget_variances_router)
router.include_router(budget_forecasts_router)
