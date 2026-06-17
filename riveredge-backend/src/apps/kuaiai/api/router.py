"""
KU-AI (kuaiai) APP - 主路由

智能建议 API，路由挂载于 /api/v1/apps/kuaiai
"""

from fastapi import APIRouter

from .chat import router as chat_router
from .documents import router as documents_router
from .knowledge import router as knowledge_router
from .suggestions import router as suggestions_router
from .training import router as training_router

router = APIRouter(tags=["App · KU-AI · Overview"])

router.include_router(suggestions_router)
router.include_router(chat_router)
router.include_router(documents_router)
router.include_router(knowledge_router)
router.include_router(training_router)


@router.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "app": "kuaiai"}
