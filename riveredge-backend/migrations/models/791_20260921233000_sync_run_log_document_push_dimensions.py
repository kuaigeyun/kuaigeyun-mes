"""SyncRunLog 外推三维：category × connector_type × target_profile。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "core_sync_run_logs"
    ADD COLUMN IF NOT EXISTS "category" VARCHAR(32);
ALTER TABLE "core_sync_run_logs"
    ADD COLUMN IF NOT EXISTS "connector_type" VARCHAR(64);
ALTER TABLE "core_sync_run_logs"
    ADD COLUMN IF NOT EXISTS "target_profile" VARCHAR(64);
COMMENT ON COLUMN "core_sync_run_logs"."category" IS '连接器品类（erp/oa/collaboration/...）';
COMMENT ON COLUMN "core_sync_run_logs"."connector_type" IS '连接器类型';
COMMENT ON COLUMN "core_sync_run_logs"."target_profile" IS '外推目标 profile';
CREATE INDEX IF NOT EXISTS "idx_sync_run_logs_push_dims"
    ON "core_sync_run_logs" ("tenant_id", "entity_type", "category", "connector_type", "target_profile");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_sync_run_logs_push_dims";
ALTER TABLE "core_sync_run_logs" DROP COLUMN IF EXISTS "target_profile";
ALTER TABLE "core_sync_run_logs" DROP COLUMN IF EXISTS "connector_type";
ALTER TABLE "core_sync_run_logs" DROP COLUMN IF EXISTS "category";
"""
