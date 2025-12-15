"""
CRM APP - 主路由

统一管理所有 API 路由。
"""

from fastapi import APIRouter

# 导入各个模块的路由
from apps.kuaicrm.api.leads import router as leads_router
from apps.kuaicrm.api.opportunities import router as opportunities_router
from apps.kuaicrm.api.sales_orders import router as sales_orders_router
from apps.kuaicrm.api.service_workorders import router as service_workorders_router
from apps.kuaicrm.api.warranties import router as warranties_router
from apps.kuaicrm.api.complaints import router as complaints_router
from apps.kuaicrm.api.installations import router as installations_router
from apps.kuaicrm.api.service_contracts import router as service_contracts_router
from apps.kuaicrm.api.funnel import router as funnel_router
from apps.kuaicrm.api.lead_followups import router as lead_followups_router
from apps.kuaicrm.api.opportunity_followups import router as opportunity_followups_router

# 创建主路由
router = APIRouter(prefix="/apps/kuaicrm", tags=["CRM"])

# 注册各个模块的路由
router.include_router(leads_router)
router.include_router(opportunities_router)
router.include_router(sales_orders_router)
router.include_router(service_workorders_router)
router.include_router(warranties_router)
router.include_router(complaints_router)
router.include_router(installations_router)
router.include_router(service_contracts_router)
router.include_router(funnel_router)
router.include_router(lead_followups_router)
router.include_router(opportunity_followups_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaicrm"}
