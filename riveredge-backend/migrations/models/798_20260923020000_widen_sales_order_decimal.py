"""Widen sales order quantity/price/amount decimal precision to match sales contracts.

Quantity/unit price: DECIMAL(14,4); amounts: DECIMAL(16,4).
Prevents numeric field overflow when creating large orders.
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_sales_orders"
    ALTER COLUMN "total_quantity" TYPE DECIMAL(14,4),
    ALTER COLUMN "total_amount" TYPE DECIMAL(16,4),
    ALTER COLUMN "discount_amount" TYPE DECIMAL(16,4),
    ALTER COLUMN "total_fee_amount" TYPE DECIMAL(16,4),
    ALTER COLUMN "prepayment_amount" TYPE DECIMAL(16,4);

ALTER TABLE "apps_kuaizhizao_sales_order_items"
    ALTER COLUMN "order_quantity" TYPE DECIMAL(14,4),
    ALTER COLUMN "delivered_quantity" TYPE DECIMAL(14,4),
    ALTER COLUMN "remaining_quantity" TYPE DECIMAL(14,4),
    ALTER COLUMN "unit_price" TYPE DECIMAL(14,4),
    ALTER COLUMN "total_amount" TYPE DECIMAL(16,4),
    ALTER COLUMN "provisional_unit_price" TYPE DECIMAL(14,4),
    ALTER COLUMN "gift_ref_unit_price" TYPE DECIMAL(14,4);
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_sales_order_items"
    ALTER COLUMN "order_quantity" TYPE DECIMAL(12,4),
    ALTER COLUMN "delivered_quantity" TYPE DECIMAL(12,4),
    ALTER COLUMN "remaining_quantity" TYPE DECIMAL(12,4),
    ALTER COLUMN "unit_price" TYPE DECIMAL(12,4),
    ALTER COLUMN "total_amount" TYPE DECIMAL(14,4),
    ALTER COLUMN "provisional_unit_price" TYPE DECIMAL(12,4),
    ALTER COLUMN "gift_ref_unit_price" TYPE DECIMAL(12,4);

ALTER TABLE "apps_kuaizhizao_sales_orders"
    ALTER COLUMN "total_quantity" TYPE DECIMAL(12,4),
    ALTER COLUMN "total_amount" TYPE DECIMAL(14,4),
    ALTER COLUMN "discount_amount" TYPE DECIMAL(14,4),
    ALTER COLUMN "total_fee_amount" TYPE DECIMAL(14,4),
    ALTER COLUMN "prepayment_amount" TYPE DECIMAL(14,4);
"""
