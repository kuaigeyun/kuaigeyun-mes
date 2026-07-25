"""MRP P2：预测冲销字段

- sales_forecast_items.consumed_quantity：已被销售订单冲销的数量
- sales_order_items.forecast_item_id：主绑定的预测明细（可空）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_forecast_items"
            ADD COLUMN IF NOT EXISTS "consumed_quantity" NUMERIC(10,2) NOT NULL DEFAULT 0;

        COMMENT ON COLUMN "apps_kuaizhizao_sales_forecast_items"."consumed_quantity"
            IS '已被销售订单冲销的数量';

        ALTER TABLE "apps_kuaizhizao_sales_order_items"
            ADD COLUMN IF NOT EXISTS "forecast_item_id" INT NULL;

        COMMENT ON COLUMN "apps_kuaizhizao_sales_order_items"."forecast_item_id"
            IS '冲销绑定的销售预测明细ID';

        CREATE INDEX IF NOT EXISTS "idx_so_item_forecast_item_id"
            ON "apps_kuaizhizao_sales_order_items" ("forecast_item_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_so_item_forecast_item_id";
        ALTER TABLE "apps_kuaizhizao_sales_order_items"
            DROP COLUMN IF EXISTS "forecast_item_id";
        ALTER TABLE "apps_kuaizhizao_sales_forecast_items"
            DROP COLUMN IF EXISTS "consumed_quantity";
    """
