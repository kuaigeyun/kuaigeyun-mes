from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ============================================
        -- 1. 创建报价单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quotations" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "quotation_code" VARCHAR(50) NOT NULL UNIQUE,
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "customer_contact" VARCHAR(100),
            "customer_phone" VARCHAR(20),
            "quotation_date" DATE NOT NULL,
            "valid_until" DATE,
            "delivery_date" DATE,
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "salesman_id" INT,
            "salesman_name" VARCHAR(100),
            "shipping_address" TEXT,
            "shipping_method" VARCHAR(50),
            "payment_terms" VARCHAR(100),
            "sales_order_id" INT,
            "sales_order_code" VARCHAR(50),
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotations_tenant_id" ON "apps_kuaizhizao_quotations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotations_quotation_code" ON "apps_kuaizhizao_quotations" ("quotation_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotations_customer_id" ON "apps_kuaizhizao_quotations" ("customer_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotations_status" ON "apps_kuaizhizao_quotations" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotations_quotation_date" ON "apps_kuaizhizao_quotations" ("quotation_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotations_sales_order_id" ON "apps_kuaizhizao_quotations" ("sales_order_id");

        COMMENT ON TABLE "apps_kuaizhizao_quotations" IS '快格轻制造 - 报价单';

        -- ============================================
        -- 2. 创建报价单明细表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quotation_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "quotation_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "quote_quantity" DECIMAL(10,2) NOT NULL,
            "unit_price" DECIMAL(10,2) NOT NULL,
            "total_amount" DECIMAL(12,2) NOT NULL,
            "delivery_date" DATE,
            "notes" TEXT
        );

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotation_items_tenant_id" ON "apps_kuaizhizao_quotation_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotation_items_quotation_id" ON "apps_kuaizhizao_quotation_items" ("quotation_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quotation_items_material_id" ON "apps_kuaizhizao_quotation_items" ("material_id");

        COMMENT ON TABLE "apps_kuaizhizao_quotation_items" IS '快格轻制造 - 报价单明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_quotation_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_quotations" CASCADE;
    """
