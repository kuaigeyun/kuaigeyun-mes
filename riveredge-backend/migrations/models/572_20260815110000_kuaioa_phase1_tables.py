"""轻办公一期扩展表：请假、公告、用章、制造协同。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaioa_leave_requests" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "request_code" VARCHAR(50) NOT NULL,
            "leave_type" VARCHAR(30) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "start_at" TIMESTAMPTZ NOT NULL,
            "end_at" TIMESTAMPTZ NOT NULL,
            "days" NUMERIC(8,2),
            "destination" VARCHAR(200),
            "reason" TEXT,
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
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_leave_req_code"
            ON "apps_kuaioa_leave_requests" ("tenant_id", "request_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_announcements" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "announcement_code" VARCHAR(50) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "content" TEXT NOT NULL,
            "scope_type" VARCHAR(30) NOT NULL DEFAULT 'all',
            "scope_department" VARCHAR(100),
            "is_pinned" BOOLEAN NOT NULL DEFAULT FALSE,
            "effective_at" TIMESTAMPTZ,
            "expires_at" TIMESTAMPTZ,
            "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
            "publisher_id" INT,
            "publisher_name" VARCHAR(100),
            "published_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_announcement_code"
            ON "apps_kuaioa_announcements" ("tenant_id", "announcement_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_seal_requests" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "request_code" VARCHAR(50) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "seal_type" VARCHAR(30) NOT NULL,
            "document_name" VARCHAR(200) NOT NULL,
            "copies" INT NOT NULL DEFAULT 1,
            "take_out" BOOLEAN NOT NULL DEFAULT FALSE,
            "source_app" VARCHAR(50),
            "source_entity_type" VARCHAR(50),
            "source_entity_id" INT,
            "source_doc_no" VARCHAR(100),
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
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_seal_req_code"
            ON "apps_kuaioa_seal_requests" ("tenant_id", "request_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_special_price_requests" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "request_code" VARCHAR(50) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "customer_name" VARCHAR(200),
            "material_code" VARCHAR(100),
            "material_name" VARCHAR(200),
            "current_price" NUMERIC(18,4),
            "requested_price" NUMERIC(18,4),
            "quantity" NUMERIC(18,4),
            "valid_until" DATE,
            "reason" TEXT,
            "source_app" VARCHAR(50),
            "source_entity_type" VARCHAR(50),
            "source_entity_id" INT,
            "source_doc_no" VARCHAR(100),
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
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_special_price_code"
            ON "apps_kuaioa_special_price_requests" ("tenant_id", "request_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_concession_requests" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "request_code" VARCHAR(50) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "source_app" VARCHAR(50),
            "source_entity_type" VARCHAR(50),
            "source_entity_id" INT,
            "source_doc_no" VARCHAR(100),
            "material_code" VARCHAR(100),
            "material_name" VARCHAR(200),
            "concession_qty" NUMERIC(18,4),
            "defect_description" TEXT,
            "notify_customer" BOOLEAN NOT NULL DEFAULT FALSE,
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
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_concession_code"
            ON "apps_kuaioa_concession_requests" ("tenant_id", "request_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_process_deviations" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "request_code" VARCHAR(50) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "source_app" VARCHAR(50),
            "source_entity_type" VARCHAR(50),
            "source_entity_id" INT,
            "source_doc_no" VARCHAR(100),
            "operation_name" VARCHAR(200),
            "deviation_description" TEXT,
            "start_at" TIMESTAMPTZ,
            "end_at" TIMESTAMPTZ,
            "risk_assessment" TEXT,
            "temporary_measure" TEXT,
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
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_process_deviation_code"
            ON "apps_kuaioa_process_deviations" ("tenant_id", "request_code")
            WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaioa_process_deviations";
        DROP TABLE IF EXISTS "apps_kuaioa_concession_requests";
        DROP TABLE IF EXISTS "apps_kuaioa_special_price_requests";
        DROP TABLE IF EXISTS "apps_kuaioa_seal_requests";
        DROP TABLE IF EXISTS "apps_kuaioa_announcements";
        DROP TABLE IF EXISTS "apps_kuaioa_leave_requests";
    """
