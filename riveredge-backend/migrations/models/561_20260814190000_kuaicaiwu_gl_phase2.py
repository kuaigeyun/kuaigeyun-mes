"""
总账二期：职员/项目辅助、现金流量、摊销预提、支票、凭证字扩展。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 科目辅助扩展
ALTER TABLE "apps_kuaicaiwu_chart_of_accounts"
    ADD COLUMN IF NOT EXISTS "aux_employee" BOOL NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "aux_project" BOOL NOT NULL DEFAULT FALSE;

-- 凭证分行扩展
ALTER TABLE "apps_kuaicaiwu_voucher_lines"
    ADD COLUMN IF NOT EXISTS "employee_id" INT,
    ADD COLUMN IF NOT EXISTS "employee_name" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "project_id" INT,
    ADD COLUMN IF NOT EXISTS "project_name" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "cash_flow_item_id" INT;

-- 账套参数
ALTER TABLE "apps_kuaicaiwu_gl_book_settings"
    ADD COLUMN IF NOT EXISTS "enable_voucher_words" BOOL NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS "require_transfer_before_close" BOOL NOT NULL DEFAULT FALSE;

-- 余额表辅助键扩展（先加列，再重建唯一约束）
ALTER TABLE "apps_kuaicaiwu_account_balances"
    ADD COLUMN IF NOT EXISTS "employee_id" INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "project_id" INT NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'apps_kuaicaiwu_account_balances_tenant_id_period_year_period_month_account_id_customer_id_supplier_id_department_id_key'
    ) THEN
        ALTER TABLE "apps_kuaicaiwu_account_balances"
            DROP CONSTRAINT "apps_kuaicaiwu_account_balances_tenant_id_period_year_period_month_account_id_customer_id_supplier_id_department_id_key";
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uidx_gl_account_balances_aux"
    ON "apps_kuaicaiwu_account_balances" (
        "tenant_id", "period_year", "period_month", "account_id",
        "customer_id", "supplier_id", "department_id", "employee_id", "project_id"
    );

-- 总账项目字典
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_gl_projects" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "project_code" VARCHAR(64) NOT NULL,
    "project_name" VARCHAR(200) NOT NULL,
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100)
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_gl_projects_code"
    ON "apps_kuaicaiwu_gl_projects" ("tenant_id", "project_code");

-- 现金流量项目
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_gl_cash_flow_items" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "item_code" VARCHAR(64) NOT NULL,
    "item_name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(40) NOT NULL DEFAULT 'operating',
    "direction" VARCHAR(20) NOT NULL DEFAULT 'inflow',
    "sort_order" INT NOT NULL DEFAULT 0,
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100)
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_gl_cash_flow_items_code"
    ON "apps_kuaicaiwu_gl_cash_flow_items" ("tenant_id", "item_code");

-- 摊销预提台账
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_gl_accrual_items" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "item_code" VARCHAR(64) NOT NULL,
    "item_name" VARCHAR(200) NOT NULL,
    "accrual_type" VARCHAR(20) NOT NULL DEFAULT 'accrual',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amortized_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "period_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "start_year" INT NOT NULL,
    "start_month" INT NOT NULL,
    "periods" INT NOT NULL DEFAULT 1,
    "debit_account_code" VARCHAR(32) NOT NULL,
    "credit_account_code" VARCHAR(32) NOT NULL,
    "summary" VARCHAR(500),
    "is_active" BOOL NOT NULL DEFAULT TRUE,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100)
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_gl_accrual_items_code"
    ON "apps_kuaicaiwu_gl_accrual_items" ("tenant_id", "item_code");

-- 支票轻量
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_gl_cheques" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36),
    "tenant_id" INT NOT NULL,
    "cheque_no" VARCHAR(64) NOT NULL,
    "gl_account_id" INT NOT NULL,
    "issue_date" DATE NOT NULL,
    "payee" VARCHAR(200),
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'issued',
    "cleared_date" DATE,
    "voucher_id" INT,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "created_by" INT,
    "created_by_name" VARCHAR(100),
    "updated_by" INT,
    "updated_by_name" VARCHAR(100)
);
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_gl_cheques_no"
    ON "apps_kuaicaiwu_gl_cheques" ("tenant_id", "cheque_no");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaicaiwu_gl_cheques";
DROP TABLE IF EXISTS "apps_kuaicaiwu_gl_accrual_items";
DROP TABLE IF EXISTS "apps_kuaicaiwu_gl_cash_flow_items";
DROP TABLE IF EXISTS "apps_kuaicaiwu_gl_projects";
DROP INDEX IF EXISTS "uidx_gl_account_balances_aux";
ALTER TABLE "apps_kuaicaiwu_account_balances"
    DROP COLUMN IF EXISTS "employee_id",
    DROP COLUMN IF EXISTS "project_id";
ALTER TABLE "apps_kuaicaiwu_gl_book_settings"
    DROP COLUMN IF EXISTS "enable_voucher_words",
    DROP COLUMN IF EXISTS "require_transfer_before_close";
ALTER TABLE "apps_kuaicaiwu_voucher_lines"
    DROP COLUMN IF EXISTS "employee_id",
    DROP COLUMN IF EXISTS "employee_name",
    DROP COLUMN IF EXISTS "project_id",
    DROP COLUMN IF EXISTS "project_name",
    DROP COLUMN IF EXISTS "cash_flow_item_id";
ALTER TABLE "apps_kuaicaiwu_chart_of_accounts"
    DROP COLUMN IF EXISTS "aux_employee",
    DROP COLUMN IF EXISTS "aux_project";
"""
