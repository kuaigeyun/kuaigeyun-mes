"""
KU-AI (kuaiai) APP - 主路由

智能建议 API，路由挂载于 /api/v1/apps/kuaiai
"""

from fastapi import APIRouter

from .suggestions import router as suggestions_router

router = APIRouter(tags=["App · KU-AI · Overview"])

router.include_router(suggestions_router)


@router.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "app": "kuaiai"}
