"""
总账一期：科目扩展、期间、余额表、参数、转账模板、银行对账。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaicaiwu_chart_of_accounts"
    ADD COLUMN IF NOT EXISTS "is_cash_journal" BOOL NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "is_bank_journal" BOOL NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "is_controlled" BOOL NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "aux_customer" BOOL NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "aux_supplier" BOOL NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "aux_department" BOOL NOT NULL DEFAULT FALSE;

ALTER TABLE "apps_kuaicaiwu_vouchers"
    ADD COLUMN IF NOT EXISTS "voucher_word" VARCHAR(10) NOT NULL DEFAULT '记',
    ADD COLUMN IF NOT EXISTS "attachment_count" INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "reviewed_by" INT;

ALTER TABLE "apps_kuaicaiwu_voucher_lines"
    ADD COLUMN IF NOT EXISTS "customer_id" INT,
    ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "supplier_id" INT,
    ADD COLUMN IF NOT EXISTS "supplier_name" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "department_id" INT,
    ADD COLUMN IF NOT EXISTS "department_name" VARCHAR(200);

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_gl_book_settings" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_code_rule" VARCHAR(32) NOT NULL DEFAULT '4-2-2-2',
    "base_currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "require_reviewer_different" BOOL NOT NULL DEFAULT TRUE,
    "deficit_control" BOOL NOT NULL DEFAULT FALSE,
    "allow_gl_entry_on_controlled" BOOL NOT NULL DEFAULT FALSE,
    "cash_account_ids" JSONB NOT NULL DEFAULT '[]',
    "bank_account_ids" JSONB NOT NULL DEFAULT '[]',
    "initialized" BOOL NOT NULL DEFAULT FALSE,
    "current_year" INT,
    "current_month" INT,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicaiwu_gl_book_settings_tenant" UNIQUE ("tenant_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_gl_book_settings_uuid"
    ON "apps_kuaicaiwu_gl_book_settings" ("uuid");

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_accounting_periods" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_year" INT NOT NULL,
    "period_month" INT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'not_open',
    "closed_at" TIMESTAMPTZ,
    "closed_by" INT,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicaiwu_acct_period" UNIQUE ("tenant_id", "period_year", "period_month")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_accounting_periods_uuid"
    ON "apps_kuaicaiwu_accounting_periods" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_acct_period_status"
    ON "apps_kuaicaiwu_accounting_periods" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_account_balances" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_year" INT NOT NULL,
    "period_month" INT NOT NULL,
    "account_id" INT NOT NULL,
    "account_code" VARCHAR(32) NOT NULL,
    "customer_id" INT NOT NULL DEFAULT 0,
    "supplier_id" INT NOT NULL DEFAULT 0,
    "department_id" INT NOT NULL DEFAULT 0,
    "opening_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "opening_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "period_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "period_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "year_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "year_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ending_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ending_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicaiwu_acct_bal" UNIQUE (
        "tenant_id", "period_year", "period_month", "account_id",
        "customer_id", "supplier_id", "department_id"
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_account_balances_uuid"
    ON "apps_kuaicaiwu_account_balances" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_acct_bal_period"
    ON "apps_kuaicaiwu_account_balances" ("tenant_id", "period_year", "period_month");

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_voucher_summaries" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" VARCHAR(500) NOT NULL,
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "sort_order" INT NOT NULL DEFAULT 0,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_voucher_summaries_uuid"
    ON "apps_kuaicaiwu_voucher_summaries" ("uuid");

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_gl_transfer_templates" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "template_code" VARCHAR(50) NOT NULL,
    "template_name" VARCHAR(200) NOT NULL,
    "template_type" VARCHAR(30) NOT NULL DEFAULT 'custom',
    "lines" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_gl_transfer_templates_uuid"
    ON "apps_kuaicaiwu_gl_transfer_templates" ("uuid");

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_bank_reconcile_items" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gl_account_id" INT NOT NULL,
    "period_year" INT NOT NULL,
    "period_month" INT NOT NULL,
    "side" VARCHAR(20) NOT NULL,
    "txn_date" DATE NOT NULL,
    "summary" VARCHAR(500),
    "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_opening" BOOL NOT NULL DEFAULT FALSE,
    "is_matched" BOOL NOT NULL DEFAULT FALSE,
    "match_group" VARCHAR(36),
    "voucher_id" INT,
    "voucher_line_id" INT,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100),
    "deleted_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_bank_reconcile_items_uuid"
    ON "apps_kuaicaiwu_bank_reconcile_items" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_bank_recon_acct"
    ON "apps_kuaicaiwu_bank_reconcile_items" ("tenant_id", "gl_account_id", "is_matched");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaicaiwu_bank_reconcile_items";
DROP TABLE IF EXISTS "apps_kuaicaiwu_gl_transfer_templates";
DROP TABLE IF EXISTS "apps_kuaicaiwu_voucher_summaries";
DROP TABLE IF EXISTS "apps_kuaicaiwu_account_balances";
DROP TABLE IF EXISTS "apps_kuaicaiwu_accounting_periods";
DROP TABLE IF EXISTS "apps_kuaicaiwu_gl_book_settings";
"""
