"""主数据 — 物料单位 / 物料分组独立同步绑定表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_unit_sync_binding" (
            "id" SERIAL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "source_type" VARCHAR(20),
            "api_uuid" VARCHAR(36),
            "dataset_uuid" VARCHAR(36),
            "field_mapping" JSONB,
            "match_key_field" VARCHAR(64) NOT NULL DEFAULT 'code',
            "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full'
        );
        CREATE INDEX IF NOT EXISTS "idx_material_unit_sync_binding_tenant"
            ON "apps_master_data_material_unit_sync_binding" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_master_data_material_group_sync_binding" (
            "id" SERIAL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "source_type" VARCHAR(20),
            "api_uuid" VARCHAR(36),
            "dataset_uuid" VARCHAR(36),
            "field_mapping" JSONB,
            "match_key_field" VARCHAR(64) NOT NULL DEFAULT 'code',
            "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full'
        );
        CREATE INDEX IF NOT EXISTS "idx_material_group_sync_binding_tenant"
            ON "apps_master_data_material_group_sync_binding" ("tenant_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_material_group_sync_binding" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_material_unit_sync_binding" CASCADE;
    """
