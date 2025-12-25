"""
MES API 主路由

统一管理所有 MES API 路由。
"""

from fastapi import APIRouter
from apps.kuaimes.api.orders.orders import router as orders_router
from apps.kuaimes.api.work_orders.work_orders import router as work_orders_router
from apps.kuaimes.api.production_reports.production_reports import router as production_reports_router
from apps.kuaimes.api.traceabilities.traceabilities import router as traceabilities_router
from apps.kuaimes.api.rework_orders.rework_orders import router as rework_orders_router

router = APIRouter(prefix="/apps/kuaimes", tags=["MES"])

# 注册各个模块的路由
router.include_router(orders_router)
router.include_router(work_orders_router)
router.include_router(production_reports_router)
router.include_router(traceabilities_router)
router.include_router(rework_orders_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaimes"}
