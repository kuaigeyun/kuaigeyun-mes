"""
迁移：添加用户来源字段

为用户表添加 source 字段，用于记录用户来源（invite_code, personal, organization等）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级数据库
    
    为 core_users 表添加 source 字段
    """
    return """
        -- 添加 source 字段（可为空）
        ALTER TABLE "core_users" 
        ADD COLUMN IF NOT EXISTS "source" VARCHAR(50);
        
        -- 添加字段注释
        COMMENT ON COLUMN "core_users"."source" IS '用户来源（invite_code, personal, organization等）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚数据库
    
    删除 source 字段
    """
    return """
        -- 删除 source 字段
        ALTER TABLE "core_users" 
        DROP COLUMN IF EXISTS "source";
    """

