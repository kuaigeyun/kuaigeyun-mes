"""
将模型 table_description 同步为数据库表注释（COMMENT ON TABLE）

覆盖 apps_kuaizhizao_* 与 apps_kuaireport_* 所有已定义注释的表。
若表不存在则跳过（DO 块内执行单条 COMMENT，失败不影响其他）。

Author: 表注释统一迁移
Date: 2026-02-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

# (表名, 注释) — 与 models 中 table_description 一致
COMMENTS = [
    # 快格轻制造 - 设备/模具/工装/保养
    ("apps_kuaizhizao_equipment", "快格轻制造 - 设备"),
    ("apps_kuaizhizao_equipment_calibrations", "快格轻制造 - 设备校准记录"),
    ("apps_kuaizhizao_equipment_faults", "快格轻制造 - 设备故障"),
    ("apps_kuaizhizao_equipment_repairs", "快格轻制造 - 设备维修记录"),
    ("apps_kuaizhizao_maintenance_plans", "快格轻制造 - 保养计划"),
    ("apps_kuaizhizao_maintenance_executions", "快格轻制造 - 保养执行记录"),
    ("apps_kuaizhizao_molds", "快格轻制造 - 模具"),
    ("apps_kuaizhizao_mold_usages", "快格轻制造 - 模具使用记录"),
    ("apps_kuaizhizao_mold_calibrations", "快格轻制造 - 模具校准记录"),
    ("apps_kuaizhizao_tools", "快格轻制造 - 工装"),
    ("apps_kuaizhizao_tool_usages", "快格轻制造 - 工装领用归还记录"),
    ("apps_kuaizhizao_tool_maintenances", "快格轻制造 - 工装维保记录"),
    ("apps_kuaizhizao_tool_calibrations", "快格轻制造 - 工装校验记录"),
    # 生产/工单/报工
    ("apps_kuaizhizao_work_orders", "快格轻制造 - 工单"),
    ("apps_kuaizhizao_work_order_operations", "快格轻制造 - 工单工序"),
    ("apps_kuaizhizao_reporting_records", "快格轻制造 - 报工记录"),
    ("apps_kuaizhizao_backflush_records", "快格轻制造 - 物料倒冲记录"),
    ("apps_kuaizhizao_line_side_inventory", "快格轻制造 - 线边仓库存"),
    # 委外/返工
    ("apps_kuaizhizao_outsource_orders", "快格轻制造 - 委外单"),
    ("apps_kuaizhizao_outsource_work_orders", "快格轻制造 - 委外工单"),
    ("apps_kuaizhizao_outsource_material_issues", "快格轻制造 - 委外发料单"),
    ("apps_kuaizhizao_outsource_material_receipts", "快格轻制造 - 委外收料单"),
    ("apps_kuaizhizao_rework_orders", "快格轻制造 - 返工工单"),
    # 需求/计算
    ("apps_kuaizhizao_demands", "快格轻制造 - 统一需求"),
    ("apps_kuaizhizao_demand_items", "快格轻制造 - 统一需求明细"),
    ("apps_kuaizhizao_demand_computations", "快格轻制造 - 统一需求计算"),
    ("apps_kuaizhizao_demand_computation_items", "快格轻制造 - 统一需求计算明细"),
    ("apps_kuaizhizao_computation_configs", "快格轻制造 - 需求计算参数配置"),
    ("apps_kuaizhizao_lrp_results", "快格轻制造 - LRP运算结果（已废弃）"),
    ("apps_kuaizhizao_mrp_results", "快格轻制造 - MRP运算结果（已废弃）"),
    # 销售/采购/出入库
    ("apps_kuaizhizao_sales_orders", "快格轻制造 - 销售订单"),
    ("apps_kuaizhizao_sales_order_items", "快格轻制造 - 销售订单明细"),
    ("apps_kuaizhizao_sales_forecasts", "快格轻制造 - 销售预测"),
    ("apps_kuaizhizao_sales_forecast_items", "快格轻制造 - 销售预测明细"),
    ("apps_kuaizhizao_sales_deliveries", "快格轻制造 - 销售出库单"),
    ("apps_kuaizhizao_sales_delivery_items", "快格轻制造 - 销售出库单明细"),
    ("apps_kuaizhizao_sales_returns", "快格轻制造 - 销售退货单"),
    ("apps_kuaizhizao_sales_return_items", "快格轻制造 - 销售退货单明细"),
    ("apps_kuaizhizao_purchase_requisitions", "快格轻制造 - 采购申请"),
    ("apps_kuaizhizao_purchase_requisition_items", "快格轻制造 - 采购申请明细"),
    ("apps_kuaizhizao_purchase_orders", "快格轻制造 - 采购订单"),
    ("apps_kuaizhizao_purchase_order_items", "快格轻制造 - 采购订单明细"),
    ("apps_kuaizhizao_purchase_receipts", "快格轻制造 - 采购入库单"),
    ("apps_kuaizhizao_purchase_receipt_items", "快格轻制造 - 采购入库单明细"),
    ("apps_kuaizhizao_purchase_returns", "快格轻制造 - 采购退货单"),
    ("apps_kuaizhizao_purchase_return_items", "快格轻制造 - 采购退货单明细"),
    ("apps_kuaizhizao_purchase_invoices", "快格轻制造 - 采购发票"),
    # 生产计划/领料
    ("apps_kuaizhizao_production_plans", "快格轻制造 - 生产计划"),
    ("apps_kuaizhizao_production_plan_items", "快格轻制造 - 生产计划明细"),
    ("apps_kuaizhizao_production_pickings", "快格轻制造 - 生产领料单"),
    ("apps_kuaizhizao_production_picking_items", "快格轻制造 - 生产领料单明细"),
    # 检验/成品
    ("apps_kuaizhizao_incoming_inspections", "快格轻制造 - 来料检验单"),
    ("apps_kuaizhizao_process_inspections", "快格轻制造 - 过程检验单"),
    ("apps_kuaizhizao_finished_goods_inspections", "快格轻制造 - 成品检验单"),
    ("apps_kuaizhizao_finished_goods_receipts", "快格轻制造 - 成品入库单"),
    ("apps_kuaizhizao_finished_goods_receipt_items", "快格轻制造 - 成品入库单明细"),
    # 财务
    ("apps_kuaizhizao_receivables", "快格轻制造 - 应收单"),
    ("apps_kuaizhizao_payables", "快格轻制造 - 应付单"),
    ("apps_kuaizhizao_invoices", "快格轻制造 - 发票库"),
    ("apps_kuaizhizao_invoice_items", "快格轻制造 - 发票明细"),
    # 审核/状态
    ("apps_kuaizhizao_approval_flows", "快格轻制造 - 审核流程"),
    ("apps_kuaizhizao_approval_flow_steps", "快格轻制造 - 审核流程步骤"),
    ("apps_kuaizhizao_approval_records", "快格轻制造 - 审核记录"),
    ("apps_kuaizhizao_state_transition_rules", "快格轻制造 - 状态流转规则"),
    ("apps_kuaizhizao_state_transition_logs", "快格轻制造 - 状态流转日志"),
    ("apps_kuaizhizao_document_relations", "快格轻制造 - 单据关联关系"),
    ("apps_kuaizhizao_document_node_timings", "快格轻制造 - 单据节点耗时"),
    # 质量/异常
    ("apps_kuaizhizao_quality_standards", "快格轻制造 - 质量检验标准"),
    ("apps_kuaizhizao_defect_records", "快格轻制造 - 不良品记录"),
    ("apps_kuaizhizao_quality_exceptions", "快格轻制造 - 质量异常"),
    ("apps_kuaizhizao_delivery_delay_exceptions", "快格轻制造 - 交期延期异常"),
    ("apps_kuaizhizao_material_shortage_exceptions", "快格轻制造 - 缺料异常"),
    ("apps_kuaizhizao_exception_process_records", "快格轻制造 - 异常处理记录"),
    ("apps_kuaizhizao_exception_process_histories", "快格轻制造 - 异常处理历史"),
    # 设备状态/保养提醒
    ("apps_kuaizhizao_equipment_status_monitors", "快格轻制造 - 设备状态监控"),
    ("apps_kuaizhizao_equipment_status_histories", "快格轻制造 - 设备状态历史"),
    ("apps_kuaizhizao_maintenance_reminders", "快格轻制造 - 保养提醒"),
    # 成本/补货/库存
    ("apps_kuaizhizao_cost_rules", "快格轻制造 - 成本核算规则"),
    ("apps_kuaizhizao_cost_calculations", "快格轻制造 - 成本核算"),
    ("apps_kuaizhizao_replenishment_suggestions", "快格轻制造 - 补货建议"),
    ("apps_kuaizhizao_inventory_transfers", "快格轻制造 - 库存调拨单"),
    ("apps_kuaizhizao_inventory_transfer_items", "快格轻制造 - 库存调拨单明细"),
    ("apps_kuaizhizao_inventory_alert_rules", "快格轻制造 - 库存预警规则"),
    ("apps_kuaizhizao_inventory_alerts", "快格轻制造 - 库存预警"),
    ("apps_kuaizhizao_stocktakings", "快格轻制造 - 盘点单"),
    ("apps_kuaizhizao_stocktaking_items", "快格轻制造 - 盘点单明细"),
    ("apps_kuaizhizao_material_bindings", "快格轻制造 - 物料绑定记录"),
    ("apps_kuaizhizao_packing_bindings", "快格轻制造 - 装箱打包绑定记录"),
    ("apps_kuaizhizao_scrap_records", "快格轻制造 - 报废记录"),
    # 条码/客户来料
    ("apps_kuaizhizao_barcode_mapping_rules", "快格轻制造 - 条码映射规则"),
    ("apps_kuaizhizao_customer_material_registrations", "快格轻制造 - 客户来料登记"),
    # 其他
    ("apps_kuaizhizao_launch_countdowns", "快格轻制造 - 上线倒计时"),
    # 快格报表
    ("apps_kuaireport_reports", "快格报表 - 报表定义"),
    ("apps_kuaireport_dashboards", "快格报表 - 大屏定义"),
    ("apps_kuaireport_data_sources", "快格报表 - 数据源"),
]


def _comment_sql(table: str, comment: str) -> str:
    # 注释内单引号需转义为 ''
    escaped = comment.replace("'", "''")
    return f'COMMENT ON TABLE "{table}" IS \'{escaped}\';'


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table, comment in COMMENTS:
        parts.append(
            f"""        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '{table}') THEN
                {_comment_sql(table, comment)}
            END IF;
        END $$;"""
        )
    return "\n".join(parts).strip()


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 回滚时仅清空注释（设为空字符串或 NULL 不可用，用空注释）
    parts = []
    for table, _ in COMMENTS:
        parts.append(
            f"""        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '{table}') THEN
                COMMENT ON TABLE "{table}" IS '';
            END IF;
        END $$;"""
        )
    return "\n".join(parts).strip()
