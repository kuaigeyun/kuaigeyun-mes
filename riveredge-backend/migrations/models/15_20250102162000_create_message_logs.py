"""
创建消息发送记录表迁移

创建消息发送记录表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建消息发送记录表
        CREATE TABLE IF NOT EXISTS "root_message_logs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "template_uuid" VARCHAR(36),
            "config_uuid" VARCHAR(36),
            "type" VARCHAR(20) NOT NULL,
            "recipient" VARCHAR(200) NOT NULL,
            "subject" VARCHAR(200),
            "content" TEXT NOT NULL,
            "variables" JSONB,
            "status" VARCHAR(20) NOT NULL,
            "inngest_run_id" VARCHAR(100),
            "error_message" TEXT,
            "sent_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_message_logs" IS '消息日志表';
        
        -- 创建消息发送记录表索引
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_tenant_id" ON "root_message_logs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_uuid" ON "root_message_logs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_template_uuid" ON "root_message_logs" ("template_uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_config_uuid" ON "root_message_logs" ("config_uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_type" ON "root_message_logs" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_status" ON "root_message_logs" ("status");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_inngest_run_id" ON "root_message_logs" ("inngest_run_id");
        CREATE INDEX IF NOT EXISTS "idx_root_message_logs_created_at" ON "root_message_logs" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除消息发送记录表索引
        DROP INDEX IF EXISTS "idx_root_message_logs_created_at";
        DROP INDEX IF EXISTS "idx_root_message_logs_inngest_run_id";
        DROP INDEX IF EXISTS "idx_root_message_logs_status";
        DROP INDEX IF EXISTS "idx_root_message_logs_type";
        DROP INDEX IF EXISTS "idx_root_message_logs_config_uuid";
        DROP INDEX IF EXISTS "idx_root_message_logs_template_uuid";
        DROP INDEX IF EXISTS "idx_root_message_logs_uuid";
        DROP INDEX IF EXISTS "idx_root_message_logs_tenant_id";
        
        -- 删除消息发送记录表
        DROP TABLE IF EXISTS "root_message_logs";
    """

