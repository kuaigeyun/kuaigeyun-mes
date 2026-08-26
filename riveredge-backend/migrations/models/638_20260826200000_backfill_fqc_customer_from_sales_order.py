"""成品检验单：从关联销售订单回填客户名称（工单无客户快照字段）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_finished_goods_inspections" AS f
        SET
            "customer_id" = so."customer_id",
            "customer_name" = so."customer_name"
        FROM "apps_kuaizhizao_sales_orders" AS so
        WHERE f."sales_order_id" = so."id"
          AND f."tenant_id" = so."tenant_id"
          AND f."deleted_at" IS NULL
          AND so."deleted_at" IS NULL
          AND f."sales_order_id" IS NOT NULL
          AND (f."customer_name" IS NULL OR TRIM(f."customer_name") = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: FQC customer backfill is irreversible"
