"""
创建接口表迁移

创建接口表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建接口表
        CREATE TABLE IF NOT EXISTS "root_apis" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "path" VARCHAR(500) NOT NULL,
            "method" VARCHAR(10) NOT NULL,
            "request_headers" JSONB,
            "request_params" JSONB,
            "request_body" JSONB,
            "response_format" JSONB,
            "response_example" JSONB,
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_system" BOOL NOT NULL DEFAULT False,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        
        -- 创建接口表索引
        CREATE INDEX IF NOT EXISTS "idx_root_apis_tenant_id" ON "root_apis" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_apis_uuid" ON "root_apis" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_apis_code" ON "root_apis" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_apis_method" ON "root_apis" ("method");
        CREATE INDEX IF NOT EXISTS "idx_root_apis_created_at" ON "root_apis" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_apis_tenant_code" ON "root_apis" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除接口表索引
        DROP INDEX IF EXISTS "uk_root_apis_tenant_code";
        DROP INDEX IF EXISTS "idx_root_apis_created_at";
        DROP INDEX IF EXISTS "idx_root_apis_method";
        DROP INDEX IF EXISTS "idx_root_apis_code";
        DROP INDEX IF EXISTS "idx_root_apis_uuid";
        DROP INDEX IF EXISTS "idx_root_apis_tenant_id";
        
        -- 删除接口表
        DROP TABLE IF EXISTS "root_apis";
    """

