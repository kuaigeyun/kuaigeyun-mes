"""快视觉 API 路由。"""

from fastapi import APIRouter

from .agents import router as agents_router
from .cameras import router as cameras_router
from .dashboard import router as dashboard_router
from .edge import router as edge_router
from .ingest import router as ingest_router
from .inspections import router as inspections_router
from .models import router as models_router
from .recipes import router as recipes_router
from .reviews import router as reviews_router
from .samples import router as samples_router
from .settings import router as settings_router

router = APIRouter(tags=["App - KuaiVision - Overview"])

router.include_router(dashboard_router)
router.include_router(inspections_router)
router.include_router(agents_router)
router.include_router(cameras_router)
router.include_router(recipes_router)
router.include_router(reviews_router)
router.include_router(models_router)
router.include_router(samples_router)
router.include_router(settings_router)
router.include_router(ingest_router)
router.include_router(edge_router)


@router.get("/health")
async def health_check():
    return {"status": "ok", "app": "kuaivision"}
