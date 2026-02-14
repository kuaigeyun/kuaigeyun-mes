"""
为 BOM 表添加 is_default 字段

apps_master_data_bom 表增加：
- is_default: 是否为默认版本（每个物料至多一个默认版本）

Author: Auto (AI Assistant)
Date: 2026-02-14
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为 BOM 表添加 is_default 字段
    """
    return """
        -- 添加 is_default 字段
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT FALSE;
        
        -- 添加字段注释
        COMMENT ON COLUMN "apps_master_data_bom"."is_default" IS '是否为默认版本（每个物料至多一个默认版本）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 is_default 字段
    """
    return """
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        DROP COLUMN IF EXISTS "is_default";
    """
