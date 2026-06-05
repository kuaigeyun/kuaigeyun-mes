"""
添加登录页可见性开关到平台设置

控制登录页：免注册体验登录、Windows 工位机下载、Android PDA 下载。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "login_guest_enabled" BOOLEAN DEFAULT TRUE;
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "login_client_win_enabled" BOOLEAN DEFAULT TRUE;
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "login_client_android_enabled" BOOLEAN DEFAULT TRUE;

        COMMENT ON COLUMN "infra_platform_settings"."login_guest_enabled" IS '登录页是否显示免注册体验登录';
        COMMENT ON COLUMN "infra_platform_settings"."login_client_win_enabled" IS '登录页是否显示 Windows 工位机安装包下载';
        COMMENT ON COLUMN "infra_platform_settings"."login_client_android_enabled" IS '登录页是否显示 Android PDA 安装包下载';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_client_android_enabled";
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_client_win_enabled";
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_guest_enabled";
        """
