"""
TMS API 路由模块

统一管理所有TMS相关的API路由。
"""

from fastapi import APIRouter
from .transport_demands import router as transport_demands_router
from .transport_plans import router as transport_plans_router
from .vehicle_dispatches import router as vehicle_dispatches_router
from .transport_executions import router as transport_executions_router
from .freight_settlements import router as freight_settlements_router

router = APIRouter(prefix="/apps/kuaitms", tags=["TMS"])

# 注册所有子路由
router.include_router(transport_demands_router)
router.include_router(transport_plans_router)
router.include_router(vehicle_dispatches_router)
router.include_router(transport_executions_router)
router.include_router(freight_settlements_router)

