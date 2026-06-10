"""客户端产品极光推送配置。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_client_products"
            ADD COLUMN IF NOT EXISTS "push_enabled" BOOL NOT NULL DEFAULT TRUE;
        ALTER TABLE "core_client_products"
            ADD COLUMN IF NOT EXISTS "jpush_app_key" VARCHAR(128);
        ALTER TABLE "core_client_products"
            ADD COLUMN IF NOT EXISTS "jpush_master_secret" VARCHAR(256);

        COMMENT ON COLUMN "core_client_products"."push_enabled" IS '是否启用极光推送（Android 系统通知）';
        COMMENT ON COLUMN "core_client_products"."jpush_app_key" IS '极光 AppKey（与移动端打包一致）';
        COMMENT ON COLUMN "core_client_products"."jpush_master_secret" IS '极光 Master Secret（仅服务端推送）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_client_products" DROP COLUMN IF EXISTS "jpush_master_secret";
        ALTER TABLE "core_client_products" DROP COLUMN IF EXISTS "jpush_app_key";
        ALTER TABLE "core_client_products" DROP COLUMN IF EXISTS "push_enabled";
    """
