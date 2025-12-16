"""
创建集成配置表迁移

创建集成配置表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建集成配置表
        CREATE TABLE IF NOT EXISTS "root_integration_configs" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "config" JSONB NOT NULL DEFAULT '{}',
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_connected" BOOL NOT NULL DEFAULT False,
            "last_connected_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_root_integra_tenant__b1c2d3" UNIQUE ("tenant_id", "code")
        );
COMMENT ON TABLE "root_integration_configs" IS '集成配置表';
        
        -- 创建集成配置表索引
        CREATE INDEX IF NOT EXISTS "idx_root_integra_tenant__b1c2d3" ON "root_integration_configs" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_integra_code_b1c2d4" ON "root_integration_configs" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_integra_uuid_b1c2d5" ON "root_integration_configs" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_integra_type_b1c2d6" ON "root_integration_configs" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_integra_created_b1c2d7" ON "root_integration_configs" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除集成配置表索引
        DROP INDEX IF EXISTS "idx_root_integra_created_b1c2d7";
        DROP INDEX IF EXISTS "idx_root_integra_type_b1c2d6";
        DROP INDEX IF EXISTS "idx_root_integra_uuid_b1c2d5";
        DROP INDEX IF EXISTS "idx_root_integra_code_b1c2d4";
        DROP INDEX IF EXISTS "idx_root_integra_tenant__b1c2d3";
        
        -- 删除集成配置表
        DROP TABLE IF EXISTS "root_integration_configs";
    """

