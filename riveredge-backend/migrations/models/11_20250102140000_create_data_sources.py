"""
创建数据源表迁移

创建数据源表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建数据源表
        CREATE TABLE IF NOT EXISTS "root_data_sources" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "type" VARCHAR(20) NOT NULL,
            "config" JSONB NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_connected" BOOL NOT NULL DEFAULT False,
            "last_connected_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_data_sources" IS '数据源表';
        
        -- 创建数据源表索引
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_tenant_id" ON "root_data_sources" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_uuid" ON "root_data_sources" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_code" ON "root_data_sources" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_type" ON "root_data_sources" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_data_sources_created_at" ON "root_data_sources" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_data_sources_tenant_code" ON "root_data_sources" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除数据源表索引
        DROP INDEX IF EXISTS "uk_root_data_sources_tenant_code";
        DROP INDEX IF EXISTS "idx_root_data_sources_created_at";
        DROP INDEX IF EXISTS "idx_root_data_sources_type";
        DROP INDEX IF EXISTS "idx_root_data_sources_code";
        DROP INDEX IF EXISTS "idx_root_data_sources_uuid";
        DROP INDEX IF EXISTS "idx_root_data_sources_tenant_id";
        
        -- 删除数据源表
        DROP TABLE IF EXISTS "root_data_sources";
    """

