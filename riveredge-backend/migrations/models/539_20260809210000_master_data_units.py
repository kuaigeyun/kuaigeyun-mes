"""
创建物料单位与全局换算表。

Author: AI Assistant
Date: 2026-08-09
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_units" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
            "tenant_id" INT,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "is_system" BOOL NOT NULL DEFAULT FALSE,
            "sort_order" INT NOT NULL DEFAULT 0,
            "description" VARCHAR(500),
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_md_units_tenant"
            ON "apps_master_data_units" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_md_units_code"
            ON "apps_master_data_units" ("code");
        CREATE INDEX IF NOT EXISTS "idx_md_units_active"
            ON "apps_master_data_units" ("is_active");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_md_units_tenant_code"
            ON "apps_master_data_units" ("tenant_id", "code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_master_data_unit_conversions" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
            "tenant_id" INT,
            "from_unit_code" VARCHAR(50) NOT NULL,
            "to_unit_code" VARCHAR(50) NOT NULL,
            "numerator" INT NOT NULL,
            "denominator" INT NOT NULL,
            "is_system" BOOL NOT NULL DEFAULT FALSE,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "description" VARCHAR(500),
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_md_unit_conv_tenant"
            ON "apps_master_data_unit_conversions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_md_unit_conv_from"
            ON "apps_master_data_unit_conversions" ("from_unit_code");
        CREATE INDEX IF NOT EXISTS "idx_md_unit_conv_to"
            ON "apps_master_data_unit_conversions" ("to_unit_code");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_md_unit_conv_tenant_pair"
            ON "apps_master_data_unit_conversions" ("tenant_id", "from_unit_code", "to_unit_code")
            WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_unit_conversions";
        DROP TABLE IF EXISTS "apps_master_data_units";
    """
