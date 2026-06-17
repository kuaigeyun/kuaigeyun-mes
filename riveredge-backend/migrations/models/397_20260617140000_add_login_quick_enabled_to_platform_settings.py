"""
添加登录页快捷登录开关到平台设置

控制登录页是否显示微信、QQ、企业微信、钉钉、飞书等快捷登录入口。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "login_quick_enabled" BOOLEAN DEFAULT TRUE;

        COMMENT ON COLUMN "infra_platform_settings"."login_quick_enabled" IS '登录页是否显示快捷登录（社交账号登录）';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_quick_enabled";
        """
