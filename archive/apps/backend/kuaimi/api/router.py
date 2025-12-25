"""
MI API 路由模块

统一管理所有MI相关的API路由。
"""

from fastapi import APIRouter
from .production_dashboards import router as production_dashboards_router
from .oee_analyses import router as oee_analyses_router
from .process_parameter_optimizations import router as process_parameter_optimizations_router
from .quality_prediction_analyses import router as quality_prediction_analyses_router
from .system_performance_analyses import router as system_performance_analyses_router

router = APIRouter(prefix="/apps/kuaimi", tags=["MI"])

# 注册所有子路由
router.include_router(production_dashboards_router)
router.include_router(oee_analyses_router)
router.include_router(process_parameter_optimizations_router)
router.include_router(quality_prediction_analyses_router)
router.include_router(system_performance_analyses_router)

