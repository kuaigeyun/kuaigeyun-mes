"""
创建文件表迁移

创建文件表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建文件表
        CREATE TABLE IF NOT EXISTS "root_files" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(255) NOT NULL,
            "original_name" VARCHAR(255) NOT NULL,
            "file_path" VARCHAR(500) NOT NULL,
            "file_size" BIGINT NOT NULL,
            "file_type" VARCHAR(100),
            "file_extension" VARCHAR(20),
            "preview_url" VARCHAR(500),
            "category" VARCHAR(50),
            "tags" JSONB,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "upload_status" VARCHAR(20) NOT NULL DEFAULT 'completed',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "root_files" IS '文件表';
        
        -- 创建文件表索引
        CREATE INDEX IF NOT EXISTS "idx_root_files_tenant_id" ON "root_files" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_files_uuid" ON "root_files" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_files_category" ON "root_files" ("category");
        CREATE INDEX IF NOT EXISTS "idx_root_files_file_type" ON "root_files" ("file_type");
        CREATE INDEX IF NOT EXISTS "idx_root_files_upload_status" ON "root_files" ("upload_status");
        CREATE INDEX IF NOT EXISTS "idx_root_files_created_at" ON "root_files" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除文件表索引
        DROP INDEX IF EXISTS "idx_root_files_created_at";
        DROP INDEX IF EXISTS "idx_root_files_upload_status";
        DROP INDEX IF EXISTS "idx_root_files_file_type";
        DROP INDEX IF EXISTS "idx_root_files_category";
        DROP INDEX IF EXISTS "idx_root_files_uuid";
        DROP INDEX IF EXISTS "idx_root_files_tenant_id";
        
        -- 删除文件表
        DROP TABLE IF EXISTS "root_files";
    """

