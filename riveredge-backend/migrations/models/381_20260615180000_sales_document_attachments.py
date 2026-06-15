from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_shipment_notices"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_sales_returns"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_returns"."attachments" IS '附件列表';
    """
