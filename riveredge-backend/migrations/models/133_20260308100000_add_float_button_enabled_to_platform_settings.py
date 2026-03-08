"""
添加悬浮按钮开关字段到平台设置

为平台设置表添加 float_button_enabled 字段，用于控制右下角悬浮按钮（迭代提示、意见反馈）的显示。

Author: Auto (AI Assistant)
Date: 2026-03-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加悬浮按钮开关字段
    """
    return """
        -- ============================================
        -- 添加悬浮按钮开关字段到平台设置表
        -- ============================================
        ALTER TABLE "infra_platform_settings" 
        ADD COLUMN IF NOT EXISTS "float_button_enabled" BOOLEAN DEFAULT TRUE;
        
        COMMENT ON COLUMN "infra_platform_settings"."float_button_enabled" IS '是否显示右下角悬浮按钮：包含系统迭代提示与意见反馈入口';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除悬浮按钮开关字段
    """
    return """
        ALTER TABLE "infra_platform_settings" 
        DROP COLUMN IF EXISTS "float_button_enabled";
    """
