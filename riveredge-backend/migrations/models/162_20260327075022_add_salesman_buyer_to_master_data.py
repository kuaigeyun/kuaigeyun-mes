from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" ADD "salesman_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD "salesman_id" INT;
        ALTER TABLE "apps_master_data_suppliers" ADD "buyer_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD "buyer_id" INT;
        ALTER TABLE "apps_kuaizhizao_purchase_orders" ADD "buyer_name" VARCHAR(100);
        ALTER TABLE "apps_kuaizhizao_purchase_orders" ADD "buyer_id" INT;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" DROP COLUMN "salesman_name";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN "salesman_id";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN "buyer_name";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN "buyer_id";
        ALTER TABLE "apps_kuaizhizao_purchase_orders" DROP COLUMN "buyer_name";
        ALTER TABLE "apps_kuaizhizao_purchase_orders" DROP COLUMN "buyer_id";"""
