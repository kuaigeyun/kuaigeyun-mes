"""
迁移 14 创建的 apps_kuaizhizao_inventory_alerts 与当前模型不一致（无 alert_message、triggered_at、handled_* 等）。

161 中 CREATE TABLE IF NOT EXISTS 会跳过，但 CREATE INDEX(triggered_at) 会在列不存在时报错。
本迁移：补列、回填、收紧 NOT NULL、补索引与注释（与 161 中移除段一致）。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ADD COLUMN IF NOT EXISTS "alert_message" TEXT;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ADD COLUMN IF NOT EXISTS "handled_by" INT;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ADD COLUMN IF NOT EXISTS "handled_by_name" VARCHAR(100);
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ADD COLUMN IF NOT EXISTS "handled_at" TIMESTAMPTZ;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ADD COLUMN IF NOT EXISTS "handling_notes" TEXT;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ADD COLUMN IF NOT EXISTS "triggered_at" TIMESTAMPTZ;
UPDATE "apps_kuaizhizao_inventory_alerts" SET "alert_message" = '' WHERE "alert_message" IS NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    INNER JOIN pg_catalog.pg_class c ON a.attrelid = c.oid AND c.relkind = 'r'
    INNER JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'apps_kuaizhizao_inventory_alerts'
      AND a.attname = 'remarks'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    EXECUTE $inv_alert_remarks$
      UPDATE "apps_kuaizhizao_inventory_alerts"
      SET "alert_message" = COALESCE("remarks", '')
      WHERE "alert_message" IS NULL OR TRIM(COALESCE("alert_message", '')) = ''
    $inv_alert_remarks$;
  END IF;
END $$;
UPDATE "apps_kuaizhizao_inventory_alerts" SET "triggered_at" = "created_at" WHERE "triggered_at" IS NULL;
UPDATE "apps_kuaizhizao_inventory_alerts" SET "warehouse_id" = COALESCE("warehouse_id", 0) WHERE "warehouse_id" IS NULL;
UPDATE "apps_kuaizhizao_inventory_alerts" SET "warehouse_name" = COALESCE("warehouse_name", '') WHERE "warehouse_name" IS NULL;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ALTER COLUMN "alert_message" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ALTER COLUMN "triggered_at" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ALTER COLUMN "warehouse_id" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ALTER COLUMN "warehouse_name" SET NOT NULL;
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ALTER COLUMN "current_quantity" TYPE DECIMAL(12,2);
ALTER TABLE "apps_kuaizhizao_inventory_alerts" ALTER COLUMN "threshold_value" TYPE DECIMAL(12,2);
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__5cdd03" ON "apps_kuaizhizao_inventory_alerts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_r_cf8ee8" ON "apps_kuaizhizao_inventory_alerts" ("alert_rule_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_t_cbb81a" ON "apps_kuaizhizao_inventory_alerts" ("alert_type");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_materia_a7ad3e" ON "apps_kuaizhizao_inventory_alerts" ("material_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_warehou_f5ef1d" ON "apps_kuaizhizao_inventory_alerts" ("warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_status_0ca133" ON "apps_kuaizhizao_inventory_alerts" ("status");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_alert_l_d362b6" ON "apps_kuaizhizao_inventory_alerts" ("alert_level");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_trigger_855eb5" ON "apps_kuaizhizao_inventory_alerts" ("triggered_at");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_created_fcb2ce" ON "apps_kuaizhizao_inventory_alerts" ("created_at");
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."created_at" IS '创建时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."updated_at" IS '更新时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."id" IS '主键ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."alert_rule_id" IS '预警规则ID（关联InventoryAlertRule）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."alert_type" IS '预警类型（low_stock/high_stock/expired）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."material_id" IS '物料ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."material_code" IS '物料编码';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."material_name" IS '物料名称';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."warehouse_id" IS '仓库ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."warehouse_name" IS '仓库名称';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."current_quantity" IS '当前库存数量';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."threshold_value" IS '阈值数值';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."alert_level" IS '预警级别（info/warning/critical）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."alert_message" IS '预警消息';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."status" IS '状态（pending/processing/resolved/ignored）';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."handled_by" IS '处理人ID';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."handled_by_name" IS '处理人姓名';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."handled_at" IS '处理时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."handling_notes" IS '处理备注';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."triggered_at" IS '触发时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."resolved_at" IS '解决时间';
COMMENT ON COLUMN "apps_kuaizhizao_inventory_alerts"."deleted_at" IS '删除时间（软删除）';
COMMENT ON TABLE "apps_kuaizhizao_inventory_alerts" IS '快格轻制造 - 库存预警';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
