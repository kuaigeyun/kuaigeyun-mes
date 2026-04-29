"""
Add login_title_en, login_content_en, and icp_license_en fields to infra_platform_settings table.

Author: Auto (AI Assistant)
Date: 2026-04-29
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" ADD COLUMN IF NOT EXISTS "login_title_en" VARCHAR(200);
        ALTER TABLE "infra_platform_settings" ADD COLUMN IF NOT EXISTS "login_content_en" TEXT;
        ALTER TABLE "infra_platform_settings" ADD COLUMN IF NOT EXISTS "icp_license_en" VARCHAR(100);
        
        COMMENT ON COLUMN "infra_platform_settings"."login_title_en" IS '登录页标题（英文）';
        COMMENT ON COLUMN "infra_platform_settings"."login_content_en" IS '登录页内容描述（英文）';
        COMMENT ON COLUMN "infra_platform_settings"."icp_license_en" IS 'ICP备案信息（英文）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_title_en";
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_content_en";
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "icp_license_en";
    """
