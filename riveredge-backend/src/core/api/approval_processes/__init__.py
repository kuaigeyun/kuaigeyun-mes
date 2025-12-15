"""
审批流程 API 模块

包含审批流程和审批实例的 API 路由。
"""

from .approval_processes import router as approval_processes_router
from .approval_instances import router as approval_instances_router
from .approval_histories import router as approval_histories_router

# 将审批历史记录路由注册到审批实例路由下
approval_instances_router.include_router(approval_histories_router)

__all__ = [
    "approval_processes_router",
    "approval_instances_router",
]

