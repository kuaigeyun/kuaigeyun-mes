"""
Add login background image and visual layer enable flags to infra_platform_settings.

Author: Auto (AI Assistant)
Date: 2026-06-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "login_background_image" VARCHAR(500);
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "login_decoration_enabled" BOOL NOT NULL DEFAULT TRUE;
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "login_background_enabled" BOOL NOT NULL DEFAULT TRUE;

        COMMENT ON COLUMN "infra_platform_settings"."login_background_image" IS '登录页左栏背景图（URL或文件UUID）';
        COMMENT ON COLUMN "infra_platform_settings"."login_decoration_enabled" IS '是否启用登录页装饰图';
        COMMENT ON COLUMN "infra_platform_settings"."login_background_enabled" IS '是否启用登录页背景图';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_background_enabled";
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_decoration_enabled";
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_background_image";
    """
