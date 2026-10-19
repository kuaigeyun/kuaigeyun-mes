"""轻办公费用报销单表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaioa_expense_requests" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "request_code" VARCHAR(50) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "company_name" VARCHAR(200) NOT NULL,
            "expense_type" VARCHAR(50) NOT NULL,
            "payee" VARCHAR(100) NOT NULL,
            "total_amount" NUMERIC(20,6) NOT NULL DEFAULT 0,
            "lines" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "attachment_uuids" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
            "applicant_id" INT,
            "applicant_name" VARCHAR(100),
            "department_name" VARCHAR(100),
            "notes" TEXT,
            "submitted_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_expense_req_code"
            ON "apps_kuaioa_expense_requests" ("tenant_id", "request_code")
            WHERE "deleted_at" IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_kuaioa_expense_req_status"
            ON "apps_kuaioa_expense_requests" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_kuaioa_expense_req_applicant"
            ON "apps_kuaioa_expense_requests" ("tenant_id", "applicant_id");
        COMMENT ON TABLE "apps_kuaioa_expense_requests" IS '轻办公 - 费用报销单';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaioa_expense_requests";
    """
