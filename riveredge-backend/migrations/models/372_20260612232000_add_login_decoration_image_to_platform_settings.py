"""
为平台设置新增登录页装饰图字段
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "login_decoration_image" VARCHAR(500);

        COMMENT ON COLUMN "infra_platform_settings"."login_decoration_image" IS '登录页装饰图（URL或文件UUID）';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "login_decoration_image";
        """
