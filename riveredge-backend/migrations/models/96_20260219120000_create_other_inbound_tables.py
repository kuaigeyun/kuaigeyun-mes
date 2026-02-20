from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建其他入库单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_other_inbounds" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "inbound_code" VARCHAR(50) NOT NULL UNIQUE,
            "reason_type" VARCHAR(20) NOT NULL,
            "reason_desc" TEXT,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(100) NOT NULL,
            "receipt_time" TIMESTAMPTZ,
            "receiver_id" INT,
            "receiver_name" VARCHAR(100),
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT '待入库',
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_inbounds_tenant_id" ON "apps_kuaizhizao_other_inbounds" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_inbounds_warehouse_id" ON "apps_kuaizhizao_other_inbounds" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_inbounds_reason_type" ON "apps_kuaizhizao_other_inbounds" ("reason_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_inbounds_status" ON "apps_kuaizhizao_other_inbounds" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_other_inbounds" IS '快格轻制造 - 其他入库单';

        -- ============================================
        -- 2. 创建其他入库单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_other_inbound_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "inbound_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "inbound_quantity" DECIMAL(10,2) NOT NULL,
            "unit_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "location_id" INT,
            "location_code" VARCHAR(50),
            "batch_number" VARCHAR(50),
            "expiry_date" DATE,
            "status" VARCHAR(20) NOT NULL DEFAULT '待入库',
            "receipt_time" TIMESTAMPTZ,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_inbound_items_tenant_id" ON "apps_kuaizhizao_other_inbound_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_inbound_items_inbound_id" ON "apps_kuaizhizao_other_inbound_items" ("inbound_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_inbound_items_material_id" ON "apps_kuaizhizao_other_inbound_items" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_inbound_items_location_id" ON "apps_kuaizhizao_other_inbound_items" ("location_id");

        COMMENT ON TABLE "apps_kuaizhizao_other_inbound_items" IS '快格轻制造 - 其他入库单明细';

        -- ============================================
        -- 3. 创建其他出库单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_other_outbounds" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "outbound_code" VARCHAR(50) NOT NULL UNIQUE,
            "reason_type" VARCHAR(20) NOT NULL,
            "reason_desc" TEXT,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(100) NOT NULL,
            "delivery_time" TIMESTAMPTZ,
            "deliverer_id" INT,
            "deliverer_name" VARCHAR(100),
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT '待出库',
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_outbounds_tenant_id" ON "apps_kuaizhizao_other_outbounds" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_outbounds_warehouse_id" ON "apps_kuaizhizao_other_outbounds" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_outbounds_reason_type" ON "apps_kuaizhizao_other_outbounds" ("reason_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_outbounds_status" ON "apps_kuaizhizao_other_outbounds" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_other_outbounds" IS '快格轻制造 - 其他出库单';

        -- ============================================
        -- 4. 创建其他出库单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_other_outbound_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "outbound_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "outbound_quantity" DECIMAL(10,2) NOT NULL,
            "unit_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "location_id" INT,
            "location_code" VARCHAR(50),
            "batch_number" VARCHAR(50),
            "expiry_date" DATE,
            "status" VARCHAR(20) NOT NULL DEFAULT '待出库',
            "delivery_time" TIMESTAMPTZ,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_outbound_items_tenant_id" ON "apps_kuaizhizao_other_outbound_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_outbound_items_outbound_id" ON "apps_kuaizhizao_other_outbound_items" ("outbound_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_outbound_items_material_id" ON "apps_kuaizhizao_other_outbound_items" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_other_outbound_items_location_id" ON "apps_kuaizhizao_other_outbound_items" ("location_id");

        COMMENT ON TABLE "apps_kuaizhizao_other_outbound_items" IS '快格轻制造 - 其他出库单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_other_outbound_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_other_outbounds" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_other_inbound_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_other_inbounds" CASCADE;
    """
