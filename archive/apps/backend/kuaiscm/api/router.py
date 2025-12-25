"""
SCM API 路由模块

统一管理所有SCM相关的API路由。
"""

from fastapi import APIRouter
from .supply_chain_networks import router as supply_chain_networks_router
from .demand_forecasts import router as demand_forecasts_router
from .supply_chain_risks import router as supply_chain_risks_router
from .global_inventory_views import router as global_inventory_views_router

router = APIRouter(prefix="/apps/kuaiscm", tags=["SCM"])

# 注册所有子路由
router.include_router(supply_chain_networks_router)
router.include_router(demand_forecasts_router)
router.include_router(supply_chain_risks_router)
router.include_router(global_inventory_views_router)

