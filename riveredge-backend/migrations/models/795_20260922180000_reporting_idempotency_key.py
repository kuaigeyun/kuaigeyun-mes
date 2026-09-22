"""报工记录幂等键字段（可空 + 租户内部分唯一）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_reporting_records"
    ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS "uid_reporting_tenant_idempotency"
    ON "apps_kuaizhizao_reporting_records" ("tenant_id", "idempotency_key")
    WHERE "idempotency_key" IS NOT NULL AND "deleted_at" IS NULL;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "uid_reporting_tenant_idempotency";
ALTER TABLE "apps_kuaizhizao_reporting_records"
    DROP COLUMN IF EXISTS "idempotency_key";
"""
