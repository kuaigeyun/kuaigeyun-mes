"""平台设置：顶栏小程序码开关与图片

header_miniprogram_qr_enabled / header_miniprogram_qr_uuid
用于登录后主界面顶栏展示微信小程序码（上传的图片，非下载链接二维码）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings"
            ADD COLUMN IF NOT EXISTS "header_miniprogram_qr_enabled" BOOL NOT NULL DEFAULT FALSE;
        ALTER TABLE "infra_platform_settings"
            ADD COLUMN IF NOT EXISTS "header_miniprogram_qr_uuid" VARCHAR(64);

        COMMENT ON COLUMN "infra_platform_settings"."header_miniprogram_qr_enabled"
            IS '是否在主界面顶栏展示小程序码入口';
        COMMENT ON COLUMN "infra_platform_settings"."header_miniprogram_qr_uuid"
            IS '小程序码图片文件 UUID（category=miniprogram-qr）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "header_miniprogram_qr_enabled";
        ALTER TABLE "infra_platform_settings" DROP COLUMN IF EXISTS "header_miniprogram_qr_uuid";
    """
