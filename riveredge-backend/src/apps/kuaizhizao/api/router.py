"""
快格轻制造 APP - 主路由

统一管理所有 API 路由。

Author: Auto (AI Assistant)
Date: 2025-01-01
"""

from fastapi import APIRouter

# 导入子路由（按资源分目录，主文件复数与目录一致）
from .productions.productions import router as production_router
from .productions.document_relations_legacy import router as document_relations_legacy_router
from .productions.production_control_api import router as production_control_router
from .productions.coordination_board_api import router as coordination_board_router
from .purchases.purchases import router as purchase_router
from .purchase_requisitions.purchase_requisitions import router as purchase_requisition_router
from .purchase_inquiries.purchase_inquiries import router as purchase_inquiry_router
from .material_calls.material_calls import router as material_call_router

from .demands.demands import router as demand_router
from .demand_computations.demand_computations import router as demand_computation_router
from .sales_orders.sales_orders import router as sales_order_router
from .sales_order_changes.sales_order_changes import router as sales_order_change_router
from .purchase_order_changes.purchase_order_changes import router as purchase_order_change_router
from .quotations.quotations import router as quotation_router
from .sales_contracts.sales_contracts import router as sales_contract_router
from .sales_contracts.sales_contract_terms import router as sales_contract_terms_router
from .delivery_notices.delivery_notices import router as delivery_notice_router
from .shipment_notices.shipment_notices import router as shipment_notice_router
from .receipt_notices.receipt_notices import router as receipt_notice_router
from .customer_follow_ups.customer_follow_ups import router as customer_follow_up_router
from .sales_opportunities.sales_opportunities import router as sales_opportunity_router
from .customer_pool.customer_pool import router as customer_pool_router
from .state_transitions.state_transitions import router as state_transition_router
from .document_push_pull.document_push_pull import router as document_push_pull_router
from .document_relations.document_relations import router as document_relation_router
from .routes_print import router as print_router
from .visual_scheduling.visual_scheduling import router as visual_scheduling_router
from .rolling_schedules.rolling_schedules import router as rolling_schedules_router
from .scheduling_configs.scheduling_configs import router as scheduling_config_router
from .dashboards.dashboards import router as dashboard_router
from .reports.reports import router as reports_router
from .wave_pickings.wave_pickings import router as wave_picking_router

# 导入设备管理路由
from .equipment.equipment import router as equipment_router
from .maintenance_plans.maintenance_plans import router as maintenance_plans_router
from .equipment_faults.equipment_faults import router as equipment_faults_router
from .molds.molds import router as molds_router
from .tools.tools import router as tools_router
from .equipment_status.equipment_status import router as equipment_status_router
from .maintenance_reminders.maintenance_reminders import router as maintenance_reminders_router
from .equipment_inspections.equipment_inspections import router as equipment_inspections_router
from .equipment_inspections.spare_parts import router as spare_parts_router
from .equipment_inspections.spare_part_requisitions import router as spare_part_requisitions_router
from .equipment_ops import router as equipment_ops_router
from .mold_ops import router as mold_ops_router
from .tool_ops import router as tool_ops_router

# 成本核算路由已迁移至 kuaicaiwu

# 发票管理已迁移至 kuaicaiwu

# 导入期初数据导入路由
from .initial_data.initial_data import router as initial_data_router
# 导入线边仓与倒冲记录路由
from .line_side_warehouses.line_side_warehouses import router as line_side_warehouse_router, backflush_router
# 导入应用中心管理路由
from .management import router as management_router

# 创建主路由
router = APIRouter(tags=["App · Kuaige Zhizao · MES"])

# 注意：路由前缀使用 kuaizhizao（不带连字符），因为这是 URL 路径
# 但目录名使用 kuaizhizao（不带下划线），保持一致性

# 注册子路由
router.include_router(sales_order_router)  # 销售订单管理（独立API）- 优先匹配
router.include_router(sales_order_change_router)  # 销售变更单
router.include_router(purchase_order_change_router)  # 采购变更单
router.include_router(quotation_router)  # 报价单管理
router.include_router(sales_contract_terms_router)  # 条款项/条款组（须在 /{contract_id} 之前）
router.include_router(sales_contract_router)  # 销售合同
router.include_router(delivery_notice_router)  # 送货单管理
router.include_router(print_router)  # 打印预设加载
router.include_router(shipment_notice_router)  # 发货通知单管理
router.include_router(receipt_notice_router)  # 收货通知单管理
router.include_router(customer_follow_up_router)  # 客户跟进（销售极简 CRM）
router.include_router(sales_opportunity_router)  # 销售商机
router.include_router(customer_pool_router)  # 客户池（公海管理）
router.include_router(production_router)
router.include_router(document_relations_legacy_router)
router.include_router(purchase_router)
router.include_router(purchase_requisition_router)
router.include_router(purchase_inquiry_router)
router.include_router(material_call_router)

router.include_router(demand_router)  # 统一需求管理（新设计）
router.include_router(demand_computation_router)  # 统一需求计算（新设计）
router.include_router(state_transition_router)  # 状态流转管理
router.include_router(document_push_pull_router)  # 单据下推和上拉
router.include_router(document_relation_router)  # 单据关联关系
router.include_router(scheduling_config_router)  # 排程配置
router.include_router(visual_scheduling_router)  # 可视排产诊断
router.include_router(rolling_schedules_router)  # 滚动计划
router.include_router(production_control_router)  # 生产计划管控塔
router.include_router(coordination_board_router)  # 生产协调看板
router.include_router(dashboard_router)

# 注册设备管理路由
router.include_router(equipment_router)
router.include_router(maintenance_plans_router)
router.include_router(equipment_faults_router)
router.include_router(molds_router)
router.include_router(tools_router)
router.include_router(equipment_status_router)
router.include_router(maintenance_reminders_router)
router.include_router(equipment_inspections_router)
router.include_router(equipment_ops_router)
router.include_router(mold_ops_router)
router.include_router(tool_ops_router)
router.include_router(spare_parts_router)
router.include_router(spare_part_requisitions_router)

# 注册期初数据导入路由
router.include_router(initial_data_router)

# 注册线边仓与倒冲记录路由
router.include_router(line_side_warehouse_router)
router.include_router(backflush_router)
router.include_router(management_router)

# 注册追溯管理路由
from .traceability.traceability import router as traceability_router
router.include_router(traceability_router, prefix="/traceability")

# 注册报表路由
router.include_router(reports_router)

# 注册波次拣货路由
router.include_router(wave_picking_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口

    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaizhizao"}
