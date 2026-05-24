"""MaterialCodeAlias 增加 name；新建客户供应商价格本表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_material_code_aliases"
            ADD COLUMN IF NOT EXISTS "name" VARCHAR(200);
        COMMENT ON COLUMN "apps_master_data_material_code_aliases"."name" IS '名称（客户品名/供应商品名等）';

        CREATE TABLE IF NOT EXISTS "apps_master_data_partner_price_books" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "partner_type" VARCHAR(20) NOT NULL,
            "partner_id" INT NOT NULL,
            "material_id" INT NOT NULL REFERENCES "apps_master_data_materials" ("id") ON DELETE RESTRICT,
            "unit_price" DECIMAL(18,4) NOT NULL,
            "currency_code" VARCHAR(10),
            "tax_rate" DECIMAL(8,4),
            "unit" VARCHAR(20),
            "effective_from" DATE,
            "effective_to" DATE,
            "remark" TEXT,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        COMMENT ON TABLE "apps_master_data_partner_price_books" IS '基础数据管理 - 客户供应商价格本';

        CREATE INDEX IF NOT EXISTS "idx_partner_price_books_tenant"
            ON "apps_master_data_partner_price_books" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_partner_price_books_partner"
            ON "apps_master_data_partner_price_books" ("tenant_id", "partner_type", "partner_id");
        CREATE INDEX IF NOT EXISTS "idx_partner_price_books_material"
            ON "apps_master_data_partner_price_books" ("tenant_id", "material_id");
        CREATE INDEX IF NOT EXISTS "idx_partner_price_books_lookup"
            ON "apps_master_data_partner_price_books" ("tenant_id", "partner_type", "partner_id", "material_id");
        CREATE INDEX IF NOT EXISTS "idx_partner_price_books_effective"
            ON "apps_master_data_partner_price_books" ("tenant_id", "effective_from", "effective_to");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_partner_price_books";
        ALTER TABLE "apps_master_data_material_code_aliases"
            DROP COLUMN IF EXISTS "name";
    """
