"""
创建电子记录表迁移

创建电子记录表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建电子记录表
        CREATE TABLE IF NOT EXISTS "root_electronic_records" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "type" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "content" JSONB NOT NULL,
            "file_uuid" VARCHAR(36),
            "inngest_workflow_id" VARCHAR(100),
            "inngest_run_id" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "lifecycle_stage" VARCHAR(20),
            "signer_id" INT,
            "signed_at" TIMESTAMPTZ,
            "signature_data" TEXT,
            "archived_at" TIMESTAMPTZ,
            "archive_location" VARCHAR(200),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_electronic_records" IS '电子记录表';
        
        -- 创建电子记录表索引
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_tenant_id" ON "root_electronic_records" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_uuid" ON "root_electronic_records" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_code" ON "root_electronic_records" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_type" ON "root_electronic_records" ("type");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_status" ON "root_electronic_records" ("status");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_lifecycle_stage" ON "root_electronic_records" ("lifecycle_stage");
        CREATE INDEX IF NOT EXISTS "idx_root_electronic_records_created_at" ON "root_electronic_records" ("created_at");
        
        -- 创建唯一约束（tenant_id + code）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_electronic_records_tenant_code" ON "root_electronic_records" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除电子记录表索引
        DROP INDEX IF EXISTS "uk_root_electronic_records_tenant_code";
        DROP INDEX IF EXISTS "idx_root_electronic_records_created_at";
        DROP INDEX IF EXISTS "idx_root_electronic_records_lifecycle_stage";
        DROP INDEX IF EXISTS "idx_root_electronic_records_status";
        DROP INDEX IF EXISTS "idx_root_electronic_records_type";
        DROP INDEX IF EXISTS "idx_root_electronic_records_code";
        DROP INDEX IF EXISTS "idx_root_electronic_records_uuid";
        DROP INDEX IF EXISTS "idx_root_electronic_records_tenant_id";
        
        -- 删除电子记录表
        DROP TABLE IF EXISTS "root_electronic_records";
    """

