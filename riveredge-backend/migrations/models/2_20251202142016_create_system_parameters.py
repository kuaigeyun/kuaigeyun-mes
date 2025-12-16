"""
创建系统参数表迁移

创建系统参数表，支持多组织隔离和 Redis 缓存。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建系统参数表
        CREATE TABLE IF NOT EXISTS "sys_system_parameters" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "key" VARCHAR(100) NOT NULL,
            "value" TEXT NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_system_tenant__c9d4e5" UNIQUE ("tenant_id", "key")
        );
        COMMENT ON TABLE "sys_system_parameters" IS '系统参数表';
        
        -- 创建系统参数表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_system_tenant__c9d4e5" ON "sys_system_parameters" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_system_key_d9e4f5" ON "sys_system_parameters" ("key");
        CREATE INDEX IF NOT EXISTS "idx_sys_system_created_e9f4g5" ON "sys_system_parameters" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除系统参数表索引
        DROP INDEX IF EXISTS "idx_sys_system_created_e9f4g5";
        DROP INDEX IF EXISTS "idx_sys_system_key_d9e4f5";
        DROP INDEX IF EXISTS "idx_sys_system_tenant__c9d4e5";
        
        -- 删除系统参数表
        DROP TABLE IF EXISTS "sys_system_parameters";
    """

