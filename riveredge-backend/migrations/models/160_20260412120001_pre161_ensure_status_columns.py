"""
在 161 之前执行（文件名排序紧接 160_20260412120000 之后）：161 内对 status 建索引、
COMMENT、以及 material_call_requests 上 (tenant_id, status) 联合索引；
若旧表已存在但缺 status 列，会报 column "status" does not exist。

独立成新迁移文件，使「已执行过仅含 warehouse 的 160_20260412120000」的环境仍能应用本步。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
DO $pre161_st$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'apps_master_data_bom_changes',
    'apps_master_data_process_route_changes',
    'apps_kuaizhizao_assembly_orders',
    'apps_kuaizhizao_assembly_order_items',
    'apps_kuaizhizao_backflush_records',
    'apps_kuaizhizao_batching_orders',
    'apps_kuaizhizao_batching_order_items',
    'apps_kuaizhizao_customer_material_registrations',
    'apps_kuaizhizao_delivery_delay_exceptions',
    'apps_kuaizhizao_delivery_notices',
    'apps_kuaizhizao_disassembly_orders',
    'apps_kuaizhizao_disassembly_order_items',
    'apps_kuaizhizao_equipment',
    'apps_kuaizhizao_equipment_faults',
    'apps_kuaizhizao_equipment_repairs',
    'apps_kuaizhizao_equipment_point_inspection_plans',
    'apps_kuaizhizao_equipment_point_inspection_records',
    'apps_kuaizhizao_equipment_status_monitors',
    'apps_kuaizhizao_inventory_transfers',
    'apps_kuaizhizao_inventory_transfer_items',
    'apps_kuaizhizao_launch_countdowns',
    'apps_kuaizhizao_line_side_inventory',
    'apps_kuaizhizao_maintenance_executions',
    'apps_kuaizhizao_maintenance_plans',
    'apps_kuaizhizao_material_borrows',
    'apps_kuaizhizao_material_call_requests',
    'apps_kuaizhizao_material_returns',
    'apps_kuaizhizao_material_shortage_exceptions',
    'apps_kuaizhizao_molds',
    'apps_kuaizhizao_mold_usages',
    'apps_kuaizhizao_other_inbounds',
    'apps_kuaizhizao_other_outbounds',
    'apps_kuaizhizao_quality_exceptions',
    'apps_kuaizhizao_quotations',
    'apps_kuaizhizao_receipt_notices',
    'apps_kuaizhizao_replenishment_suggestions',
    'apps_kuaizhizao_sample_trials',
    'apps_kuaizhizao_shipment_notices',
    'apps_kuaizhizao_stocktakings',
    'apps_kuaizhizao_stocktaking_items',
    'apps_kuaizhizao_tools',
    'apps_kuaizhizao_tool_usages'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS status VARCHAR(50)', t);
    END IF;
  END LOOP;
END
$pre161_st$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
