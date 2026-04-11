"""
在 161 之前执行：161 内多处 CREATE INDEX / COMMENT 依赖 warehouse_id 与 status，
若旧表由更早迁移创建且缺列（或库被手工改过），会在 161 前半段就失败
（典型：CREATE INDEX ... ("status")、("tenant_id","status")、COMMENT ON COLUMN ..."status"）。

对可能涉及的表统一 ADD COLUMN IF NOT EXISTS（幂等）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
DO $pre161_wh$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'apps_kuaizhizao_assembly_orders',
    'apps_kuaizhizao_backflush_records',
    'apps_kuaizhizao_batching_orders',
    'apps_kuaizhizao_batching_order_items',
    'apps_kuaizhizao_computation_configs',
    'apps_kuaizhizao_customer_material_registrations',
    'apps_kuaizhizao_disassembly_orders',
    'apps_kuaizhizao_inventory_alert_rules',
    'apps_kuaizhizao_inventory_alerts',
    'apps_kuaizhizao_line_side_inventory',
    'apps_kuaizhizao_material_borrows',
    'apps_kuaizhizao_material_returns',
    'apps_kuaizhizao_other_inbounds',
    'apps_kuaizhizao_other_outbounds',
    'apps_kuaizhizao_receipt_notices',
    'apps_kuaizhizao_replenishment_suggestions',
    'apps_kuaizhizao_shipment_notices',
    'apps_kuaizhizao_stocktakings',
    'apps_kuaizhizao_stocktaking_items'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS warehouse_id INT', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS warehouse_name VARCHAR(200)', t);
    END IF;
  END LOOP;
END
$pre161_wh$;

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
