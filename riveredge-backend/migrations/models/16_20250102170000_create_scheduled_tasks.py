"""
创建定时任务表迁移

创建定时任务表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建定时任务表
        CREATE TABLE IF NOT EXISTS "root_scheduled_tasks" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "type" VARCHAR(20) NOT NULL,
            "trigger_type" VARCHAR(20) NOT NULL,
            "trigger_config" JSONB NOT NULL,
            "task_config" JSONB NOT NULL,
            "inngest_function_id" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_running" BOOL NOT NULL DEFAULT False,
            "last_run_at" TIMESTAMPTZ,
            "last_run_status" VARCHAR(20),
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        
        -- 创建定时任务表索引
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_tenant_id" ON "root_scheduled_tasks" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_uuid" ON "root_scheduled_tasks" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_code" ON "root_scheduled_tasks" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_type" ON "root_scheduled_tasks" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_trigger_type" ON "root_scheduled_tasks" ("trigger_type");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_is_active" ON "root_scheduled_tasks" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_scheduled_tasks_created_at" ON "root_scheduled_tasks" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_scheduled_tasks_tenant_code" ON "root_scheduled_tasks" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除定时任务表索引
        DROP INDEX IF EXISTS "uk_root_scheduled_tasks_tenant_code";
        DROP INDEX IF EXISTS "idx_root_scheduled_tasks_created_at";
        DROP INDEX IF EXISTS "idx_root_scheduled_tasks_is_active";
        DROP INDEX IF EXISTS "idx_root_scheduled_tasks_trigger_type";
        DROP INDEX IF EXISTS "idx_root_scheduled_tasks_type";
        DROP INDEX IF EXISTS "idx_root_scheduled_tasks_code";
        DROP INDEX IF EXISTS "idx_root_scheduled_tasks_uuid";
        DROP INDEX IF EXISTS "idx_root_scheduled_tasks_tenant_id";
        
        -- 删除定时任务表
        DROP TABLE IF EXISTS "root_scheduled_tasks";
    """

