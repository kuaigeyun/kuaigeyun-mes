"""客户端产品：顶栏扫码下载开关

添加 header_download_enabled，控制该客户端是否出现在登录后主界面顶栏「扫码下载客户端」中。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_client_products"
            ADD COLUMN IF NOT EXISTS "header_download_enabled" BOOL NOT NULL DEFAULT TRUE;

        COMMENT ON COLUMN "core_client_products"."header_download_enabled"
            IS '是否在主界面顶栏扫码下载中展示该客户端';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_client_products"
            DROP COLUMN IF EXISTS "header_download_enabled";
    """
