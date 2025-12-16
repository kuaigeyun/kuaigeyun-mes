"""
创建消息模板表迁移

创建消息模板表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建消息模板表
        CREATE TABLE IF NOT EXISTS "root_message_templates" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "subject" VARCHAR(200),
            "content" TEXT NOT NULL,
            "variables" JSONB,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_message_templates" IS '消息模板表';
        
        -- 创建消息模板表索引
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_tenant_id" ON "root_message_templates" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_uuid" ON "root_message_templates" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_code" ON "root_message_templates" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_type" ON "root_message_templates" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_message_templates_created_at" ON "root_message_templates" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_message_templates_tenant_code" ON "root_message_templates" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除消息模板表索引
        DROP INDEX IF EXISTS "uk_root_message_templates_tenant_code";
        DROP INDEX IF EXISTS "idx_root_message_templates_created_at";
        DROP INDEX IF EXISTS "idx_root_message_templates_type";
        DROP INDEX IF EXISTS "idx_root_message_templates_code";
        DROP INDEX IF EXISTS "idx_root_message_templates_uuid";
        DROP INDEX IF EXISTS "idx_root_message_templates_tenant_id";
        
        -- 删除消息模板表
        DROP TABLE IF EXISTS "root_message_templates";
    """

