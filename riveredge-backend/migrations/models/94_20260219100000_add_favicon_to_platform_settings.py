"""
添加 Favicon 字段到平台设置

为平台设置表添加 favicon 字段，用于自定义浏览器标签页图标。

Author: Auto (AI Assistant)
Date: 2026-02-19
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加 favicon 字段
    """
    return """
        -- ============================================
        -- 添加 favicon 字段到平台设置表
        -- ============================================
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "favicon" VARCHAR(500) NULL;
        
        -- 添加字段注释
        COMMENT ON COLUMN "infra_platform_settings"."favicon" IS '网站 Favicon URL（浏览器标签页图标）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 favicon 字段
    """
    return """
        -- 删除 favicon 字段
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "favicon";
    """
