"""
为 platform_superadmin 表添加 phone 字段迁移

扩展平台超级管理员表，添加手机号字段，与普通用户保持一致。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 为 platform_superadmin 表添加 phone 字段（如果不存在）
        DO $$ 
        BEGIN
            -- 检查并添加 phone 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'platform_superadmin' AND column_name = 'phone'
            ) THEN
                ALTER TABLE platform_superadmin ADD COLUMN phone VARCHAR(20);
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除 phone 字段
        ALTER TABLE platform_superadmin DROP COLUMN IF EXISTS phone;
    """

