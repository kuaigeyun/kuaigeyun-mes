"""
添加公开注册开关到平台设置

控制平台默认登录页是否显示「立即注册」入口。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "enable_register" BOOLEAN DEFAULT TRUE;

        COMMENT ON COLUMN "infra_platform_settings"."enable_register" IS '是否启用公开注册（登录页注册链接）';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "enable_register";
        """
