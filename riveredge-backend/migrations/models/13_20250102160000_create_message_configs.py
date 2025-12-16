"""
创建消息配置表迁移

创建消息配置表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建消息配置表
        CREATE TABLE IF NOT EXISTS "root_message_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "config" JSONB NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_default" BOOL NOT NULL DEFAULT False,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_message_configs" IS '消息配置表';
        
        -- 创建消息配置表索引
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_tenant_id" ON "root_message_configs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_uuid" ON "root_message_configs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_code" ON "root_message_configs" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_type" ON "root_message_configs" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_message_configs_created_at" ON "root_message_configs" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_message_configs_tenant_code" ON "root_message_configs" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除消息配置表索引
        DROP INDEX IF EXISTS "uk_root_message_configs_tenant_code";
        DROP INDEX IF EXISTS "idx_root_message_configs_created_at";
        DROP INDEX IF EXISTS "idx_root_message_configs_type";
        DROP INDEX IF EXISTS "idx_root_message_configs_code";
        DROP INDEX IF EXISTS "idx_root_message_configs_uuid";
        DROP INDEX IF EXISTS "idx_root_message_configs_tenant_id";
        
        -- 删除消息配置表
        DROP TABLE IF EXISTS "root_message_configs";
    """

