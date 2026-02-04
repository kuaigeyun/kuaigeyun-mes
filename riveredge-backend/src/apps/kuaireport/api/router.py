from fastapi import APIRouter
from .report import router as report_router
from .dashboard import router as dashboard_router
from .data_source import router as data_source_router

router = APIRouter(tags=["KuanReport"])

router.include_router(report_router)
router.include_router(dashboard_router)
router.include_router(data_source_router)

@router.get("/health")
async def health_check():
    return {"status": "ok", "app": "kuaireport"}
