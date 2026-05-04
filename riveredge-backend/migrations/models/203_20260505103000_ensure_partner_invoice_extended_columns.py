"""
补齐客户/供应商「开票与扩展字段」列（与 202 一致，使用 IF NOT EXISTS）。

适用场景：迁移 202 未执行、中断或手工库与模型不一致导致 Tortoise 查询报 column does not exist。

Author: Auto
Date: 2026-05-05
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_UPGRADE = """
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "tax_registration_no" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "invoice_title" VARCHAR(200);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "invoice_address" TEXT;
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "invoice_phone" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "invoice_bank_name" VARCHAR(200);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "invoice_bank_account" VARCHAR(64);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "invoice_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "taxpayer_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "legal_representative" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "enterprise_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "payment_terms_days" INT;
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "settlement_method_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "finance_contact_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "finance_contact_phone" VARCHAR(30);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "finance_contact_email" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "delivery_contact_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "delivery_contact_phone" VARCHAR(30);
        ALTER TABLE "apps_master_data_customers" ADD COLUMN IF NOT EXISTS "delivery_address" TEXT;
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "tax_registration_no" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "invoice_title" VARCHAR(200);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "invoice_address" TEXT;
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "invoice_phone" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "invoice_bank_name" VARCHAR(200);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "invoice_bank_account" VARCHAR(64);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "invoice_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "taxpayer_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "legal_representative" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "enterprise_type_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "payment_terms_days" INT;
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "settlement_method_code" VARCHAR(50);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "finance_contact_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "finance_contact_phone" VARCHAR(30);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "finance_contact_email" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "delivery_contact_name" VARCHAR(100);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "delivery_contact_phone" VARCHAR(30);
        ALTER TABLE "apps_master_data_suppliers" ADD COLUMN IF NOT EXISTS "delivery_address" TEXT;
"""


async def upgrade(db: BaseDBAsyncClient) -> str:
    return _UPGRADE


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 列生命周期由 202 及业务迁移管理；本文件仅为幂等补齐
    return ""
