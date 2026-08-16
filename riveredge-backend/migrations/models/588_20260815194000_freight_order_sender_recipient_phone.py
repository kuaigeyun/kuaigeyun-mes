"""货运单发件人/收件人手机号（选填）"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_freight_orders"
            ADD COLUMN IF NOT EXISTS "sender_phone" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "recipient_phone" VARCHAR(50);
        COMMENT ON COLUMN "apps_kuaizhizao_freight_orders"."sender_phone" IS '发件人手机号';
        COMMENT ON COLUMN "apps_kuaizhizao_freight_orders"."recipient_phone" IS '收件人手机号';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_freight_orders"
            DROP COLUMN IF EXISTS "sender_phone",
            DROP COLUMN IF EXISTS "recipient_phone";
    """
