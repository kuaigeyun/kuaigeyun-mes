"""Widen stocktaking/transfer quantity decimal columns to DECIMAL(18,4).

Aligns DB with inventory book quantity and core.utils.decimal_limits standard.
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_stocktaking_items"
    ALTER COLUMN "book_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "actual_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "difference_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "unit_price" TYPE DECIMAL(18,4),
    ALTER COLUMN "difference_amount" TYPE DECIMAL(18,4);

ALTER TABLE "apps_kuaizhizao_stocktakings"
    ALTER COLUMN "total_difference_amount" TYPE DECIMAL(18,4);

ALTER TABLE "apps_kuaizhizao_inventory_transfer_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "unit_price" TYPE DECIMAL(18,4),
    ALTER COLUMN "amount" TYPE DECIMAL(18,4);

ALTER TABLE "apps_kuaizhizao_inventory_transfers"
    ALTER COLUMN "total_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "total_amount" TYPE DECIMAL(18,4);

ALTER TABLE "apps_kuaizhizao_sales_orders"
    ALTER COLUMN "total_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "total_amount" TYPE DECIMAL(18,4),
    ALTER COLUMN "discount_amount" TYPE DECIMAL(18,4),
    ALTER COLUMN "total_fee_amount" TYPE DECIMAL(18,4),
    ALTER COLUMN "prepayment_amount" TYPE DECIMAL(18,4);

ALTER TABLE "apps_kuaizhizao_sales_order_items"
    ALTER COLUMN "order_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "delivered_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "remaining_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "unit_price" TYPE DECIMAL(18,4),
    ALTER COLUMN "total_amount" TYPE DECIMAL(18,4),
    ALTER COLUMN "provisional_unit_price" TYPE DECIMAL(18,4),
    ALTER COLUMN "gift_ref_unit_price" TYPE DECIMAL(18,4);
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_inventory_transfers"
    ALTER COLUMN "total_quantity" TYPE DECIMAL(14,4),
    ALTER COLUMN "total_amount" TYPE DECIMAL(14,4);

ALTER TABLE "apps_kuaizhizao_inventory_transfer_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(12,2),
    ALTER COLUMN "unit_price" TYPE DECIMAL(12,2),
    ALTER COLUMN "amount" TYPE DECIMAL(12,2);

ALTER TABLE "apps_kuaizhizao_stocktakings"
    ALTER COLUMN "total_difference_amount" TYPE DECIMAL(14,4);

ALTER TABLE "apps_kuaizhizao_stocktaking_items"
    ALTER COLUMN "book_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "actual_quantity" TYPE DECIMAL(12,2),
    ALTER COLUMN "difference_quantity" TYPE DECIMAL(18,4),
    ALTER COLUMN "unit_price" TYPE DECIMAL(18,4),
    ALTER COLUMN "difference_amount" TYPE DECIMAL(18,4);
"""
