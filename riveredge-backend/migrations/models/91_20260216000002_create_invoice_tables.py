"""
创建发票库表（进项/销项统一管理）

包含：
1. apps_kuaizhizao_invoices - 发票主表
2. apps_kuaizhizao_invoice_items - 发票明细表

Author: Auto (AI Assistant)
Date: 2026-02-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建发票库表
    """
    return """
        -- 1. 发票主表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_invoices" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "invoice_code" VARCHAR(50) NOT NULL UNIQUE,
            "invoice_number" VARCHAR(50) NOT NULL,
            "invoice_details_code" VARCHAR(50),
            "category" VARCHAR(20) NOT NULL DEFAULT 'IN',
            "invoice_type" VARCHAR(50) NOT NULL DEFAULT 'VAT_SPECIAL',
            "partner_id" INT NOT NULL,
            "partner_name" VARCHAR(200) NOT NULL,
            "partner_tax_no" VARCHAR(50),
            "partner_bank_info" VARCHAR(200),
            "partner_address_phone" VARCHAR(200),
            "amount_excluding_tax" DECIMAL(14,2) NOT NULL,
            "tax_amount" DECIMAL(14,2) NOT NULL,
            "total_amount" DECIMAL(14,2) NOT NULL,
            "tax_rate" DECIMAL(6,4) NOT NULL DEFAULT 0.13,
            "invoice_date" DATE NOT NULL,
            "received_date" DATE,
            "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            "verification_date" DATE,
            "source_document_code" VARCHAR(100),
            "attachment_uuid" VARCHAR(36),
            "description" TEXT,
            "created_by" INT,
            "updated_by" INT
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_invoices_tenant_id" ON "apps_kuaizhizao_invoices" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_invoices_tenant_category_date" ON "apps_kuaizhizao_invoices" ("tenant_id", "category", "invoice_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_invoices_invoice_number" ON "apps_kuaizhizao_invoices" ("invoice_number");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_invoices_partner_id" ON "apps_kuaizhizao_invoices" ("partner_id");

        -- 2. 发票明细表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_invoice_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "invoice_id" INT NOT NULL REFERENCES "apps_kuaizhizao_invoices"("id") ON DELETE CASCADE,
            "item_name" VARCHAR(200) NOT NULL,
            "spec_model" VARCHAR(100),
            "unit" VARCHAR(20),
            "quantity" DECIMAL(12,4),
            "unit_price" DECIMAL(12,4),
            "amount" DECIMAL(14,2) NOT NULL,
            "tax_rate" DECIMAL(6,4) NOT NULL,
            "tax_amount" DECIMAL(14,2) NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_invoice_items_tenant_id" ON "apps_kuaizhizao_invoice_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_invoice_items_invoice_id" ON "apps_kuaizhizao_invoice_items" ("invoice_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除发票库表
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_invoice_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_invoices";
    """
