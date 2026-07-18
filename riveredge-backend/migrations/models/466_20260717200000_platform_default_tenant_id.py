"""
平台设置增加 default_tenant_id：私有单体部署时作为默认登录/企微扫码组织。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
        ADD COLUMN IF NOT EXISTS "default_tenant_id" INT;

        COMMENT ON COLUMN "infra_platform_settings"."default_tenant_id"
        IS '平台默认登录租户 ID（私有单体部署可跳过选组织）';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "default_tenant_id";
        """
