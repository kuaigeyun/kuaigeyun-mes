"""
付款申请单头行表
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_payment_applications" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "application_code" VARCHAR(50) NOT NULL,
            "supplier_id" INT NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "application_kind" VARCHAR(20) NOT NULL DEFAULT 'goods',
            "application_date" DATE,
            "expected_payment_date" DATE,
            "applicant_id" INT,
            "applicant_name" VARCHAR(100),
            "total_request_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "paid_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "remaining_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "review_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_remarks" TEXT,
            "supplier_account_name" VARCHAR(200),
            "supplier_bank_name" VARCHAR(200),
            "supplier_bank_account" VARCHAR(64),
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
        CREATE INDEX IF NOT EXISTS "idx_payment_app_tenant_code"
            ON "apps_kuaizhizao_payment_applications" ("tenant_id", "application_code");
        CREATE INDEX IF NOT EXISTS "idx_payment_app_tenant_supplier"
            ON "apps_kuaizhizao_payment_applications" ("tenant_id", "supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_payment_app_tenant_status"
            ON "apps_kuaizhizao_payment_applications" ("tenant_id", "status");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_payment_application_lines" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "application_id" INT NOT NULL REFERENCES "apps_kuaizhizao_payment_applications" ("id") ON DELETE CASCADE,
            "line_no" INT NOT NULL DEFAULT 1,
            "source_type" VARCHAR(50) NOT NULL,
            "source_id" INT,
            "source_code" VARCHAR(50),
            "payable_id" INT,
            "payable_code" VARCHAR(50),
            "line_kind" VARCHAR(20) NOT NULL DEFAULT 'goods',
            "request_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "paid_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "max_request_amount" DECIMAL(16,4) NOT NULL DEFAULT 0,
            "notes" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_payment_app_line_app"
            ON "apps_kuaizhizao_payment_application_lines" ("tenant_id", "application_id");
        CREATE INDEX IF NOT EXISTS "idx_payment_app_line_payable"
            ON "apps_kuaizhizao_payment_application_lines" ("tenant_id", "payable_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_payment_application_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_payment_applications";
    """
