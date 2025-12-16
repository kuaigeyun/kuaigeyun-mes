"""
创建数据集表迁移

创建数据集表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建数据集表
        CREATE TABLE IF NOT EXISTS "root_datasets" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "data_source_id" INT NOT NULL,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "query_type" VARCHAR(20) NOT NULL,
            "query_config" JSONB NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT True,
            "last_executed_at" TIMESTAMPTZ,
            "last_error" TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_datasets" IS '数据集表';
        
        -- 创建数据集表索引
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_tenant_id" ON "root_datasets" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_uuid" ON "root_datasets" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_code" ON "root_datasets" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_data_source_id" ON "root_datasets" ("data_source_id");
        CREATE INDEX IF NOT EXISTS "idx_root_datasets_created_at" ON "root_datasets" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_datasets_tenant_code" ON "root_datasets" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
        
        -- 创建外键约束（关联数据源表）
        ALTER TABLE "root_datasets" ADD CONSTRAINT "fk_root_datasets_data_source" 
        FOREIGN KEY ("data_source_id") REFERENCES "root_data_sources" ("id") ON DELETE RESTRICT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除外键约束
        ALTER TABLE "root_datasets" DROP CONSTRAINT IF EXISTS "fk_root_datasets_data_source";
        
        -- 删除数据集表索引
        DROP INDEX IF EXISTS "uk_root_datasets_tenant_code";
        DROP INDEX IF EXISTS "idx_root_datasets_created_at";
        DROP INDEX IF EXISTS "idx_root_datasets_data_source_id";
        DROP INDEX IF EXISTS "idx_root_datasets_code";
        DROP INDEX IF EXISTS "idx_root_datasets_uuid";
        DROP INDEX IF EXISTS "idx_root_datasets_tenant_id";
        
        -- 删除数据集表
        DROP TABLE IF EXISTS "root_datasets";
    """

