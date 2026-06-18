"""移除 SOP 执行记录表 inngest_run_id（Inngest 已停用）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_apps_master_data_sop_executions_inngest_run_id";
ALTER TABLE "apps_master_data_sop_executions"
    DROP COLUMN IF EXISTS "inngest_run_id";
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_sop_executions"
    ADD COLUMN IF NOT EXISTS "inngest_run_id" varchar(100);
CREATE INDEX IF NOT EXISTS "idx_apps_master_data_sop_executions_inngest_run_id"
    ON "apps_master_data_sop_executions" ("inngest_run_id");
"""
