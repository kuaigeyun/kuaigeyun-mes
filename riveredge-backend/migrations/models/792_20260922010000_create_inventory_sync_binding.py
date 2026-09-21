"""补建即时库存同步绑定表（兼容已跑过旧版 785、但表仍缺失的库）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_inventory_sync_binding" (
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "id" SERIAL NOT NULL PRIMARY KEY,
    "source_type" VARCHAR(20),
    "api_uuid" VARCHAR(36),
    "dataset_uuid" VARCHAR(36),
    "field_mapping" JSONB,
    "match_key_field" VARCHAR(64) NOT NULL DEFAULT 'material_code',
    "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full',
    "sync_direction" VARCHAR(20) NOT NULL DEFAULT 'pull',
    "schedule_interval_minutes" INT NOT NULL DEFAULT 15,
    "last_success_at" TIMESTAMPTZ,
    "last_attempt_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_inventory_sync_binding_tenant"
    ON "apps_kuaizhizao_inventory_sync_binding" ("tenant_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaizhizao_inventory_sync_binding" CASCADE;
"""
