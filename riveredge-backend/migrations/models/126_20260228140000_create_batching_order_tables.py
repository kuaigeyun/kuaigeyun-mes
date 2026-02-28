from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建配料单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_batching_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(200) NOT NULL,
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "production_plan_id" INT,
            "batching_date" TIMESTAMPTZ NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "total_items" INT NOT NULL DEFAULT 0,
            "target_warehouse_id" INT,
            "target_warehouse_name" VARCHAR(200),
            "remarks" TEXT,
            "executed_by" INT,
            "executed_by_name" VARCHAR(100),
            "executed_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_orders_tenant_id" ON "apps_kuaizhizao_batching_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_orders_warehouse_id" ON "apps_kuaizhizao_batching_orders" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_orders_work_order_id" ON "apps_kuaizhizao_batching_orders" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_orders_batching_date" ON "apps_kuaizhizao_batching_orders" ("batching_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_orders_status" ON "apps_kuaizhizao_batching_orders" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_orders_created_at" ON "apps_kuaizhizao_batching_orders" ("created_at");

        COMMENT ON TABLE "apps_kuaizhizao_batching_orders" IS '快格轻制造 - 配料单';

        -- ============================================
        -- 2. 创建配料单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_batching_order_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "batching_order_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "unit" VARCHAR(20) NOT NULL DEFAULT '',
            "required_quantity" DECIMAL(12,2) NOT NULL,
            "picked_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(200) NOT NULL,
            "location_id" INT,
            "location_code" VARCHAR(50),
            "batch_no" VARCHAR(50),
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_order_items_tenant_id" ON "apps_kuaizhizao_batching_order_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_order_items_batching_order_id" ON "apps_kuaizhizao_batching_order_items" ("batching_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_order_items_material_id" ON "apps_kuaizhizao_batching_order_items" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batching_order_items_status" ON "apps_kuaizhizao_batching_order_items" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_batching_order_items" IS '快格轻制造 - 配料单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_batching_order_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_batching_orders" CASCADE;
    """
