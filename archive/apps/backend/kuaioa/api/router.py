"""
OA模块 API 路由

整合所有协同办公相关的 API 路由。
"""

from fastapi import APIRouter
from apps.kuaioa.api.approval_processes import router as approval_processes_router
from apps.kuaioa.api.approval_instances import router as approval_instances_router
from apps.kuaioa.api.approval_nodes import router as approval_nodes_router
from apps.kuaioa.api.documents import router as documents_router
from apps.kuaioa.api.document_versions import router as document_versions_router
from apps.kuaioa.api.meetings import router as meetings_router
from apps.kuaioa.api.meeting_minutes import router as meeting_minutes_router
from apps.kuaioa.api.meeting_resources import router as meeting_resources_router
from apps.kuaioa.api.notices import router as notices_router
from apps.kuaioa.api.notifications import router as notifications_router

router = APIRouter(prefix="/kuaioa", tags=["OA"])

# 注册子路由
router.include_router(approval_processes_router)
router.include_router(approval_instances_router)
router.include_router(approval_nodes_router)
router.include_router(documents_router)
router.include_router(document_versions_router)
router.include_router(meetings_router)
router.include_router(meeting_minutes_router)
router.include_router(meeting_resources_router)
router.include_router(notices_router)
router.include_router(notifications_router)
