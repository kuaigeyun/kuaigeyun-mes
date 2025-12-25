"""
EAM API 路由模块

统一管理所有EAM相关的API路由。
"""

from fastapi import APIRouter
from .maintenance_plans import router as maintenance_plans_router
from .maintenance_workorders import router as maintenance_workorders_router
from .maintenance_executions import router as maintenance_executions_router
from .failure_reports import router as failure_reports_router
from .failure_handlings import router as failure_handlings_router
from .spare_part_demands import router as spare_part_demands_router
from .spare_part_purchases import router as spare_part_purchases_router
from .tooling_usages import router as tooling_usages_router
from .mold_usages import router as mold_usages_router

router = APIRouter(prefix="/apps/kuaieam", tags=["EAM"])

# 注册所有子路由
router.include_router(maintenance_plans_router)
router.include_router(maintenance_workorders_router)
router.include_router(maintenance_executions_router)
router.include_router(failure_reports_router)
router.include_router(failure_handlings_router)
router.include_router(spare_part_demands_router)
router.include_router(spare_part_purchases_router)
router.include_router(tooling_usages_router)
router.include_router(mold_usages_router)
