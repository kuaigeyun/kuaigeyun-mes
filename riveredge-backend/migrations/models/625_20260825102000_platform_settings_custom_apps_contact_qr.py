"""
平台设置：定制应用联系二维码显示开关

默认关闭：应用中心「定制应用」空态不展示商务咨询二维码。

Author: Auto (AI Assistant)
Date: 2026-08-25
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "custom_apps_contact_qr_enabled" BOOLEAN DEFAULT FALSE;

        COMMENT ON COLUMN "infra_platform_settings"."custom_apps_contact_qr_enabled"
        IS '是否显示应用中心定制应用空态的商务咨询二维码';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        DROP COLUMN IF EXISTS "custom_apps_contact_qr_enabled";
    """
