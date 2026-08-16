"""采购退货按采购订单行占用，销售退货按销售订单行占用。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_purchase_return_items"
    ADD COLUMN IF NOT EXISTS "purchase_order_item_id" INT;

CREATE INDEX IF NOT EXISTS "idx_purchase_return_items_po_item"
    ON "apps_kuaizhizao_purchase_return_items" ("purchase_order_item_id");

ALTER TABLE "apps_kuaizhizao_sales_return_items"
    ADD COLUMN IF NOT EXISTS "sales_order_item_id" INT;

CREATE INDEX IF NOT EXISTS "idx_sales_return_items_so_item"
    ON "apps_kuaizhizao_sales_return_items" ("sales_order_item_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_purchase_return_items_po_item";
ALTER TABLE "apps_kuaizhizao_purchase_return_items"
    DROP COLUMN IF EXISTS "purchase_order_item_id";

DROP INDEX IF EXISTS "idx_sales_return_items_so_item";
ALTER TABLE "apps_kuaizhizao_sales_return_items"
    DROP COLUMN IF EXISTS "sales_order_item_id";
"""
