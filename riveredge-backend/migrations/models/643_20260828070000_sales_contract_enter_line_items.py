from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_contracts"
            ADD COLUMN IF NOT EXISTS "enter_line_items" BOOL NOT NULL DEFAULT TRUE;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_contracts"."enter_line_items"
            IS '是否录入明细：true=数量框架（须有明细），false=金额总框（无明细，手填总金额）';
        UPDATE "apps_kuaizhizao_sales_contracts"
            SET "enter_line_items" = TRUE
            WHERE "enter_line_items" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_contracts"
            DROP COLUMN IF EXISTS "enter_line_items";
    """
