"""
数据库字段重命名迁移 - 将 is_platform_admin 重命名为 is_infra_admin

此迁移将 core_users 表中的 is_platform_admin 字段重命名为 is_infra_admin，
与代码中的字段名保持一致。

执行时间: 2025-12-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：将 is_platform_admin 字段重命名为 is_infra_admin
    """
    return """
        -- 数据库字段重命名迁移
        -- 将 core_users 表中的 is_platform_admin 字段重命名为 is_infra_admin
        
        -- 1. 重命名字段
        ALTER TABLE IF EXISTS "core_users" 
        RENAME COLUMN "is_platform_admin" TO "is_infra_admin";
        
        -- 2. 重命名相关索引
        -- 删除旧索引（如果存在）
        DROP INDEX IF EXISTS "idx_core_users_is_plat_e57f1c";
        DROP INDEX IF EXISTS "idx_sys_users_is_plat_e57f1c";
        
        -- 创建新索引
        CREATE INDEX IF NOT EXISTS "idx_core_users_is_infra_admin" 
        ON "core_users" ("is_infra_admin");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：反向重命名（回滚）
    """
    return """
        -- 反向重命名（回滚）
        
        -- 1. 删除新索引
        DROP INDEX IF EXISTS "idx_core_users_is_infra_admin";
        
        -- 2. 重命名字段回滚
        ALTER TABLE IF EXISTS "core_users" 
        RENAME COLUMN "is_infra_admin" TO "is_platform_admin";
        
        -- 3. 恢复旧索引
        CREATE INDEX IF NOT EXISTS "idx_core_users_is_plat_e57f1c" 
        ON "core_users" ("is_platform_admin");
    """

