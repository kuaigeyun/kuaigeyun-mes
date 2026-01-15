"""
快格轻制造 APP - 主路由

统一管理所有 API 路由。

Author: Auto (AI Assistant)
Date: 2025-01-01
"""

from fastapi import APIRouter

# 导入子路由
from .production import router as production_router
from .purchase import router as purchase_router
from .sales import router as sales_router
from .demand import router as demand_router
from .demand_computation import router as demand_computation_router
from .approval_flow import router as approval_flow_router
from .state_transition import router as state_transition_router
from .document_push_pull import router as document_push_pull_router
from .dashboard import router as dashboard_router

# 导入设备管理路由
from .equipment.equipment import router as equipment_router
from .maintenance_plans.maintenance_plans import router as maintenance_plans_router
from .equipment_faults.equipment_faults import router as equipment_faults_router
from .molds.molds import router as molds_router

# 导入成本核算路由
from .cost.cost_rules import router as cost_rules_router
from .cost.cost_calculations import router as cost_calculations_router

# 导入期初数据导入路由
from .initial_data import router as initial_data_router

# 创建主路由
router = APIRouter(tags=["Kuaige Zhizao MES"])

# 注意：路由前缀使用 kuaizhizao（不带连字符），因为这是 URL 路径
# 但目录名使用 kuaizhizao（不带下划线），保持一致性

# 注册子路由
router.include_router(production_router)
router.include_router(purchase_router)
router.include_router(sales_router)
router.include_router(demand_router)  # 统一需求管理（新设计）
router.include_router(demand_computation_router)  # 统一需求计算（新设计）
router.include_router(approval_flow_router)  # 审核流程管理
router.include_router(state_transition_router)  # 状态流转管理
router.include_router(document_push_pull_router)  # 单据下推和上拉
router.include_router(dashboard_router)

# 注册设备管理路由
router.include_router(equipment_router)
router.include_router(maintenance_plans_router)
router.include_router(equipment_faults_router)
router.include_router(molds_router)

# 注册成本核算路由
router.include_router(cost_rules_router)
router.include_router(cost_calculations_router)

# 注册期初数据导入路由
router.include_router(initial_data_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口

    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaizhizao"}
