"""
创建用户偏好表迁移

创建用户偏好表，用于存储用户的偏好设置。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "root_user_preferences" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "user_id" INT NOT NULL,
            "preferences" JSONB NOT NULL DEFAULT '{}',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 创建唯一约束（user_id）
        CREATE UNIQUE INDEX IF NOT EXISTS "uk_root_user_preferences_user_id" ON "root_user_preferences" ("user_id");
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_root_user_preferences_tenant_id" ON "root_user_preferences" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_root_user_preferences_uuid" ON "root_user_preferences" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_root_user_preferences_user_id" ON "root_user_preferences" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_root_user_preferences_created_at" ON "root_user_preferences" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_root_user_preferences_created_at";
        DROP INDEX IF EXISTS "idx_root_user_preferences_user_id";
        DROP INDEX IF EXISTS "idx_root_user_preferences_uuid";
        DROP INDEX IF EXISTS "idx_root_user_preferences_tenant_id";
        DROP INDEX IF EXISTS "uk_root_user_preferences_user_id";
        
        -- 删除表
        DROP TABLE IF EXISTS "root_user_preferences";
    """

