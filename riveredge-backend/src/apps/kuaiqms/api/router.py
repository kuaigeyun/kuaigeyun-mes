"""
QMS API 主路由

统一管理所有 QMS API 路由。
"""

from fastapi import APIRouter
from apps.kuaiqms.api.inspection_tasks import router as inspection_tasks_router
from apps.kuaiqms.api.inspection_records import router as inspection_records_router
from apps.kuaiqms.api.nonconforming_products import router as nonconforming_products_router
from apps.kuaiqms.api.nonconforming_handlings import router as nonconforming_handlings_router
from apps.kuaiqms.api.quality_traceabilities import router as quality_traceabilities_router
from apps.kuaiqms.api.iso_audits import router as iso_audits_router
from apps.kuaiqms.api.capas import router as capas_router
from apps.kuaiqms.api.continuous_improvements import router as continuous_improvements_router
from apps.kuaiqms.api.quality_objectives import router as quality_objectives_router
from apps.kuaiqms.api.quality_indicators import router as quality_indicators_router

router = APIRouter(prefix="/apps/kuaiqms", tags=["QMS"])

# 注册各个模块的路由
router.include_router(inspection_tasks_router)
router.include_router(inspection_records_router)
router.include_router(nonconforming_products_router)
router.include_router(nonconforming_handlings_router)
router.include_router(quality_traceabilities_router)
router.include_router(iso_audits_router)
router.include_router(capas_router)
router.include_router(continuous_improvements_router)
router.include_router(quality_objectives_router)
router.include_router(quality_indicators_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaiqms"}
