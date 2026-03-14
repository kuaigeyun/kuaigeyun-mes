"""
成本核算 API 路由模块（轻管理会计）

Author: Luigi Lu
Date: 2026-03-14
"""

from .cost_rules import router as cost_rules_router
from .cost_calculations import router as cost_calculations_router
from .production_cost import router as production_cost_router
from .outsource_cost import router as outsource_cost_router
from .purchase_cost import router as purchase_cost_router
from .quality_cost import router as quality_cost_router
from .cost_comparison import router as cost_comparison_router
from .cost_optimization import router as cost_optimization_router
from .cost_report import router as cost_report_router

__all__ = [
    "cost_rules_router",
    "cost_calculations_router",
    "production_cost_router",
    "outsource_cost_router",
    "purchase_cost_router",
    "quality_cost_router",
    "cost_comparison_router",
    "cost_optimization_router",
    "cost_report_router",
]
