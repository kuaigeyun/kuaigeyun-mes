"""
创建打印模板表迁移

创建打印模板表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建打印模板表
        CREATE TABLE IF NOT EXISTS "root_print_templates" (
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
            "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
            "usage_count" INT NOT NULL DEFAULT 0,
            "last_used_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_print_templates" IS '打印模板表';
        
        -- 创建打印模板表索引
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_tenant_id" ON "root_print_templates" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_uuid" ON "root_print_templates" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_code" ON "root_print_templates" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_type" ON "root_print_templates" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_is_active" ON "root_print_templates" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_is_default" ON "root_print_templates" ("is_default");
        CREATE INDEX IF NOT EXISTS "idx_root_print_templates_created_at" ON "root_print_templates" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_print_templates_tenant_code" ON "root_print_templates" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除打印模板表索引
        DROP INDEX IF EXISTS "uk_root_print_templates_tenant_code";
        DROP INDEX IF EXISTS "idx_root_print_templates_created_at";
        DROP INDEX IF EXISTS "idx_root_print_templates_is_default";
        DROP INDEX IF EXISTS "idx_root_print_templates_is_active";
        DROP INDEX IF EXISTS "idx_root_print_templates_type";
        DROP INDEX IF EXISTS "idx_root_print_templates_code";
        DROP INDEX IF EXISTS "idx_root_print_templates_uuid";
        DROP INDEX IF EXISTS "idx_root_print_templates_tenant_id";
        
        -- 删除打印模板表
        DROP TABLE IF EXISTS "root_print_templates";
    """

