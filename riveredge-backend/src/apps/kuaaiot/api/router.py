"""
IOT API 路由模块

统一管理所有IOT相关的API路由。
"""

from fastapi import APIRouter
from .device_data_collections import router as device_data_collections_router
from .sensor_datas import router as sensor_datas_router
from .real_time_monitorings import router as real_time_monitorings_router
from .data_interfaces import router as data_interfaces_router

router = APIRouter(prefix="/apps/kuaaiot", tags=["IOT"])

# 注册所有子路由
router.include_router(device_data_collections_router)
router.include_router(sensor_datas_router)
router.include_router(real_time_monitorings_router)
router.include_router(data_interfaces_router)

