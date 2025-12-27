"""
PDM API 主路由

统一管理所有 PDM API 路由。
"""

from fastapi import APIRouter
from apps.kuaipdm.api.design_changes import router as design_changes_router
from apps.kuaipdm.api.engineering_changes import router as engineering_changes_router
from apps.kuaipdm.api.design_reviews import router as design_reviews_router
from apps.kuaipdm.api.research_processes import router as research_processes_router
from apps.kuaipdm.api.knowledges import router as knowledges_router

router = APIRouter(prefix="/apps/kuaipdm", tags=["PDM"])

# 注册各个模块的路由
router.include_router(design_changes_router)
router.include_router(engineering_changes_router)
router.include_router(design_reviews_router)
router.include_router(research_processes_router)
router.include_router(knowledges_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaipdm"}
