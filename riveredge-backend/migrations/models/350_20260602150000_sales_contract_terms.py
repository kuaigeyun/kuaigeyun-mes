from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_contract_term_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "term_code" VARCHAR(50),
            "term_name" VARCHAR(200) NOT NULL,
            "content" TEXT NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_sc_term_items_tenant_active"
            ON "apps_kuaizhizao_sales_contract_term_items" ("tenant_id", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_sc_term_items_tenant_code"
            ON "apps_kuaizhizao_sales_contract_term_items" ("tenant_id", "term_code");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_contract_term_groups" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "group_code" VARCHAR(50),
            "group_name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_sc_term_groups_tenant_active"
            ON "apps_kuaizhizao_sales_contract_term_groups" ("tenant_id", "is_active");
        CREATE INDEX IF NOT EXISTS "idx_sc_term_groups_tenant_code"
            ON "apps_kuaizhizao_sales_contract_term_groups" ("tenant_id", "group_code");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_sales_contract_term_group_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "group_id" INT NOT NULL,
            "term_item_id" INT NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS "idx_sc_term_group_items_tenant_group"
            ON "apps_kuaizhizao_sales_contract_term_group_items" ("tenant_id", "group_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_sc_term_group_items_unique"
            ON "apps_kuaizhizao_sales_contract_term_group_items" ("tenant_id", "group_id", "term_item_id");

        ALTER TABLE "apps_kuaizhizao_sales_contracts"
            ADD COLUMN IF NOT EXISTS "term_group_id" INT,
            ADD COLUMN IF NOT EXISTS "term_group_name" VARCHAR(200),
            ADD COLUMN IF NOT EXISTS "contract_terms" JSONB;
    """
