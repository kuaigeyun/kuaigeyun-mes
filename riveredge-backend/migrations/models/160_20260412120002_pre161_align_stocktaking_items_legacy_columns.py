"""
161 中 apps_kuaizhizao_stocktaking_items 与迁移 14 旧表结构不一致：
旧表使用 storage_location_id / storage_location_code、counted_quantity；
161 使用 location_id / location_code、actual_quantity。

CREATE TABLE IF NOT EXISTS 会保留旧表，后续 COMMENT/索引会引用不存在的列。

本迁移在 161 之前幂等补列，并从旧列名回填（若存在）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
DO $pre161_sti$
BEGIN
  IF to_regclass('public.apps_kuaizhizao_stocktaking_items') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE "apps_kuaizhizao_stocktaking_items" ADD COLUMN IF NOT EXISTS "location_id" INT;
  ALTER TABLE "apps_kuaizhizao_stocktaking_items" ADD COLUMN IF NOT EXISTS "location_code" VARCHAR(50);
  ALTER TABLE "apps_kuaizhizao_stocktaking_items" ADD COLUMN IF NOT EXISTS "actual_quantity" DECIMAL(12,2);

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'apps_kuaizhizao_stocktaking_items'
      AND column_name = 'storage_location_id'
  ) THEN
    UPDATE "apps_kuaizhizao_stocktaking_items"
    SET "location_id" = "storage_location_id"
    WHERE "location_id" IS NULL AND "storage_location_id" IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'apps_kuaizhizao_stocktaking_items'
      AND column_name = 'storage_location_code'
  ) THEN
    UPDATE "apps_kuaizhizao_stocktaking_items"
    SET "location_code" = "storage_location_code"
    WHERE ("location_code" IS NULL OR "location_code" = '')
      AND "storage_location_code" IS NOT NULL
      AND "storage_location_code" <> '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'apps_kuaizhizao_stocktaking_items'
      AND column_name = 'counted_quantity'
  ) THEN
    UPDATE "apps_kuaizhizao_stocktaking_items"
    SET "actual_quantity" = "counted_quantity"
    WHERE "actual_quantity" IS NULL AND "counted_quantity" IS NOT NULL;
  END IF;
END
$pre161_sti$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
