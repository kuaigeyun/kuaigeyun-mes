import asyncio
import hashlib
import hmac
import time
from typing import List, Optional
from datetime import datetime
from loguru import logger
from tortoise import Tortoise

from core.services.system.data_backup_service import DataBackupService
from core.schemas.data_backup import DataBackupCreate
from core.utils.timezone_utils import resolve_business_datetime


class ResetDataService:
    """
    快制造应用数据重置服务
    """

    @staticmethod
    def _token_secret() -> str:
        try:
            from infra.config.settings import settings

            return str(
                getattr(settings, "JWT_SECRET_KEY", None)
                or getattr(settings, "SECRET_KEY", None)
                or "kuaizhizao-reset-data"
            )
        except Exception:
            return "kuaizhizao-reset-data"

    @classmethod
    def issue_confirmation_token(
        cls,
        *,
        tenant_id: int,
        operator_id: int,
        ttl_seconds: int = 300,
    ) -> str:
        """签发短时二次确认 token：payload.timestamp.signature。"""
        issued_at = int(time.time())
        payload = f"{tenant_id}:{operator_id}:{issued_at}:{ttl_seconds}"
        sig = hmac.new(
            cls._token_secret().encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return f"{payload}.{sig}"

    @classmethod
    def verify_confirmation_token(
        cls,
        *,
        tenant_id: int,
        operator_id: int,
        token: str,
        ttl_seconds: int = 300,
    ) -> None:
        raw = (token or "").strip()
        if not raw or "." not in raw:
            raise ValueError("二次确认 token 无效")
        payload, sig = raw.rsplit(".", 1)
        parts = payload.split(":")
        if len(parts) != 4:
            raise ValueError("二次确认 token 格式错误")
        try:
            tok_tenant = int(parts[0])
            tok_op = int(parts[1])
            issued_at = int(parts[2])
            tok_ttl = int(parts[3])
        except ValueError as exc:
            raise ValueError("二次确认 token 内容无效") from exc
        if tok_tenant != int(tenant_id) or tok_op != int(operator_id):
            raise ValueError("二次确认 token 与当前操作人不匹配")
        expected = hmac.new(
            cls._token_secret().encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise ValueError("二次确认 token 校验失败")
        effective_ttl = min(int(ttl_seconds), tok_ttl) if tok_ttl > 0 else int(ttl_seconds)
        if int(time.time()) - issued_at > effective_ttl:
            raise ValueError("二次确认 token 已过期，请重新获取")

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
        "apps_kuaizhizao_semi_finished_goods_receipts",
        "apps_kuaizhizao_semi_finished_goods_receipt_items",
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
        "apps_kuaizhizao_material_call_request_items",
        "apps_kuaizhizao_material_call_requests",
        "apps_kuaizhizao_replenishment_suggestions",
        "apps_kuaizhizao_wave_pickings",
        
        # 采购相关（子表在前，避免外键挡住头表删除）
        "apps_kuaizhizao_purchase_supplier_quote_items",
        "apps_kuaizhizao_purchase_supplier_quotes",
        "apps_kuaizhizao_purchase_inquiry_vendors",
        "apps_kuaizhizao_purchase_inquiry_items",
        "apps_kuaizhizao_purchase_inquiries",
        "apps_kuaizhizao_purchase_order_change_items",
        "apps_kuaizhizao_purchase_order_change_orders",
        "apps_kuaizhizao_purchase_order_changes",
        "apps_kuaizhizao_purchase_order_items",
        "apps_kuaizhizao_purchase_orders",
        "apps_kuaizhizao_purchase_requisition_items",
        "apps_kuaizhizao_purchase_requisitions",

        # 销售合同 / 订单变更（业务单据，须随重置一并清）
        "apps_kuaizhizao_sales_contract_items",
        "apps_kuaizhizao_sales_contracts",
        "apps_kuaizhizao_sales_order_change_items",
        "apps_kuaizhizao_sales_order_change_orders",

        # 需求运算与滚动排程等业务单据
        "apps_kuaizhizao_demand_computation_items",
        "apps_kuaizhizao_demand_computations",
        "apps_kuaizhizao_rolling_schedule_plan_lines",
        "apps_kuaizhizao_rolling_schedule_plans",
        "apps_kuaizhizao_demand_replan_tasks",
        "apps_kuaizhizao_demand_impact_records",
        "apps_kuaizhizao_demand_change_events",
        
        # 质量与维修
        "apps_kuaizhizao_incoming_inspections",
        "apps_kuaizhizao_process_inspections",
        "apps_kuaizhizao_finished_goods_inspections",
        "apps_kuaizhizao_oqc_inspections",
        "apps_kuaizhizao_quality_8d_reports",
        "apps_kuaizhizao_equipment_faults",
        "apps_kuaizhizao_equipment_repairs",
        "apps_kuaizhizao_equipment_status_histories",
        "apps_kuaizhizao_equipment_status_monitors",
        "apps_kuaizhizao_equipment_calibrations",
        "apps_kuaizhizao_maintenance_executions",
        "apps_kuaizhizao_maintenance_reminders",
        "apps_kuaizhizao_maintenance_plans",
        "apps_kuaizhizao_quality_exceptions",
        "apps_kuaizhizao_exception_process_records",
        "apps_kuaizhizao_exception_process_histories",
        "apps_kuaizhizao_customer_material_registration_items",
        "apps_kuaizhizao_customer_material_registrations",
        "apps_kuaizhizao_inventory_alerts",
        "apps_kuaizhizao_inventory_alert_rules",
        "apps_kuaizhizao_packing_bindings",
        "apps_kuaizhizao_mold_usages",
        "apps_kuaizhizao_mold_calibrations",
        "apps_kuaizhizao_tool_usages",
        "apps_kuaizhizao_tool_maintenances",
        "apps_kuaizhizao_tool_calibrations",
        
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
            backup_name = f"[AUTO] 重置前自动备份_快制造_{resolve_business_datetime().strftime('%Y%m%d_%H%M%S')}"
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
                sql = f"DELETE FROM {table} WHERE tenant_id = $1"
                result = await conn.execute_query(sql, [tenant_id])
                # asyncpg: (affected_rows, rows) 或仅 affected_rows
                if isinstance(result, int):
                    deleted_counts[table] = result
                elif result and len(result) > 0:
                    deleted_counts[table] = int(result[0]) if result[0] is not None else 0
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
