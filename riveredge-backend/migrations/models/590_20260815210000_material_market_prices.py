"""
创建原料行情表。

Author: AI Assistant
Date: 2026-08-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_market_prices" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
            "tenant_id" INT,
            "material_id" INT NOT NULL,
            "price_date" DATE NOT NULL,
            "unit_price" NUMERIC(18, 6) NOT NULL,
            "price_type" VARCHAR(20) NOT NULL DEFAULT 'tax_inclusive',
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_md_mkt_price_tenant"
            ON "apps_master_data_material_market_prices" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_md_mkt_price_material"
            ON "apps_master_data_material_market_prices" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_md_mkt_price_date"
            ON "apps_master_data_material_market_prices" ("price_date");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_md_mkt_price_tenant_mat_date"
            ON "apps_master_data_material_market_prices" ("tenant_id", "material_id", "price_date")
            WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_material_market_prices";
    """
