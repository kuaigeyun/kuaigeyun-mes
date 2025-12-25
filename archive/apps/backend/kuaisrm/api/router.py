"""
SRM API 主路由

统一管理所有 SRM API 路由。
"""

from fastapi import APIRouter
from apps.kuaisrm.api.purchase_orders import router as purchase_orders_router
from apps.kuaisrm.api.outsourcing_orders import router as outsourcing_orders_router
from apps.kuaisrm.api.supplier_evaluations import router as supplier_evaluations_router
from apps.kuaisrm.api.purchase_contracts import router as purchase_contracts_router

router = APIRouter(prefix="/apps/kuaisrm", tags=["SRM"])

# 注册各个模块的路由
router.include_router(purchase_orders_router)
router.include_router(outsourcing_orders_router)
router.include_router(supplier_evaluations_router)
router.include_router(purchase_contracts_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaisrm"}
