"""轻办公 (kuaioa) APP - 主路由。"""

from fastapi import APIRouter

from .assets import router as assets_router
from .forms import router as forms_router
from .licenses import router as licenses_router
from .training import router as training_router

router = APIRouter(tags=["App - Kuaioa - Overview"])

router.include_router(forms_router)
router.include_router(training_router)
router.include_router(licenses_router)
router.include_router(assets_router)


@router.get("/health")
async def health_check():
    return {"status": "ok", "app": "kuaioa"}
