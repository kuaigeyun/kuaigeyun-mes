"""
迁移：将 is_superuser 字段重命名为 is_platform_admin

为了统一命名规范，将 is_superuser 字段重命名为 is_platform_admin，
使其与 is_tenant_admin 的命名风格保持一致，更清晰地表达"平台管理员"的含义。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级数据库
    
    将 core_users 表的 is_superuser 字段重命名为 is_platform_admin
    """
    return """
        -- 重命名字段
        ALTER TABLE "core_users" 
        RENAME COLUMN "is_superuser" TO "is_platform_admin";
        
        -- 更新字段注释
        COMMENT ON COLUMN "core_users"."is_platform_admin" IS '是否为平台管理员（系统级超级管理员，需 tenant_id=None）';
        
        -- 更新索引名称（如果存在）
        DROP INDEX IF EXISTS "idx_core_users_is_superuser";
        CREATE INDEX IF NOT EXISTS "idx_core_users_is_platform_admin" ON "core_users" ("is_platform_admin");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚数据库
    
    将 is_platform_admin 字段重命名回 is_superuser
    """
    return """
        -- 重命名字段回原名称
        ALTER TABLE "core_users" 
        RENAME COLUMN "is_platform_admin" TO "is_superuser";
        
        -- 更新字段注释
        COMMENT ON COLUMN "core_users"."is_superuser" IS '是否为超级用户（组织内超级用户或系统级超级管理员）';
        
        -- 更新索引名称（如果存在）
        DROP INDEX IF EXISTS "idx_core_users_is_platform_admin";
        CREATE INDEX IF NOT EXISTS "idx_core_users_is_superuser" ON "core_users" ("is_superuser");
    """

