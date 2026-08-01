from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_after_sales_ticket_items"
            ADD COLUMN IF NOT EXISTS "sales_order_item_id" INT;
        ALTER TABLE "apps_kuaizhizao_after_sales_ticket_items"
            ADD COLUMN IF NOT EXISTS "sales_delivery_item_id" INT;
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_item_so_item"
            ON "apps_kuaizhizao_after_sales_ticket_items" ("sales_order_item_id");
        CREATE INDEX IF NOT EXISTS "idx_after_sales_ticket_item_sd_item"
            ON "apps_kuaizhizao_after_sales_ticket_items" ("sales_delivery_item_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_after_sales_ticket_item_so_item";
        DROP INDEX IF EXISTS "idx_after_sales_ticket_item_sd_item";
        ALTER TABLE "apps_kuaizhizao_after_sales_ticket_items"
            DROP COLUMN IF EXISTS "sales_order_item_id";
        ALTER TABLE "apps_kuaizhizao_after_sales_ticket_items"
            DROP COLUMN IF EXISTS "sales_delivery_item_id";
    """
