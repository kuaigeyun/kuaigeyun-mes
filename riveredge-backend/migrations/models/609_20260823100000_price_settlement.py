from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_items"
            ADD COLUMN IF NOT EXISTS "price_settlement_status" VARCHAR(20) NOT NULL DEFAULT 'SETTLED';
        ALTER TABLE "apps_kuaizhizao_sales_order_items"
            ADD COLUMN IF NOT EXISTS "provisional_unit_price" DECIMAL(10,2);
        ALTER TABLE "apps_kuaizhizao_sales_order_items"
            ADD COLUMN IF NOT EXISTS "price_settled_at" TIMESTAMPTZ;
        ALTER TABLE "apps_kuaizhizao_sales_order_items"
            ADD COLUMN IF NOT EXISTS "price_settled_by" INT;

        ALTER TABLE "apps_kuaizhizao_purchase_order_items"
            ADD COLUMN IF NOT EXISTS "price_settlement_status" VARCHAR(20) NOT NULL DEFAULT 'SETTLED';
        ALTER TABLE "apps_kuaizhizao_purchase_order_items"
            ADD COLUMN IF NOT EXISTS "provisional_unit_price" DECIMAL(10,4);
        ALTER TABLE "apps_kuaizhizao_purchase_order_items"
            ADD COLUMN IF NOT EXISTS "price_settled_at" TIMESTAMPTZ;
        ALTER TABLE "apps_kuaizhizao_purchase_order_items"
            ADD COLUMN IF NOT EXISTS "price_settled_by" INT;

        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_price_settlement_batches" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            "tenant_id" INT NOT NULL,
            "batch_code" VARCHAR(50) NOT NULL,
            "period" VARCHAR(7) NOT NULL,
            "side" VARCHAR(20) NOT NULL,
            "partner_id" INT NOT NULL,
            "partner_name" VARCHAR(200) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "price_source" VARCHAR(30) NOT NULL DEFAULT 'manual',
            "total_delta_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "applied_at" TIMESTAMPTZ,
            "applied_by" INT,
            "applied_by_name" VARCHAR(100),
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_psb_tenant_period"
            ON "apps_kuaicaiwu_price_settlement_batches" ("tenant_id", "period", "side");
        CREATE INDEX IF NOT EXISTS "idx_psb_tenant_partner"
            ON "apps_kuaicaiwu_price_settlement_batches" ("tenant_id", "partner_id", "side");

        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_price_settlement_lines" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            "tenant_id" INT NOT NULL,
            "batch_id" INT NOT NULL REFERENCES "apps_kuaicaiwu_price_settlement_batches" ("id") ON DELETE CASCADE,
            "source_order_id" INT NOT NULL,
            "source_order_code" VARCHAR(50) NOT NULL,
            "source_line_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "settled_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "before_unit_price" DECIMAL(12,4) NOT NULL DEFAULT 0,
            "after_unit_price" DECIMAL(12,4) NOT NULL DEFAULT 0,
            "delta_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "finance_adjustment_id" INT,
            "finance_adjustment_type" VARCHAR(20),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_psl_batch_source_line"
            ON "apps_kuaicaiwu_price_settlement_lines" ("batch_id", "source_line_id");
        CREATE INDEX IF NOT EXISTS "idx_psl_tenant_source_line"
            ON "apps_kuaicaiwu_price_settlement_lines" ("tenant_id", "source_line_id");
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaicaiwu_price_settlement_lines";
        DROP TABLE IF EXISTS "apps_kuaicaiwu_price_settlement_batches";
        ALTER TABLE "apps_kuaizhizao_sales_order_items" DROP COLUMN IF EXISTS "price_settlement_status";
        ALTER TABLE "apps_kuaizhizao_sales_order_items" DROP COLUMN IF EXISTS "provisional_unit_price";
        ALTER TABLE "apps_kuaizhizao_sales_order_items" DROP COLUMN IF EXISTS "price_settled_at";
        ALTER TABLE "apps_kuaizhizao_sales_order_items" DROP COLUMN IF EXISTS "price_settled_by";
        ALTER TABLE "apps_kuaizhizao_purchase_order_items" DROP COLUMN IF EXISTS "price_settlement_status";
        ALTER TABLE "apps_kuaizhizao_purchase_order_items" DROP COLUMN IF EXISTS "provisional_unit_price";
        ALTER TABLE "apps_kuaizhizao_purchase_order_items" DROP COLUMN IF EXISTS "price_settled_at";
        ALTER TABLE "apps_kuaizhizao_purchase_order_items" DROP COLUMN IF EXISTS "price_settled_by";
        """
