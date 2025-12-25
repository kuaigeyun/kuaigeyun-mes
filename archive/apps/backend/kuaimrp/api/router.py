"""
MRP API 主路由

统一管理所有 MRP API 路由。
"""

from fastapi import APIRouter
from apps.kuaimrp.api.mrp_plans import router as mrp_plans_router
from apps.kuaimrp.api.lrp_batches import router as lrp_batches_router
from apps.kuaimrp.api.material_requirements import router as material_requirements_router
from apps.kuaimrp.api.shortage_alerts import router as shortage_alerts_router

router = APIRouter(prefix="/apps/kuaimrp", tags=["MRP"])

# 注册各个模块的路由
router.include_router(mrp_plans_router)
router.include_router(lrp_batches_router)
router.include_router(material_requirements_router)
router.include_router(shortage_alerts_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaimrp"}
