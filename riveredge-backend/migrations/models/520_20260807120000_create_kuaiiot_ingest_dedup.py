"""
创建快数采 ingest 幂等表

apps_kuaiiot_ingest_dedup
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaiiot_ingest_dedup" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "device_id" INT NOT NULL,
            "idempotency_key" VARCHAR(128) NOT NULL,
            "response_json" TEXT NOT NULL,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaiiot_ingest_dedup_key" UNIQUE ("tenant_id", "device_id", "idempotency_key")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaiiot_ingest_dedup_device" ON "apps_kuaiiot_ingest_dedup" ("tenant_id", "device_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaiiot_ingest_dedup";
    """
