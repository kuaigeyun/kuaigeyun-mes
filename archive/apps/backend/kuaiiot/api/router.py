"""
IOT API 路由模块

统一管理所有IOT相关的API路由。
"""

from fastapi import APIRouter
from apps.kuaiiot.api.device_data_collections import router as device_data_collections_router
from apps.kuaiiot.api.sensor_configurations import router as sensor_configurations_router
from apps.kuaiiot.api.sensor_data import router as sensor_data_router
from apps.kuaiiot.api.real_time_monitorings import router as real_time_monitorings_router
from apps.kuaiiot.api.data_alerts import router as data_alerts_router

router = APIRouter(prefix="/kuaiiot", tags=["IOT"])

# 注册子路由
router.include_router(device_data_collections_router)
router.include_router(sensor_configurations_router)
router.include_router(sensor_data_router)
router.include_router(real_time_monitorings_router)
router.include_router(data_alerts_router)

