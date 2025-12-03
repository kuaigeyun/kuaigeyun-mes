"""
添加用户个人资料字段迁移

扩展用户表，添加个人资料字段。
注意：用户表在 soil 模块中（soil_users），但迁移文件在 tree_root 模块的 migrations 中。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 添加个人资料字段（如果不存在）
        -- 注意：用户表名是 sys_users（根据 User 模型的 Meta.table 定义）
        DO $$ 
        BEGIN
            -- 检查并添加 avatar 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_users' AND column_name = 'avatar'
            ) THEN
                ALTER TABLE sys_users ADD COLUMN avatar VARCHAR(36);
            END IF;
            
            -- 检查并添加 bio 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_users' AND column_name = 'bio'
            ) THEN
                ALTER TABLE sys_users ADD COLUMN bio TEXT;
            END IF;
            
            -- 检查并添加 contact_info 字段
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sys_users' AND column_name = 'contact_info'
            ) THEN
                ALTER TABLE sys_users ADD COLUMN contact_info JSONB;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除个人资料字段
        ALTER TABLE sys_users DROP COLUMN IF EXISTS contact_info;
        ALTER TABLE sys_users DROP COLUMN IF EXISTS bio;
        ALTER TABLE sys_users DROP COLUMN IF EXISTS avatar;
    """
