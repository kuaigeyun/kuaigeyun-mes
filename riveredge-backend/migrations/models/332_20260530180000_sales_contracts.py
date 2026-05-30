from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_contracts" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "contract_code" VARCHAR(50) NOT NULL,
            "contract_type" VARCHAR(20) NOT NULL DEFAULT 'single',
            "party_type" VARCHAR(20) NOT NULL DEFAULT 'customer',
            "customer_id" INT NOT NULL,
            "customer_name" VARCHAR(200) NOT NULL,
            "customer_contact" VARCHAR(100),
            "customer_phone" VARCHAR(20),
            "contract_date" DATE NOT NULL,
            "valid_from" DATE,
            "valid_to" DATE,
            "total_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "released_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "released_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "price_type" VARCHAR(20) NOT NULL DEFAULT 'tax_exclusive',
            "currency_code" VARCHAR(20) DEFAULT 'CNY',
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "salesman_id" INT,
            "salesman_name" VARCHAR(100),
            "shipping_address" TEXT,
            "shipping_method" VARCHAR(50),
            "payment_terms" VARCHAR(100),
            "quotation_id" INT,
            "quotation_code" VARCHAR(120),
            "root_contract_id" INT,
            "version_no" INT NOT NULL DEFAULT 1,
            "previous_contract_id" INT,
            "notes" TEXT,
            "attachments" JSONB,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_sales_contracts_tenant_customer"
            ON "apps_kuaizhizao_sales_contracts" ("tenant_id", "customer_id");
        CREATE INDEX IF NOT EXISTS "idx_sales_contracts_tenant_status"
            ON "apps_kuaizhizao_sales_contracts" ("tenant_id", "status");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_sales_contracts_tenant_code_active"
            ON "apps_kuaizhizao_sales_contracts" ("tenant_id", "contract_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_contract_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "contract_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "contract_quantity" DECIMAL(12,2) NOT NULL,
            "released_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "unit_price" DECIMAL(12,2) NOT NULL,
            "tax_rate" DECIMAL(6,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(14,2) NOT NULL,
            "variant_attributes" JSONB,
            "delivery_date" DATE,
            "notes" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_sales_contract_items_contract"
            ON "apps_kuaizhizao_sales_contract_items" ("tenant_id", "contract_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_contract_milestones" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "contract_id" INT NOT NULL,
            "milestone_name" VARCHAR(200) NOT NULL,
            "planned_date" DATE NOT NULL,
            "planned_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "planned_ratio" DECIMAL(8,4),
            "billing_trigger" VARCHAR(20) NOT NULL DEFAULT 'milestone',
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "receivable_id" INT,
            "receivable_code" VARCHAR(50),
            "notes" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_sales_contract_milestones_contract"
            ON "apps_kuaizhizao_sales_contract_milestones" ("tenant_id", "contract_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_contract_changes" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "change_code" VARCHAR(50) NOT NULL,
            "contract_id" INT NOT NULL,
            "contract_code" VARCHAR(50) NOT NULL,
            "change_type" VARCHAR(30) NOT NULL DEFAULT 'amendment',
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "delta_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
            "new_valid_to" DATE,
            "new_total_amount" DECIMAL(14,2),
            "reason" TEXT,
            "new_contract_id" INT,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_sales_contract_changes_contract"
            ON "apps_kuaizhizao_sales_contract_changes" ("tenant_id", "contract_id");

        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "contract_id" INT,
            ADD COLUMN IF NOT EXISTS "contract_code" VARCHAR(50);
        ALTER TABLE "apps_kuaizhizao_sales_orders"
            ADD COLUMN IF NOT EXISTS "contract_id" INT,
            ADD COLUMN IF NOT EXISTS "contract_code" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "is_release_order" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_sales_opportunities"
            ADD COLUMN IF NOT EXISTS "contract_id" INT,
            ADD COLUMN IF NOT EXISTS "contract_code" VARCHAR(50);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_opportunities"
            DROP COLUMN IF EXISTS "contract_code",
            DROP COLUMN IF EXISTS "contract_id";
        ALTER TABLE "apps_kuaizhizao_sales_orders"
            DROP COLUMN IF EXISTS "is_release_order",
            DROP COLUMN IF EXISTS "contract_code",
            DROP COLUMN IF EXISTS "contract_id";
        ALTER TABLE "apps_kuaizhizao_quotations"
            DROP COLUMN IF EXISTS "contract_code",
            DROP COLUMN IF EXISTS "contract_id";
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_contract_changes" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_contract_milestones" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_contract_items" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_contracts" CASCADE;
    """
