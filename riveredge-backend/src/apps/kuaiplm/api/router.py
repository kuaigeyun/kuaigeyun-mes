"""
快研发 (kuaiplm) APP - 主路由
"""

from fastapi import APIRouter

from .projects import router as projects_router
from .knowledge import router as knowledge_router
from .changes import router as changes_router
from .dashboard import router as dashboard_router
from .phase2 import router as phase2_router
from .gate_templates import router as gate_templates_router

router = APIRouter(tags=["App · Kuaiplm · Overview"])

router.include_router(projects_router)
router.include_router(knowledge_router)
router.include_router(changes_router)
router.include_router(dashboard_router)
router.include_router(phase2_router)
router.include_router(gate_templates_router)


@router.get("/health")
async def health_check():
    return {"status": "ok", "app": "kuaiplm"}
