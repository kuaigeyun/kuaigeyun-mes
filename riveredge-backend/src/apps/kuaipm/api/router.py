"""
PM模块 API 路由

整合所有项目管理相关的 API 路由。
"""

from fastapi import APIRouter
from apps.kuaipm.api.projects import router as projects_router
from apps.kuaipm.api.project_applications import router as project_applications_router
from apps.kuaipm.api.project_wbss import router as project_wbss_router
from apps.kuaipm.api.project_tasks import router as project_tasks_router
from apps.kuaipm.api.project_resources import router as project_resources_router
from apps.kuaipm.api.project_progresses import router as project_progresses_router
from apps.kuaipm.api.project_costs import router as project_costs_router
from apps.kuaipm.api.project_risks import router as project_risks_router
from apps.kuaipm.api.project_qualities import router as project_qualities_router

router = APIRouter(prefix="/kuaipm", tags=["PM"])

# 注册子路由
router.include_router(projects_router)
router.include_router(project_applications_router)
router.include_router(project_wbss_router)
router.include_router(project_tasks_router)
router.include_router(project_resources_router)
router.include_router(project_progresses_router)
router.include_router(project_costs_router)
router.include_router(project_risks_router)
router.include_router(project_qualities_router)
