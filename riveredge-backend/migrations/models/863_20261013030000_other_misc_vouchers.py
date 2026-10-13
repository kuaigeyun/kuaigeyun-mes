"""其他收支类别与其他费用收入/支出单据"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_misc_income_categories" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "default_gl_account_code" VARCHAR(20),
            "sort_order" INT NOT NULL DEFAULT 0,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_misc_income_cat_tenant_code"
            ON "apps_kuaicaiwu_misc_income_categories" ("tenant_id", "code");

        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_misc_expense_categories" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "default_gl_account_code" VARCHAR(20),
            "sort_order" INT NOT NULL DEFAULT 0,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_misc_expense_cat_tenant_code"
            ON "apps_kuaicaiwu_misc_expense_categories" ("tenant_id", "code");

        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_other_incomes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "income_code" VARCHAR(50) NOT NULL,
            "business_date" DATE NOT NULL,
            "counterparty_kind" VARCHAR(20) NOT NULL DEFAULT 'none',
            "counterparty_id" INT,
            "counterparty_name" VARCHAR(200),
            "total_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "payment_method" VARCHAR(50) NOT NULL,
            "bank_account_id" INT,
            "bank_account" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "department_id" INT,
            "department_name" VARCHAR(200),
            "project_id" INT,
            "project_name" VARCHAR(200),
            "notes" TEXT,
            "attachments" JSONB,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_other_income_tenant_code"
            ON "apps_kuaicaiwu_other_incomes" ("tenant_id", "income_code");
        CREATE INDEX IF NOT EXISTS "idx_other_income_tenant_status"
            ON "apps_kuaicaiwu_other_incomes" ("tenant_id", "status");

        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_other_income_lines" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "other_income_id" INT NOT NULL REFERENCES "apps_kuaicaiwu_other_incomes" ("id") ON DELETE CASCADE,
            "line_no" INT NOT NULL DEFAULT 1,
            "category_code" VARCHAR(50) NOT NULL,
            "category_name" VARCHAR(200) NOT NULL,
            "amount" DECIMAL(16,4) NOT NULL,
            "description" TEXT,
            "gl_account_code" VARCHAR(20)
        );
        CREATE INDEX IF NOT EXISTS "idx_other_income_line_head"
            ON "apps_kuaicaiwu_other_income_lines" ("tenant_id", "other_income_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_other_expenses" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "expense_code" VARCHAR(50) NOT NULL,
            "business_date" DATE NOT NULL,
            "counterparty_kind" VARCHAR(20) NOT NULL DEFAULT 'none',
            "counterparty_id" INT,
            "counterparty_name" VARCHAR(200),
            "total_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "payment_method" VARCHAR(50) NOT NULL,
            "bank_account_id" INT,
            "bank_account" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "department_id" INT,
            "department_name" VARCHAR(200),
            "project_id" INT,
            "project_name" VARCHAR(200),
            "notes" TEXT,
            "attachments" JSONB,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_other_expense_tenant_code"
            ON "apps_kuaicaiwu_other_expenses" ("tenant_id", "expense_code");
        CREATE INDEX IF NOT EXISTS "idx_other_expense_tenant_status"
            ON "apps_kuaicaiwu_other_expenses" ("tenant_id", "status");

        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_other_expense_lines" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" UUID NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "other_expense_id" INT NOT NULL REFERENCES "apps_kuaicaiwu_other_expenses" ("id") ON DELETE CASCADE,
            "line_no" INT NOT NULL DEFAULT 1,
            "category_code" VARCHAR(50) NOT NULL,
            "category_name" VARCHAR(200) NOT NULL,
            "amount" DECIMAL(16,4) NOT NULL,
            "description" TEXT,
            "gl_account_code" VARCHAR(20)
        );
        CREATE INDEX IF NOT EXISTS "idx_other_expense_line_head"
            ON "apps_kuaicaiwu_other_expense_lines" ("tenant_id", "other_expense_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaicaiwu_other_expense_lines";
        DROP TABLE IF EXISTS "apps_kuaicaiwu_other_expenses";
        DROP TABLE IF EXISTS "apps_kuaicaiwu_other_income_lines";
        DROP TABLE IF EXISTS "apps_kuaicaiwu_other_incomes";
        DROP TABLE IF EXISTS "apps_kuaicaiwu_misc_expense_categories";
        DROP TABLE IF EXISTS "apps_kuaicaiwu_misc_income_categories";
    """
