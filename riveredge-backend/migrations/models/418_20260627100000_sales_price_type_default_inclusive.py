"""
销售模块价类默认改为含税（仅改列 DEFAULT，不回写历史数据）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations"
            ALTER COLUMN "price_type" SET DEFAULT 'tax_inclusive';

        ALTER TABLE "apps_kuaizhizao_sales_orders"
            ALTER COLUMN "price_type" SET DEFAULT 'tax_inclusive';

        ALTER TABLE "apps_kuaizhizao_sales_contracts"
            ALTER COLUMN "price_type" SET DEFAULT 'tax_inclusive';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_quotations"
            ALTER COLUMN "price_type" SET DEFAULT 'tax_exclusive';

        ALTER TABLE "apps_kuaizhizao_sales_orders"
            ALTER COLUMN "price_type" SET DEFAULT 'tax_exclusive';

        ALTER TABLE "apps_kuaizhizao_sales_contracts"
            ALTER COLUMN "price_type" SET DEFAULT 'tax_exclusive';
    """
