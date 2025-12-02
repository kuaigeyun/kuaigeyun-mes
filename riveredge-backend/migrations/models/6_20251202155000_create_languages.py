"""
创建语言表迁移

创建语言表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建语言表
        CREATE TABLE IF NOT EXISTS "sys_languages" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code" VARCHAR(10) NOT NULL,
            "name" VARCHAR(50) NOT NULL,
            "native_name" VARCHAR(50),
            "translations" JSONB NOT NULL DEFAULT '{}',
            "is_default" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "sort_order" INT NOT NULL DEFAULT 0,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_languag_tenant__u9v4w5" UNIQUE ("tenant_id", "code")
        );
        
        -- 创建语言表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_tenant__u9v4w5" ON "sys_languages" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_code_v9w4x5" ON "sys_languages" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_languag_created_w9x4y5" ON "sys_languages" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除语言表索引
        DROP INDEX IF EXISTS "idx_sys_languag_created_w9x4y5";
        DROP INDEX IF EXISTS "idx_sys_languag_code_v9w4x5";
        DROP INDEX IF EXISTS "idx_sys_languag_tenant__u9v4w5";
        
        -- 删除语言表
        DROP TABLE IF EXISTS "sys_languages";
    """

