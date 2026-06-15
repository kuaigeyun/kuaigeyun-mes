from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_purchase_inquiries"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_inquiries"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_receipt_notices"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_receipt_notices"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_purchase_returns"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_returns"."attachments" IS '附件列表';
    """
