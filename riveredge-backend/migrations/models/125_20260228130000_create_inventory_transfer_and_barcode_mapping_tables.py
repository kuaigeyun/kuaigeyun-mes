"""
数据库迁移：创建库存调拨表和条码映射规则表

创建 apps_kuaizhizao_inventory_transfers、apps_kuaizhizao_inventory_transfer_items、
apps_kuaizhizao_barcode_mapping_rules 表，补全缺失的建表迁移。

Author: Migration Plan
Date: 2026-02-28
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建库存调拨单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_transfers" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "from_warehouse_id" INT NOT NULL,
            "from_warehouse_name" VARCHAR(200) NOT NULL,
            "to_warehouse_id" INT NOT NULL,
            "to_warehouse_name" VARCHAR(200) NOT NULL,
            "transfer_date" TIMESTAMPTZ NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "total_items" INT NOT NULL DEFAULT 0,
            "total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "transfer_reason" TEXT,
            "remarks" TEXT,
            "executed_by" INT,
            "executed_by_name" VARCHAR(100),
            "executed_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfers_tenant_id" ON "apps_kuaizhizao_inventory_transfers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfers_from_warehouse" ON "apps_kuaizhizao_inventory_transfers" ("from_warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfers_to_warehouse" ON "apps_kuaizhizao_inventory_transfers" ("to_warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfers_transfer_date" ON "apps_kuaizhizao_inventory_transfers" ("transfer_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfers_status" ON "apps_kuaizhizao_inventory_transfers" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfers_created_at" ON "apps_kuaizhizao_inventory_transfers" ("created_at");

        COMMENT ON TABLE "apps_kuaizhizao_inventory_transfers" IS '快格轻制造 - 库存调拨单';

        -- ============================================
        -- 2. 创建库存调拨单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_transfer_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "transfer_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "from_warehouse_id" INT NOT NULL,
            "from_location_id" INT,
            "from_location_code" VARCHAR(50),
            "to_warehouse_id" INT NOT NULL,
            "to_location_id" INT,
            "to_location_code" VARCHAR(50),
            "batch_no" VARCHAR(100),
            "quantity" DECIMAL(12,2) NOT NULL,
            "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfer_items_tenant_id" ON "apps_kuaizhizao_inventory_transfer_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfer_items_transfer_id" ON "apps_kuaizhizao_inventory_transfer_items" ("transfer_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfer_items_material_id" ON "apps_kuaizhizao_inventory_transfer_items" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfer_items_from_warehouse" ON "apps_kuaizhizao_inventory_transfer_items" ("from_warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfer_items_to_warehouse" ON "apps_kuaizhizao_inventory_transfer_items" ("to_warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_inv_transfer_items_status" ON "apps_kuaizhizao_inventory_transfer_items" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_inventory_transfer_items" IS '快格轻制造 - 库存调拨单明细';

        -- ============================================
        -- 3. 创建条码映射规则表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_barcode_mapping_rules" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "customer_id" INT,
            "customer_name" VARCHAR(200),
            "barcode_pattern" VARCHAR(500) NOT NULL,
            "barcode_type" VARCHAR(10) NOT NULL DEFAULT '1d',
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "parsing_rule" JSONB,
            "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
            "priority" INT NOT NULL DEFAULT 0,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_tenant_id" ON "apps_kuaizhizao_barcode_mapping_rules" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_customer_id" ON "apps_kuaizhizao_barcode_mapping_rules" ("customer_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_material_id" ON "apps_kuaizhizao_barcode_mapping_rules" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_is_enabled" ON "apps_kuaizhizao_barcode_mapping_rules" ("is_enabled");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_priority" ON "apps_kuaizhizao_barcode_mapping_rules" ("priority");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_barcode_mapping_created_at" ON "apps_kuaizhizao_barcode_mapping_rules" ("created_at");

        COMMENT ON TABLE "apps_kuaizhizao_barcode_mapping_rules" IS '快格轻制造 - 条码映射规则';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_barcode_mapping_rules" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_transfer_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_transfers" CASCADE;"""
