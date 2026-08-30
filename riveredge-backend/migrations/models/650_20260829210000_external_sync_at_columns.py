"""主数据/销售订单：标记外部同步来源时间 external_sync_at。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS external_sync_at TIMESTAMPTZ;
        ALTER TABLE "apps_master_data_customers"
            ADD COLUMN IF NOT EXISTS external_sync_at TIMESTAMPTZ;
        ALTER TABLE "apps_kuaizhizao_sales_orders"
            ADD COLUMN IF NOT EXISTS external_sync_at TIMESTAMPTZ;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders"
            DROP COLUMN IF EXISTS external_sync_at;
        ALTER TABLE "apps_master_data_customers"
            DROP COLUMN IF EXISTS external_sync_at;
        ALTER TABLE "apps_master_data_materials"
            DROP COLUMN IF EXISTS external_sync_at;
    """
