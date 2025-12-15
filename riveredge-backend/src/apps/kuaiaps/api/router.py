"""
APS API 路由模块

统一管理所有APS相关的API路由。
"""

from fastapi import APIRouter
from .capacity_plannings import router as capacity_plannings_router
from .production_plans import router as production_plans_router
from .resource_schedulings import router as resource_schedulings_router
from .plan_adjustments import router as plan_adjustments_router

router = APIRouter(prefix="/apps/kuaiaps", tags=["APS"])

# 注册所有子路由
router.include_router(capacity_plannings_router)
router.include_router(production_plans_router)
router.include_router(resource_schedulings_router)
router.include_router(plan_adjustments_router)

