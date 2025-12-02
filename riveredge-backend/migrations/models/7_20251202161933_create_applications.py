"""
创建应用表迁移

创建应用表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建应用表
        CREATE TABLE IF NOT EXISTS "root_applications" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "icon" VARCHAR(200),
            "version" VARCHAR(20),
            "route_path" VARCHAR(200),
            "entry_point" VARCHAR(500),
            "menu_config" JSONB,
            "permission_code" VARCHAR(100),
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "is_installed" BOOL NOT NULL DEFAULT False,
            "sort_order" INT NOT NULL DEFAULT 0,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_root_applic_tenant__a1b2c3" UNIQUE ("tenant_id", "code")
        );
        
        -- 创建应用表索引
        CREATE INDEX IF NOT EXISTS "idx_root_applic_tenant__a1b2c3" ON "root_applications" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_applic_code_a1b2c4" ON "root_applications" ("code");
        CREATE INDEX IF NOT EXISTS "idx_root_applic_uuid_a1b2c5" ON "root_applications" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_applic_created_a1b2c6" ON "root_applications" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除应用表索引
        DROP INDEX IF EXISTS "idx_root_applic_created_a1b2c6";
        DROP INDEX IF EXISTS "idx_root_applic_uuid_a1b2c5";
        DROP INDEX IF EXISTS "idx_root_applic_code_a1b2c4";
        DROP INDEX IF EXISTS "idx_root_applic_tenant__a1b2c3";
        
        -- 删除应用表
        DROP TABLE IF EXISTS "root_applications";
    """

