"""
添加主题颜色字段到平台设置

为平台设置表添加 theme_color 字段，用于自定义登录页和平台主题色。

Author: Auto (AI Assistant)
Date: 2026-02-07
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加主题颜色字段
    """
    return """
        -- ============================================
        -- 添加主题颜色字段到平台设置表
        -- ============================================
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "theme_color" VARCHAR(20) DEFAULT '#1890ff';
        
        -- 添加字段注释
        COMMENT ON COLUMN "infra_platform_settings"."theme_color" IS '主题颜色';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除主题颜色字段
    """
    return """
        -- 删除主题颜色字段
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "theme_color";
    """
