from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建生产退料单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_production_returns" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "return_code" VARCHAR(50) NOT NULL UNIQUE,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "picking_id" INT,
            "picking_code" VARCHAR(50),
            "workshop_id" INT,
            "workshop_name" VARCHAR(100),
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(100) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT '待退料',
            "returner_id" INT,
            "returner_name" VARCHAR(100),
            "return_time" TIMESTAMPTZ,
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_production_returns_tenant_id" ON "apps_kuaizhizao_production_returns" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_production_returns_work_order_id" ON "apps_kuaizhizao_production_returns" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_production_returns_picking_id" ON "apps_kuaizhizao_production_returns" ("picking_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_production_returns_status" ON "apps_kuaizhizao_production_returns" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_production_returns" IS '快格轻制造 - 生产退料单';

        -- ============================================
        -- 2. 创建生产退料单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_production_return_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "return_id" INT NOT NULL,
            "picking_item_id" INT,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "return_quantity" DECIMAL(10,2) NOT NULL,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(100) NOT NULL,
            "location_id" INT,
            "location_code" VARCHAR(50),
            "status" VARCHAR(20) NOT NULL DEFAULT '待退料',
            "return_time" TIMESTAMPTZ,
            "batch_number" VARCHAR(50),
            "expiry_date" DATE,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_production_return_items_tenant_id" ON "apps_kuaizhizao_production_return_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_production_return_items_return_id" ON "apps_kuaizhizao_production_return_items" ("return_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_production_return_items_material_id" ON "apps_kuaizhizao_production_return_items" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_production_return_items_warehouse_id" ON "apps_kuaizhizao_production_return_items" ("warehouse_id");

        COMMENT ON TABLE "apps_kuaizhizao_production_return_items" IS '快格轻制造 - 生产退料单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_production_return_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_production_returns" CASCADE;
    """
