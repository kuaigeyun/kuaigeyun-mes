"""
创建同步运行历史日志表

Author: RiverEdge Team
Date: 2026-09-11
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "core_sync_run_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "binding_id" INT,
            "entity_type" VARCHAR(50) NOT NULL,
            "mode" VARCHAR(20) NOT NULL DEFAULT 'full',
            "status" VARCHAR(20) NOT NULL DEFAULT 'success',
            "created" INT NOT NULL DEFAULT 0,
            "updated" INT NOT NULL DEFAULT 0,
            "skipped" INT NOT NULL DEFAULT 0,
            "failed" INT NOT NULL DEFAULT 0,
            "fetched" INT NOT NULL DEFAULT 0,
            "truncated" BOOL NOT NULL DEFAULT false,
            "duration_ms" INT NOT NULL DEFAULT 0,
            "error_summary" TEXT,
            "started_at" TIMESTAMPTZ,
            "finished_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_sync_run_logs_tenant" ON "core_sync_run_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sync_run_logs_tenant_entity" ON "core_sync_run_logs" ("tenant_id", "entity_type");
        CREATE INDEX IF NOT EXISTS "idx_sync_run_logs_tenant_created" ON "core_sync_run_logs" ("tenant_id", "created_at");
        CREATE INDEX IF NOT EXISTS "idx_sync_run_logs_binding" ON "core_sync_run_logs" ("binding_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "core_sync_run_logs";
    """