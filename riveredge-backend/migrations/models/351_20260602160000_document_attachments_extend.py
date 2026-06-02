from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        ALTER TABLE "apps_kuaizhizao_purchase_requisitions"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        ALTER TABLE "apps_kuaizhizao_sales_forecasts"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
    """
