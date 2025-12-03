"""
创建脚本表迁移

创建脚本表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建脚本表
        CREATE TABLE IF NOT EXISTS "root_scripts" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "content" TEXT NOT NULL,
            "config" JSONB,
            "inngest_function_id" VARCHAR(100),
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "is_running" BOOLEAN NOT NULL DEFAULT FALSE,
            "last_run_at" TIMESTAMPTZ,
            "last_run_status" VARCHAR(20),
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        
        -- 创建脚本表索引
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_tenant_id" ON "root_scripts" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_uuid" ON "root_scripts" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_code" ON "root_scripts" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_type" ON "root_scripts" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_is_active" ON "root_scripts" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_scripts_created_at" ON "root_scripts" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_scripts_tenant_code" ON "root_scripts" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除脚本表索引
        DROP INDEX IF EXISTS "uk_root_scripts_tenant_code";
        DROP INDEX IF EXISTS "idx_root_scripts_created_at";
        DROP INDEX IF EXISTS "idx_root_scripts_is_active";
        DROP INDEX IF EXISTS "idx_root_scripts_type";
        DROP INDEX IF EXISTS "idx_root_scripts_code";
        DROP INDEX IF EXISTS "idx_root_scripts_uuid";
        DROP INDEX IF EXISTS "idx_root_scripts_tenant_id";
        
        -- 删除脚本表
        DROP TABLE IF EXISTS "root_scripts";
    """

