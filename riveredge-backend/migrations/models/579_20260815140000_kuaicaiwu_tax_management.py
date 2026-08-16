"""
快财务税务管理：税务设置、属期记录、发票税务字段

Author: Auto
Date: 2026-08-15
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_gl_tax_settings" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "taxpayer_type" VARCHAR(20) NOT NULL DEFAULT 'general',
            "tax_rates" JSONB NOT NULL DEFAULT '[]',
            "surcharge_rates" JSONB NOT NULL DEFAULT '{}',
            "account_bindings" JSONB NOT NULL DEFAULT '{}',
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaicaiwu_gl_tax_settings_tenant" UNIQUE ("tenant_id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_gl_tax_settings_uuid"
            ON "apps_kuaicaiwu_gl_tax_settings" ("uuid");

        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_tax_period_records" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "period_year" INT NOT NULL,
            "period_month" INT NOT NULL,
            "locked" BOOL NOT NULL DEFAULT FALSE,
            "locked_at" TIMESTAMPTZ,
            "locked_by" INT,
            "vat_transfer_voucher_id" INT,
            "surcharge_voucher_id" INT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaicaiwu_tax_period_tenant_ym" UNIQUE ("tenant_id", "period_year", "period_month")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_tax_period_records_uuid"
            ON "apps_kuaicaiwu_tax_period_records" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_tax_period_tenant"
            ON "apps_kuaicaiwu_tax_period_records" ("tenant_id", "period_year", "period_month");

        ALTER TABLE "apps_kuaicaiwu_invoices"
            ADD COLUMN IF NOT EXISTS "tax_period" VARCHAR(7),
            ADD COLUMN IF NOT EXISTS "invoice_color" VARCHAR(10) DEFAULT 'blue';

        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_invoices_tax_period"
            ON "apps_kuaicaiwu_invoices" ("tenant_id", "tax_period", "category");

        ALTER TABLE "apps_kuaicaiwu_purchase_invoices"
            ADD COLUMN IF NOT EXISTS "tax_period" VARCHAR(7),
            ADD COLUMN IF NOT EXISTS "verification_status" VARCHAR(32) DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS "verification_date" DATE,
            ADD COLUMN IF NOT EXISTS "transfer_out_reason" TEXT,
            ADD COLUMN IF NOT EXISTS "original_invoice_id" INT,
            ADD COLUMN IF NOT EXISTS "red_flush_invoice_id" INT;

        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_purchase_inv_verification"
            ON "apps_kuaicaiwu_purchase_invoices" ("tenant_id", "verification_status", "verification_date");
        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_purchase_inv_tax_period"
            ON "apps_kuaicaiwu_purchase_invoices" ("tenant_id", "tax_period");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_purchase_invoices"
            DROP COLUMN IF EXISTS "red_flush_invoice_id",
            DROP COLUMN IF EXISTS "original_invoice_id",
            DROP COLUMN IF EXISTS "transfer_out_reason",
            DROP COLUMN IF EXISTS "verification_date",
            DROP COLUMN IF EXISTS "verification_status",
            DROP COLUMN IF EXISTS "tax_period";
        DROP INDEX IF EXISTS "idx_kuaicaiwu_purchase_inv_tax_period";
        DROP INDEX IF EXISTS "idx_kuaicaiwu_purchase_inv_verification";

        ALTER TABLE "apps_kuaicaiwu_invoices"
            DROP COLUMN IF EXISTS "invoice_color",
            DROP COLUMN IF EXISTS "tax_period";
        DROP INDEX IF EXISTS "idx_kuaicaiwu_invoices_tax_period";

        DROP TABLE IF EXISTS "apps_kuaicaiwu_tax_period_records";
        DROP TABLE IF EXISTS "apps_kuaicaiwu_gl_tax_settings";
    """
