"""主数据 - 客户/物料同步绑定表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_master_data_customer_sync_binding" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "source_type" VARCHAR(20),
            "api_uuid" VARCHAR(36),
            "dataset_uuid" VARCHAR(36),
            "field_mapping" JSONB,
            "match_key_field" VARCHAR(64) NOT NULL DEFAULT 'code',
            "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full'
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "ux_master_data_customer_sync_bind_tenant"
            ON "apps_master_data_customer_sync_binding" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_master_data_material_sync_binding" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "source_type" VARCHAR(20),
            "api_uuid" VARCHAR(36),
            "dataset_uuid" VARCHAR(36),
            "field_mapping" JSONB,
            "match_key_field" VARCHAR(64) NOT NULL DEFAULT 'main_code',
            "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full'
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "ux_master_data_material_sync_bind_tenant"
            ON "apps_master_data_material_sync_binding" ("tenant_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_master_data_material_sync_binding" CASCADE;
        DROP TABLE IF EXISTS "apps_master_data_customer_sync_binding" CASCADE;
    """
