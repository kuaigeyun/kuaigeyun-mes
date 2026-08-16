"""销售出库明细增加 sales_order_item_id，按订单行统计待出库占用。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_sales_delivery_items"
    ADD COLUMN IF NOT EXISTS "sales_order_item_id" INT;

CREATE INDEX IF NOT EXISTS "idx_sales_delivery_items_so_item"
    ON "apps_kuaizhizao_sales_delivery_items" ("sales_order_item_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_sales_delivery_items_so_item";
ALTER TABLE "apps_kuaizhizao_sales_delivery_items"
    DROP COLUMN IF EXISTS "sales_order_item_id";
"""
