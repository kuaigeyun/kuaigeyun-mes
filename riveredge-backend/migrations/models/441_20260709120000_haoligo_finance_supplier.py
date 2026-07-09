"""
好力 GO — 财务材料供应商与单价清单。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_finance_supplier" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "supplier_code" VARCHAR(64) NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "tax_no" VARCHAR(64),
            "contact_name" VARCHAR(100),
            "contact_phone" VARCHAR(64),
            "payment_terms_days" INT NOT NULL DEFAULT 0,
            "settlement_method" VARCHAR(64),
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_haoligo_fin_supplier_tenant_code" UNIQUE ("tenant_id", "supplier_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_supplier_tenant" ON "haoligo_finance_supplier" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_supplier_code" ON "haoligo_finance_supplier" ("supplier_code");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_supplier_active" ON "haoligo_finance_supplier" ("is_active");

        CREATE TABLE IF NOT EXISTS "haoligo_finance_supplier_price" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "supplier_id" INT NOT NULL REFERENCES "haoligo_finance_supplier" ("id") ON DELETE RESTRICT,
            "material_code" VARCHAR(64) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "spec" VARCHAR(200),
            "unit" VARCHAR(32),
            "unit_price" DECIMAL(18,4) NOT NULL,
            "price_type" VARCHAR(16) NOT NULL,
            "tax_rate" DECIMAL(8,4),
            "material_id" INT,
            "effective_from" DATE,
            "effective_to" DATE,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_price_tenant" ON "haoligo_finance_supplier_price" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_price_supplier" ON "haoligo_finance_supplier_price" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_price_material" ON "haoligo_finance_supplier_price" ("material_code");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_price_sup_mat" ON "haoligo_finance_supplier_price" ("supplier_id", "material_code");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_price_effective" ON "haoligo_finance_supplier_price" ("effective_from", "effective_to");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_price_active" ON "haoligo_finance_supplier_price" ("is_active");

        CREATE TABLE IF NOT EXISTS "haoligo_finance_price_change_log" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "supplier_id" INT NOT NULL,
            "supplier_price_id" INT,
            "previous_price_id" INT,
            "material_code" VARCHAR(64) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "old_unit_price" DECIMAL(18,4),
            "new_unit_price" DECIMAL(18,4) NOT NULL,
            "change_source" VARCHAR(32) NOT NULL,
            "operator_user_id" INT,
            "operator_user_name" VARCHAR(100),
            "related_acceptance_line_id" INT,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_pcl_tenant" ON "haoligo_finance_price_change_log" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_pcl_supplier" ON "haoligo_finance_price_change_log" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_pcl_material" ON "haoligo_finance_price_change_log" ("material_code");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_pcl_created" ON "haoligo_finance_price_change_log" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_finance_price_change_log" CASCADE;
        DROP TABLE IF EXISTS "haoligo_finance_supplier_price" CASCADE;
        DROP TABLE IF EXISTS "haoligo_finance_supplier" CASCADE;
    """
