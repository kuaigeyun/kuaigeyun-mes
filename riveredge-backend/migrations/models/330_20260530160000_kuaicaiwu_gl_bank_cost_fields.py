"""
快财务 Phase 3-4：银行账户、总账科目/凭证、预收预付 settlement_type、出库/入库 unit_cost。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_bank_accounts" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_code" VARCHAR(50) NOT NULL,
    "account_name" VARCHAR(200) NOT NULL,
    "bank_name" VARCHAR(200) NOT NULL,
    "account_number" VARCHAR(64) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_bank_accounts_uuid"
    ON "apps_kuaicaiwu_bank_accounts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_bank_accounts_tenant_code"
    ON "apps_kuaicaiwu_bank_accounts" ("tenant_id", "account_code");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_bank_accounts_tenant_active"
    ON "apps_kuaicaiwu_bank_accounts" ("tenant_id", "is_active");
COMMENT ON TABLE "apps_kuaicaiwu_bank_accounts" IS '管理会计 - 银行账户';

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_chart_of_accounts" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_code" VARCHAR(32) NOT NULL,
    "account_name" VARCHAR(200) NOT NULL,
    "account_type" VARCHAR(20) NOT NULL,
    "parent_id" INT,
    "level" INT NOT NULL DEFAULT 1,
    "is_leaf" BOOL NOT NULL DEFAULT TRUE,
    "balance_direction" VARCHAR(10) NOT NULL DEFAULT 'debit',
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uid_apps_kuaicaiwu_coa_tenant_code" UNIQUE ("tenant_id", "account_code")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_chart_of_accounts_uuid"
    ON "apps_kuaicaiwu_chart_of_accounts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_coa_tenant_type"
    ON "apps_kuaicaiwu_chart_of_accounts" ("tenant_id", "account_type");
COMMENT ON TABLE "apps_kuaicaiwu_chart_of_accounts" IS '管理会计 - 会计科目';

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_vouchers" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voucher_code" VARCHAR(50) NOT NULL,
    "voucher_date" DATE NOT NULL,
    "period_year" INT NOT NULL,
    "period_month" INT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "summary" VARCHAR(500),
    "source_event_id" INT,
    "source_doc_type" VARCHAR(50),
    "source_doc_id" INT,
    "total_debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMPTZ,
    "posted_by" INT,
    "created_by" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uq_apps_kuaicaiwu_vouchers_voucher_code" UNIQUE ("voucher_code")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_vouchers_uuid"
    ON "apps_kuaicaiwu_vouchers" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_vouchers_tenant_date"
    ON "apps_kuaicaiwu_vouchers" ("tenant_id", "voucher_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_vouchers_tenant_status"
    ON "apps_kuaicaiwu_vouchers" ("tenant_id", "status");
COMMENT ON TABLE "apps_kuaicaiwu_vouchers" IS '管理会计 - 记账凭证';

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_voucher_lines" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voucher_id" INT NOT NULL,
    "line_no" INT NOT NULL,
    "account_id" INT NOT NULL,
    "account_code" VARCHAR(32) NOT NULL,
    "account_name" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500),
    "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "partner_id" INT,
    "partner_name" VARCHAR(200)
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_voucher_lines_uuid"
    ON "apps_kuaicaiwu_voucher_lines" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_voucher_lines_voucher"
    ON "apps_kuaicaiwu_voucher_lines" ("tenant_id", "voucher_id");
COMMENT ON TABLE "apps_kuaicaiwu_voucher_lines" IS '管理会计 - 凭证分录';

ALTER TABLE "apps_kuaicaiwu_receipts"
    ADD COLUMN IF NOT EXISTS "settlement_type" VARCHAR(20) NOT NULL DEFAULT 'normal';
ALTER TABLE "apps_kuaicaiwu_payments"
    ADD COLUMN IF NOT EXISTS "settlement_type" VARCHAR(20) NOT NULL DEFAULT 'normal';

ALTER TABLE "apps_kuaizhizao_sales_delivery_items"
    ADD COLUMN IF NOT EXISTS "unit_cost" DECIMAL(12,2);
ALTER TABLE "apps_kuaizhizao_finished_goods_receipt_items"
    ADD COLUMN IF NOT EXISTS "unit_cost" DECIMAL(12,2);
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_finished_goods_receipt_items" DROP COLUMN IF EXISTS "unit_cost";
ALTER TABLE "apps_kuaizhizao_sales_delivery_items" DROP COLUMN IF EXISTS "unit_cost";
ALTER TABLE "apps_kuaicaiwu_payments" DROP COLUMN IF EXISTS "settlement_type";
ALTER TABLE "apps_kuaicaiwu_receipts" DROP COLUMN IF EXISTS "settlement_type";
DROP TABLE IF EXISTS "apps_kuaicaiwu_voucher_lines";
DROP TABLE IF EXISTS "apps_kuaicaiwu_vouchers";
DROP TABLE IF EXISTS "apps_kuaicaiwu_chart_of_accounts";
DROP TABLE IF EXISTS "apps_kuaicaiwu_bank_accounts";
"""
