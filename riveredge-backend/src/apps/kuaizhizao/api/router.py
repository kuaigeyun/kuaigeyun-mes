"""
快格轻制造 APP - 主路由

统一管理所有 API 路由。

Author: Auto (AI Assistant)
Date: 2025-01-01
"""

from fastapi import APIRouter

# 导入子路由（按资源分目录，主文件复数与目录一致）
from .productions.productions import router as production_router
from .purchases.purchases import router as purchase_router
from .purchase_requisitions.purchase_requisitions import router as purchase_requisition_router

from .demands.demands import router as demand_router
from .demand_computations.demand_computations import router as demand_computation_router
from .sales_orders.sales_orders import router as sales_order_router
from .quotations.quotations import router as quotation_router
from .delivery_notices.delivery_notices import router as delivery_notice_router
from .sample_trials.sample_trials import router as sample_trial_router
from .approval_flows.approval_flows import router as approval_flow_router
from .state_transitions.state_transitions import router as state_transition_router
from .document_push_pull.document_push_pull import router as document_push_pull_router
from .document_relations.document_relations import router as document_relation_router
from .computation_configs.computation_configs import router as computation_config_router
from .dashboards.dashboards import router as dashboard_router
from .reports.reports import router as reports_router

# 导入设备管理路由
from .equipment.equipment import router as equipment_router
from .maintenance_plans.maintenance_plans import router as maintenance_plans_router
from .equipment_faults.equipment_faults import router as equipment_faults_router
from .molds.molds import router as molds_router
from .tools.tools import router as tools_router
from .equipment_status.equipment_status import router as equipment_status_router
from .maintenance_reminders.maintenance_reminders import router as maintenance_reminders_router

# 导入成本核算路由
from .cost.cost_rules import router as cost_rules_router
from .cost.cost_calculations import router as cost_calculations_router
from .cost.production_cost import router as production_cost_router
from .cost.outsource_cost import router as outsource_cost_router
from .cost.purchase_cost import router as purchase_cost_router
from .cost.quality_cost import router as quality_cost_router
from .cost.cost_comparison import router as cost_comparison_router
from .cost.cost_optimization import router as cost_optimization_router
from .cost.cost_report import router as cost_report_router

# 导入财务管理路由
from .finance.payables import router as payables_router
from .finance.receivables import router as receivables_router
from .finance.invoices import router as invoices_router

# 导入期初数据导入路由
from .initial_data.initial_data import router as initial_data_router
# 导入线边仓与倒冲记录路由
from .line_side_warehouses.line_side_warehouses import router as line_side_warehouse_router, backflush_router

# 创建主路由
router = APIRouter(tags=["Kuaige Zhizao MES"])

# 注意：路由前缀使用 kuaizhizao（不带连字符），因为这是 URL 路径
# 但目录名使用 kuaizhizao（不带下划线），保持一致性

# 注册子路由
router.include_router(sales_order_router)  # 销售订单管理（独立API）- 优先匹配
router.include_router(quotation_router)  # 报价单管理
router.include_router(delivery_notice_router)  # 发货通知单管理
router.include_router(sample_trial_router)  # 样品试用单管理
router.include_router(production_router)
router.include_router(purchase_router)
router.include_router(purchase_requisition_router)

router.include_router(demand_router)  # 统一需求管理（新设计）
router.include_router(demand_computation_router)  # 统一需求计算（新设计）
router.include_router(approval_flow_router)  # 审核流程管理
router.include_router(state_transition_router)  # 状态流转管理
router.include_router(document_push_pull_router)  # 单据下推和上拉
router.include_router(document_relation_router)  # 单据关联关系
router.include_router(computation_config_router)  # 需求计算参数配置
router.include_router(dashboard_router)

# 注册设备管理路由
router.include_router(equipment_router)
router.include_router(maintenance_plans_router)
router.include_router(equipment_faults_router)
router.include_router(molds_router)
router.include_router(tools_router)
router.include_router(equipment_status_router)
router.include_router(maintenance_reminders_router)

# 注册成本核算路由
router.include_router(cost_rules_router)
router.include_router(cost_calculations_router)
router.include_router(production_cost_router)
router.include_router(outsource_cost_router)
router.include_router(purchase_cost_router)
router.include_router(quality_cost_router)
router.include_router(cost_comparison_router)
router.include_router(cost_optimization_router)
router.include_router(cost_report_router)

# 注册财务管理路由
router.include_router(payables_router)
router.include_router(receivables_router)
router.include_router(invoices_router)

# 注册期初数据导入路由
router.include_router(initial_data_router)

# 注册线边仓与倒冲记录路由
router.include_router(line_side_warehouse_router)
router.include_router(backflush_router)

# 注册追溯管理路由
from .traceability.traceability import router as traceability_router
router.include_router(traceability_router, prefix="/traceability")

# 注册报表路由
router.include_router(reports_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口

    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaizhizao"}
