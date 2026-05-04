from tortoise import BaseDBAsyncClient


PARTNER_COLS = """
        ALTER TABLE "apps_master_data_customers" ADD "tax_registration_no" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "invoice_title" VARCHAR(200);
        ALTER TABLE "apps_master_data_customers" ADD "invoice_address" TEXT;
        ALTER TABLE "apps_master_data_customers" ADD "invoice_phone" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "invoice_bank_name" VARCHAR(200);
        ALTER TABLE "apps_master_data_customers" ADD "invoice_bank_account" VARCHAR(64);
        ALTER TABLE "apps_master_data_customers" ADD "invoice_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "taxpayer_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "legal_representative" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD "enterprise_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "payment_terms_days" INT;
        ALTER TABLE "apps_master_data_customers" ADD "settlement_method_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD "finance_contact_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD "finance_contact_phone" VARCHAR(30);
        ALTER TABLE "apps_master_data_customers" ADD "finance_contact_email" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD "delivery_contact_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD "delivery_contact_phone" VARCHAR(30);
        ALTER TABLE "apps_master_data_customers" ADD "delivery_address" TEXT;
        ALTER TABLE "apps_master_data_suppliers" ADD "tax_registration_no" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "invoice_title" VARCHAR(200);
        ALTER TABLE "apps_master_data_suppliers" ADD "invoice_address" TEXT;
        ALTER TABLE "apps_master_data_suppliers" ADD "invoice_phone" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "invoice_bank_name" VARCHAR(200);
        ALTER TABLE "apps_master_data_suppliers" ADD "invoice_bank_account" VARCHAR(64);
        ALTER TABLE "apps_master_data_suppliers" ADD "invoice_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "taxpayer_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "legal_representative" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD "enterprise_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "payment_terms_days" INT;
        ALTER TABLE "apps_master_data_suppliers" ADD "settlement_method_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD "finance_contact_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD "finance_contact_phone" VARCHAR(30);
        ALTER TABLE "apps_master_data_suppliers" ADD "finance_contact_email" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD "delivery_contact_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD "delivery_contact_phone" VARCHAR(30);
        ALTER TABLE "apps_master_data_suppliers" ADD "delivery_address" TEXT;
"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    return PARTNER_COLS


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "tax_registration_no";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "invoice_title";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "invoice_address";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "invoice_phone";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "invoice_bank_name";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "invoice_bank_account";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "invoice_type_code";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "taxpayer_type_code";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "legal_representative";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "enterprise_type_code";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "payment_terms_days";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "settlement_method_code";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "finance_contact_name";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "finance_contact_phone";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "finance_contact_email";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "delivery_contact_name";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "delivery_contact_phone";
        ALTER TABLE "apps_master_data_customers" DROP COLUMN IF EXISTS "delivery_address";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "tax_registration_no";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "invoice_title";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "invoice_address";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "invoice_phone";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "invoice_bank_name";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "invoice_bank_account";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "invoice_type_code";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "taxpayer_type_code";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "legal_representative";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "enterprise_type_code";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "payment_terms_days";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "settlement_method_code";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "finance_contact_name";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "finance_contact_phone";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "finance_contact_email";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "delivery_contact_name";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "delivery_contact_phone";
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "delivery_address";
    """
