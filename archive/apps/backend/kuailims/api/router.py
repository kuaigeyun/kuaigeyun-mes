"""
LIMS API 路由模块

统一管理所有LIMS相关的API路由。
"""

from fastapi import APIRouter
from .sample_managements import router as sample_managements_router
from .experiment_managements import router as experiment_managements_router
from .data_managements import router as data_managements_router
from .report_managements import router as report_managements_router

router = APIRouter(prefix="/apps/kuailims", tags=["LIMS"])

# 注册所有子路由
router.include_router(sample_managements_router)
router.include_router(experiment_managements_router)
router.include_router(data_managements_router)
router.include_router(report_managements_router)

