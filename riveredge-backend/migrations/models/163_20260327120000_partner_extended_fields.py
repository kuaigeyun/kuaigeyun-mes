from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" ADD "contact_title" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD "industry_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "customer_level_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "estimated_annual_purchase" DECIMAL(18,2);
        ALTER TABLE "apps_master_data_customers" ADD "lead_source_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "credit_limit" DECIMAL(18,2);
        ALTER TABLE "apps_master_data_suppliers" ADD "contact_title" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD "industry_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "supplier_level_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "estimated_annual_purchase" DECIMAL(18,2);
        ALTER TABLE "apps_master_data_suppliers" ADD "source_channel_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "credit_limit" DECIMAL(18,2);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" DROP COLUMN "contact_title";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN "industry_code";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN "customer_level_code";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN "estimated_annual_purchase";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN "lead_source_code";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN "credit_limit";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN "contact_title";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN "industry_code";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN "supplier_level_code";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN "estimated_annual_purchase";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN "source_channel_code";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN "credit_limit";"""
