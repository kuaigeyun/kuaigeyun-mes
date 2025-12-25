"""
EMS API 路由模块

统一管理所有EMS相关的API路由。
"""

from fastapi import APIRouter
from .energy_monitorings import router as energy_monitorings_router
from .energy_consumption_analyses import router as energy_consumption_analyses_router
from .energy_saving_managements import router as energy_saving_managements_router
from .energy_reports import router as energy_reports_router

router = APIRouter(prefix="/apps/kuaiems", tags=["EMS"])

# 注册所有子路由
router.include_router(energy_monitorings_router)
router.include_router(energy_consumption_analyses_router)
router.include_router(energy_saving_managements_router)
router.include_router(energy_reports_router)

