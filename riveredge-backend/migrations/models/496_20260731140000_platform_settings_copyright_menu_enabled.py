"""
添加版权声明菜单开关字段到平台设置

为平台设置表添加 copyright_menu_enabled 字段，用于控制顶栏用户菜单中「版权声明」项的显示。

Author: Auto (AI Assistant)
Date: 2026-07-31
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加版权声明菜单开关字段
    """
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "copyright_menu_enabled" BOOLEAN DEFAULT TRUE;

        COMMENT ON COLUMN "infra_platform_settings"."copyright_menu_enabled" IS '是否显示顶栏用户菜单中的版权声明入口';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除版权声明菜单开关字段
    """
    return """
        ALTER TABLE "infra_platform_settings"
        DROP COLUMN IF EXISTS "copyright_menu_enabled";
    """
