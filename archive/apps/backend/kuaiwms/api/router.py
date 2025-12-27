"""
WMS API 主路由

统一管理所有 WMS API 路由。
"""

from fastapi import APIRouter
from apps.kuaiwms.api.inventories import router as inventories_router
from apps.kuaiwms.api.inbound_orders import router as inbound_orders_router
from apps.kuaiwms.api.outbound_orders import router as outbound_orders_router
from apps.kuaiwms.api.stocktakes import router as stocktakes_router
from apps.kuaiwms.api.inventory_adjustments import router as inventory_adjustments_router

router = APIRouter(prefix="/apps/kuaiwms", tags=["WMS"])

# 注册各个模块的路由
router.include_router(inventories_router)
router.include_router(inbound_orders_router)
router.include_router(outbound_orders_router)
router.include_router(stocktakes_router)
router.include_router(inventory_adjustments_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaiwms"}
