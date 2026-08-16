"""
原料行情改为手输品种，不再绑定物料。

Author: AI Assistant
Date: 2026-08-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM "apps_master_data_material_market_prices";
        DROP INDEX IF EXISTS "uidx_md_mkt_price_tenant_mat_date";
        DROP INDEX IF EXISTS "idx_md_mkt_price_material";
        ALTER TABLE "apps_master_data_material_market_prices"
            DROP COLUMN IF EXISTS "material_id";
        ALTER TABLE "apps_master_data_material_market_prices"
            ADD COLUMN IF NOT EXISTS "code" VARCHAR(50) NOT NULL DEFAULT '';
        ALTER TABLE "apps_master_data_material_market_prices"
            ADD COLUMN IF NOT EXISTS "name" VARCHAR(100) NOT NULL DEFAULT '';
        CREATE INDEX IF NOT EXISTS "idx_md_mkt_price_code"
            ON "apps_master_data_material_market_prices" ("code");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_md_mkt_price_tenant_code_date"
            ON "apps_master_data_material_market_prices" ("tenant_id", "code", "price_date")
            WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uidx_md_mkt_price_tenant_code_date";
        DROP INDEX IF EXISTS "idx_md_mkt_price_code";
        ALTER TABLE "apps_master_data_material_market_prices"
            DROP COLUMN IF EXISTS "code";
        ALTER TABLE "apps_master_data_material_market_prices"
            DROP COLUMN IF EXISTS "name";
        ALTER TABLE "apps_master_data_material_market_prices"
            ADD COLUMN IF NOT EXISTS "material_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_md_mkt_price_material"
            ON "apps_master_data_material_market_prices" ("material_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_md_mkt_price_tenant_mat_date"
            ON "apps_master_data_material_market_prices" ("tenant_id", "material_id", "price_date")
            WHERE "deleted_at" IS NULL;
    """
