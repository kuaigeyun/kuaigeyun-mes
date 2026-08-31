"""平台设置增加官方接口库域名。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "official_api_library_host" VARCHAR(200);

        COMMENT ON COLUMN "infra_platform_settings"."official_api_library_host"
        IS '官方接口库域名，默认 kuaigeyun.com';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        DROP COLUMN IF EXISTS "official_api_library_host";
    """
