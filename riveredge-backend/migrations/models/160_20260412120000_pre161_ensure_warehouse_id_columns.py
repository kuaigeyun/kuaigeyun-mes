"""
在 161 之前执行：161 内多处 CREATE INDEX / COMMENT 依赖 warehouse_id，
若旧表由更早迁移创建且缺列（或库被手工改过），会在 161 前半段就失败。

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
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
