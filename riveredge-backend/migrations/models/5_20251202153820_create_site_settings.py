"""
创建站点设置表迁移

创建站点设置和邀请码表，支持多组织隔离。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建站点设置表
        CREATE TABLE IF NOT EXISTS "sys_site_settings" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "settings" JSONB NOT NULL DEFAULT '{}',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_site_s_tenant__p9q4r5" UNIQUE ("tenant_id")
        );
        
        -- 创建站点设置表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_site_s_tenant__p9q4r5" ON "sys_site_settings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_site_s_created_q9r4s5" ON "sys_site_settings" ("created_at");
        
        -- 创建邀请码表
        CREATE TABLE IF NOT EXISTS "sys_invitation_codes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "code" VARCHAR(50) NOT NULL UNIQUE,
            "email" VARCHAR(100),
            "role_id" INT,
            "max_uses" INT NOT NULL DEFAULT 1,
            "used_count" INT NOT NULL DEFAULT 0,
            "expires_at" TIMESTAMPTZ,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        
        -- 创建邀请码表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_tenant__r9s4t5" ON "sys_invitation_codes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_code_s9t4u5" ON "sys_invitation_codes" ("code");
        CREATE INDEX IF NOT EXISTS "idx_sys_invita_created_t9u4v5" ON "sys_invitation_codes" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除邀请码表索引
        DROP INDEX IF EXISTS "idx_sys_invita_created_t9u4v5";
        DROP INDEX IF EXISTS "idx_sys_invita_code_s9t4u5";
        DROP INDEX IF EXISTS "idx_sys_invita_tenant__r9s4t5";
        
        -- 删除邀请码表
        DROP TABLE IF EXISTS "sys_invitation_codes";
        
        -- 删除站点设置表索引
        DROP INDEX IF EXISTS "idx_sys_site_s_created_q9r4s5";
        DROP INDEX IF EXISTS "idx_sys_site_s_tenant__p9q4r5";
        
        -- 删除站点设置表
        DROP TABLE IF EXISTS "sys_site_settings";
    """

