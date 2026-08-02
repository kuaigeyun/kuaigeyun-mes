from fastapi import APIRouter
from .report import router as report_router
from .dashboard import router as dashboard_router
from .data_source import router as data_source_router
from apps.kuaireport.constants import ChartType

router = APIRouter(tags=["App - KuanReport - Overview"])


@router.get("/chart-types", summary="List chart types")
async def get_chart_types() -> list:
    """返回可用图表类型，供前端选择器使用，单一数据源"""
    return [e.value for e in ChartType]


router.include_router(report_router)
router.include_router(dashboard_router)
router.include_router(data_source_router)

@router.get("/health")
async def health_check():
    return {"status": "ok", "app": "kuaireport"}
