from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders"
            ADD COLUMN IF NOT EXISTS "term_group_id" INT,
            ADD COLUMN IF NOT EXISTS "term_group_name" VARCHAR(200),
            ADD COLUMN IF NOT EXISTS "contract_terms" JSONB;

        ALTER TABLE "apps_kuaizhizao_sales_contracts"
            ADD COLUMN IF NOT EXISTS "migrated_to_order_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "migration_batch_id" VARCHAR(50);

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_order_milestones" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sales_order_id" INT NOT NULL,
            "milestone_name" VARCHAR(200) NOT NULL,
            "planned_date" DATE NOT NULL,
            "planned_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "planned_ratio" DECIMAL(8,4),
            "billing_trigger" VARCHAR(20) NOT NULL DEFAULT 'milestone',
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "receivable_id" INT,
            "receivable_code" VARCHAR(50),
            "notes" TEXT
        );
        CREATE INDEX IF NOT EXISTS "idx_sales_order_milestones_tenant_order"
            ON "apps_kuaizhizao_sales_order_milestones" ("tenant_id", "sales_order_id");
        CREATE INDEX IF NOT EXISTS "idx_sales_order_milestones_planned_date"
            ON "apps_kuaizhizao_sales_order_milestones" ("planned_date");
        CREATE INDEX IF NOT EXISTS "idx_sales_order_milestones_status"
            ON "apps_kuaizhizao_sales_order_milestones" ("status");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_sales_order_milestones";
        ALTER TABLE "apps_kuaizhizao_sales_orders"
            DROP COLUMN IF EXISTS "term_group_id",
            DROP COLUMN IF EXISTS "term_group_name",
            DROP COLUMN IF EXISTS "contract_terms";
        ALTER TABLE "apps_kuaizhizao_sales_contracts"
            DROP COLUMN IF EXISTS "migrated_to_order_at",
            DROP COLUMN IF EXISTS "migration_batch_id";
    """
