"""轻办公 (kuaioa) APP - 主路由。"""

from fastapi import APIRouter

from .announcements import router as announcements_router
from .assets import router as assets_router
from .collaboration import router as collaboration_router
from .forms import router as forms_router
from .leave import router as leave_router
from .licenses import router as licenses_router
from .seal import router as seal_router
from .training import router as training_router
from .workbench import router as workbench_router

router = APIRouter(tags=["App - Kuaioa - Overview"])

router.include_router(workbench_router)
router.include_router(forms_router)
router.include_router(leave_router)
router.include_router(announcements_router)
router.include_router(seal_router)
router.include_router(collaboration_router)
router.include_router(training_router)
router.include_router(licenses_router)
router.include_router(assets_router)


@router.get("/health")
async def health_check():
    return {"status": "ok", "app": "kuaioa"}
