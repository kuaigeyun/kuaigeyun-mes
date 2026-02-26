from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建组装单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_assembly_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(200) NOT NULL,
            "assembly_date" TIMESTAMPTZ NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "product_material_id" INT NOT NULL,
            "product_material_code" VARCHAR(50) NOT NULL,
            "product_material_name" VARCHAR(200) NOT NULL,
            "total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "total_items" INT NOT NULL DEFAULT 0,
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

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_orders_tenant_id" ON "apps_kuaizhizao_assembly_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_orders_warehouse_id" ON "apps_kuaizhizao_assembly_orders" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_orders_assembly_date" ON "apps_kuaizhizao_assembly_orders" ("assembly_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_orders_status" ON "apps_kuaizhizao_assembly_orders" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_orders_created_at" ON "apps_kuaizhizao_assembly_orders" ("created_at");

        COMMENT ON TABLE "apps_kuaizhizao_assembly_orders" IS '快格轻制造 - 组装单';

        -- ============================================
        -- 2. 创建组装单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_assembly_order_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "assembly_order_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "quantity" DECIMAL(12,2) NOT NULL,
            "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_order_items_tenant_id" ON "apps_kuaizhizao_assembly_order_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_order_items_assembly_order_id" ON "apps_kuaizhizao_assembly_order_items" ("assembly_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_order_items_material_id" ON "apps_kuaizhizao_assembly_order_items" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_assembly_order_items_status" ON "apps_kuaizhizao_assembly_order_items" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_assembly_order_items" IS '快格轻制造 - 组装单明细';

        -- ============================================
        -- 3. 创建拆卸单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_disassembly_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "warehouse_id" INT NOT NULL,
            "warehouse_name" VARCHAR(200) NOT NULL,
            "disassembly_date" TIMESTAMPTZ NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "product_material_id" INT NOT NULL,
            "product_material_code" VARCHAR(50) NOT NULL,
            "product_material_name" VARCHAR(200) NOT NULL,
            "total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "total_items" INT NOT NULL DEFAULT 0,
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

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_orders_tenant_id" ON "apps_kuaizhizao_disassembly_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_orders_warehouse_id" ON "apps_kuaizhizao_disassembly_orders" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_orders_disassembly_date" ON "apps_kuaizhizao_disassembly_orders" ("disassembly_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_orders_status" ON "apps_kuaizhizao_disassembly_orders" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_orders_created_at" ON "apps_kuaizhizao_disassembly_orders" ("created_at");

        COMMENT ON TABLE "apps_kuaizhizao_disassembly_orders" IS '快格轻制造 - 拆卸单';

        -- ============================================
        -- 4. 创建拆卸单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_disassembly_order_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "disassembly_order_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "quantity" DECIMAL(12,2) NOT NULL,
            "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_order_items_tenant_id" ON "apps_kuaizhizao_disassembly_order_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_order_items_disassembly_order_id" ON "apps_kuaizhizao_disassembly_order_items" ("disassembly_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_order_items_material_id" ON "apps_kuaizhizao_disassembly_order_items" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_disassembly_order_items_status" ON "apps_kuaizhizao_disassembly_order_items" ("status");

        COMMENT ON TABLE "apps_kuaizhizao_disassembly_order_items" IS '快格轻制造 - 拆卸单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_assembly_order_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_assembly_orders" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_disassembly_order_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_disassembly_orders" CASCADE;
    """
