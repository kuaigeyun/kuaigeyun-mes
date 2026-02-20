from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建借料单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_borrows" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "borrow_code" VARCHAR(50) NOT NULL UNIQUE,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(100) NOT NULL,
            "borrower_id" INT,
            "borrower_name" VARCHAR(100),
            "department" VARCHAR(100),
            "expected_return_date" DATE,
            "borrow_time" TIMESTAMPTZ,
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT '待借出',
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_borrows_tenant_id" ON "apps_kuaizhizao_material_borrows" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_borrows_borrow_code" ON "apps_kuaizhizao_material_borrows" ("borrow_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_borrows_warehouse_id" ON "apps_kuaizhizao_material_borrows" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_borrows_status" ON "apps_kuaizhizao_material_borrows" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_material_borrows" IS '快格轻制造 - 借料单';

        -- ============================================
        -- 2. 创建借料单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_borrow_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "borrow_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "borrow_quantity" DECIMAL(10,2) NOT NULL,
            "returned_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(100) NOT NULL,
            "location_id" INT,
            "location_code" VARCHAR(50),
            "status" VARCHAR(20) NOT NULL DEFAULT '待借出',
            "borrow_time" TIMESTAMPTZ,
            "batch_number" VARCHAR(50),
            "expiry_date" DATE,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_borrow_items_tenant_id" ON "apps_kuaizhizao_material_borrow_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_borrow_items_borrow_id" ON "apps_kuaizhizao_material_borrow_items" ("borrow_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_borrow_items_material_id" ON "apps_kuaizhizao_material_borrow_items" ("material_id");

        COMMENT ON TABLE "apps_kuaizhizao_material_borrow_items" IS '快格轻制造 - 借料单明细';

        -- ============================================
        -- 3. 创建还料单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_returns" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "return_code" VARCHAR(50) NOT NULL UNIQUE,
            "borrow_id" INT NOT NULL,
            "borrow_code" VARCHAR(50) NOT NULL,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(100) NOT NULL,
            "returner_id" INT,
            "returner_name" VARCHAR(100),
            "return_time" TIMESTAMPTZ,
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT '待归还',
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_returns_tenant_id" ON "apps_kuaizhizao_material_returns" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_returns_return_code" ON "apps_kuaizhizao_material_returns" ("return_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_returns_borrow_id" ON "apps_kuaizhizao_material_returns" ("borrow_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_returns_status" ON "apps_kuaizhizao_material_returns" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_material_returns" IS '快格轻制造 - 还料单';

        -- ============================================
        -- 4. 创建还料单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_return_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "return_id" INT NOT NULL,
            "borrow_item_id" INT,
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
            "status" VARCHAR(20) NOT NULL DEFAULT '待归还',
            "return_time" TIMESTAMPTZ,
            "batch_number" VARCHAR(50),
            "expiry_date" DATE,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_return_items_tenant_id" ON "apps_kuaizhizao_material_return_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_return_items_return_id" ON "apps_kuaizhizao_material_return_items" ("return_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_return_items_material_id" ON "apps_kuaizhizao_material_return_items" ("material_id");

        COMMENT ON TABLE "apps_kuaizhizao_material_return_items" IS '快格轻制造 - 还料单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_return_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_returns" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_borrow_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_borrows" CASCADE;
    """
