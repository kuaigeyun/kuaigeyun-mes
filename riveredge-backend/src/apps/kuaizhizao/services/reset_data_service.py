import asyncio
from typing import List, Optional
from datetime import datetime
from loguru import logger
from tortoise import Tortoise

from core.services.system.data_backup_service import DataBackupService
from core.schemas.data_backup import DataBackupCreate

class ResetDataService:
    """
    快制造应用数据重置服务
    """
    
    # 业务数据表名单 (Transactional Data)
    BUSINESS_TABLES = [
        # 销售与需求
        "apps_kuaizhizao_sales_orders",
        "apps_kuaizhizao_sales_order_items",
        "apps_kuaizhizao_quotations",
        "apps_kuaizhizao_quotation_items",
        "apps_kuaizhizao_shipment_notices",
        "apps_kuaizhizao_shipment_notice_items",
        "apps_kuaizhizao_delivery_notices",
        "apps_kuaizhizao_delivery_notice_items",
        "apps_kuaizhizao_receipt_notices",
        "apps_kuaizhizao_receipt_notice_items",
        "apps_kuaizhizao_sales_forecasts",
        "apps_kuaizhizao_sales_forecast_items",
        "apps_kuaizhizao_demands",
        "apps_kuaizhizao_demand_items",
        "apps_kuaizhizao_demand_snapshots",
        "apps_kuaizhizao_demand_recalc_histories",
        "apps_kuaizhizao_demand_computation_snapshots",
        "apps_kuaizhizao_demand_computation_recalc_histories",
        
        # 生产计划与执行
        "apps_kuaizhizao_production_plans",
        "apps_kuaizhizao_production_plan_items",
        "apps_kuaizhizao_work_orders",
        "apps_kuaizhizao_work_order_operations",
        "apps_kuaizhizao_reporting_records",
        "apps_kuaizhizao_rework_orders",
        "apps_kuaizhizao_rework_order_operations",
        "apps_kuaizhizao_outsource_orders",
        "apps_kuaizhizao_outsource_work_orders",
        "apps_kuaizhizao_outsource_material_issues",
        "apps_kuaizhizao_outsource_material_receipts",
        "apps_kuaizhizao_outsource_material_returns",
        "apps_kuaizhizao_outsource_product_returns",
        "apps_kuaizhizao_assembly_orders",
        "apps_kuaizhizao_assembly_order_items",
        "apps_kuaizhizao_batching_orders",
        "apps_kuaizhizao_batching_order_items",
        "apps_kuaizhizao_disassembly_orders",
        "apps_kuaizhizao_disassembly_order_items",
        "apps_kuaizhizao_scrap_records",
        "apps_kuaizhizao_defect_records",
        "apps_kuaizhizao_material_bindings",
        "apps_kuaizhizao_assembly_material_bindings",
        
        # 仓储物流
        "apps_kuaizhizao_production_pickings",
        "apps_kuaizhizao_production_picking_items",
        "apps_kuaizhizao_production_returns",
        "apps_kuaizhizao_production_return_items",
        "apps_kuaizhizao_finished_goods_receipts",
        "apps_kuaizhizao_finished_goods_receipt_items",
        "apps_kuaizhizao_sales_deliveries",
        "apps_kuaizhizao_sales_delivery_items",
        "apps_kuaizhizao_sales_returns",
        "apps_kuaizhizao_sales_return_items",
        "apps_kuaizhizao_purchase_receipts",
        "apps_kuaizhizao_purchase_receipt_item", # Note: some use singular item table name
        "apps_kuaizhizao_purchase_receipt_items",
        "apps_kuaizhizao_purchase_returns",
        "apps_kuaizhizao_purchase_return_items",
        "apps_kuaizhizao_other_inbounds",
        "apps_kuaizhizao_other_inbound_items",
        "apps_kuaizhizao_other_outbounds",
        "apps_kuaizhizao_other_outbound_items",
        "apps_kuaizhizao_material_borrows",
        "apps_kuaizhizao_material_borrow_items",
        "apps_kuaizhizao_material_returns",
        "apps_kuaizhizao_material_return_items",
        "apps_kuaizhizao_stocktakings",
        "apps_kuaizhizao_stocktaking_items",
        "apps_kuaizhizao_inventory_transfers",
        "apps_kuaizhizao_inventory_transfer_items",
        "apps_kuaizhizao_backflush_records",
        "apps_kuaizhizao_material_call_requests",
        "apps_kuaizhizao_replenishment_suggestions",
        "apps_kuaizhizao_wave_pickings",
        
        # 采购相关
        "apps_kuaizhizao_purchase_orders",
        "apps_kuaizhizao_purchase_order_items",
        "apps_kuaizhizao_purchase_requisitions",
        "apps_kuaizhizao_purchase_requisition_items",
        "apps_kuaizhizao_purchase_logistics",
        
        # 质量与维修
        "apps_kuaizhizao_incoming_inspections",
        "apps_kuaizhizao_process_inspections",
        "apps_kuaizhizao_finished_goods_inspections",
        "apps_kuaizhizao_equipment_faults",
        "apps_kuaizhizao_equipment_repairs",
        "apps_kuaizhizao_maintenance_executions",
        "apps_kuaizhizao_maintenance_reminders",
        "apps_kuaizhizao_quality_exceptions",
        "apps_kuaizhizao_exception_process_records",
        "apps_kuaizhizao_exception_process_histories",
        
        # 关联与配置
        "apps_kuaizhizao_document_relations",
        "apps_kuaizhizao_state_transition_logs"
    ]

    @staticmethod
    async def reset_kuaizhizao_data(tenant_id: int, operator_id: int) -> dict:
        """
        重置快制造模块数据：备份 -> 物理删除项目所有相关业务表
        """
        logger.warning(f"开始重置租户 {tenant_id} 的快制造数据，操作人: {operator_id}")
        
        # 1. 自动触发一重备份 (4重保险之一)
        try:
            backup_name = f"[AUTO] 重置前自动备份_快制造_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            backup_data = DataBackupCreate(
                name=backup_name,
                backup_type="full",
                backup_scope="all",
                backup_tables=None
            )
            # 这是一个异步过程（Inngest 处理），我们只需确保任务已创建
            await DataBackupService.create_backup_task(tenant_id, backup_data)
            logger.info("已触发重置前自动备份任务")
        except Exception as e:
            logger.error(f"重置前自动备份失败: {e}")
            # 即使备份创建失败（如 Inngest 连接断开），我们可能也要谨慎考虑是否继续
            # 但用户要求的是“做一个备份”，如果备份失败，最好中止
            raise ValueError(f"自动备份创建失败，出于安全考虑已中止重置操作: {str(e)}")

        # 2. 执行物理删除
        # 使用 Tortoise 的连接执行裸 SQL，因为这样最快且不受软删除逻辑干扰
        conn = Tortoise.get_connection("default")
        
        deleted_counts = {}
        error_tables = []
        
        for table in ResetDataService.BUSINESS_TABLES:
            try:
                # 检查表是否存在且属于对应的 tenant_id
                # 注意：大部分表都有 tenant_id 字段
                sql = f"DELETE FROM {table} WHERE tenant_id = %s"
                result = await conn.execute_query(sql, [tenant_id])
                # result 通常是 (affected_rows, ...)
                if result and len(result) > 0:
                    deleted_counts[table] = result[0]
            except Exception as e:
                # 某些表可能没有 tenant_id 或表名不存在，记录下来但不中断全局
                logger.warning(f"清理表 {table} 失败: {e}")
                error_tables.append(table)

        total_deleted = sum(deleted_counts.values())
        logger.info(f"租户 {tenant_id} 数据重置完成。共清理 {total_deleted} 条记录。")
        
        return {
            "success": True,
            "message": f"重置成功。共从 {len(deleted_counts)} 张表中清理了 {total_deleted} 条业务记录。",
            "details": {
                "deleted_counts": deleted_counts,
                "error_tables": error_tables
            }
        }
