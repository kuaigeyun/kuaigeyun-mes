"""
用户偏好表唯一约束改为 (tenant_id, user_id)

原约束仅对 user_id 唯一，导致同一用户在不同租户下无法各存一份偏好（新建租户保存主题报错）。
改为 (tenant_id, user_id) 联合唯一，支持多租户下每用户每租户一条偏好。

Author: Auto (AI Assistant)
Date: 2026-03-10
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：删除 user_id 单列唯一约束，添加 (tenant_id, user_id) 联合唯一约束
    """
    return """
        -- ============================================
        -- core_user_preferences: 唯一约束改为 (tenant_id, user_id)
        -- ============================================
        DROP INDEX IF EXISTS "uk_core_user_preferences_user_id";
        
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_user_preferences_tenant_user"
        ON "core_user_preferences" ("tenant_id", "user_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：恢复仅 user_id 唯一（若存在多租户同用户多条记录则可能失败）
    """
    return """
        DROP INDEX IF EXISTS "uk_core_user_preferences_tenant_user";
        
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_core_user_preferences_user_id"
        ON "core_user_preferences" ("user_id");
    """
