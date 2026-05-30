"""
OQC 出货检验：补充销售订单/客户维度，供出库门禁匹配
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_oqc_inspections"
            ADD COLUMN IF NOT EXISTS "sales_order_id" INT,
            ADD COLUMN IF NOT EXISTS "sales_order_code" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "customer_id" INT,
            ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(200);
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_oqc_inspections_sales_order_id"
            ON "apps_kuaizhizao_oqc_inspections" ("sales_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_oqc_inspections_customer_id"
            ON "apps_kuaizhizao_oqc_inspections" ("customer_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_oqc_inspections_customer_id";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_oqc_inspections_sales_order_id";
        ALTER TABLE "apps_kuaizhizao_oqc_inspections"
            DROP COLUMN IF EXISTS "customer_name",
            DROP COLUMN IF EXISTS "customer_id",
            DROP COLUMN IF EXISTS "sales_order_code",
            DROP COLUMN IF EXISTS "sales_order_id";
    """
