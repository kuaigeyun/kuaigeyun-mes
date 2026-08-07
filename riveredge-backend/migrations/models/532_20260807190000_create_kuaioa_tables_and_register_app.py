"""
创建轻办公 (kuaioa) 相关表并为各租户注册应用记录。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaioa_form_templates" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "template_code" VARCHAR(50) NOT NULL,
            "template_name" VARCHAR(200) NOT NULL,
            "category" VARCHAR(50) NOT NULL DEFAULT 'general',
            "description" TEXT,
            "fields_schema" JSONB NOT NULL DEFAULT '[]',
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_form_tpl_code"
            ON "apps_kuaioa_form_templates" ("tenant_id", "template_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_form_requests" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "request_code" VARCHAR(50) NOT NULL,
            "template_id" INT,
            "template_code" VARCHAR(50),
            "title" VARCHAR(200) NOT NULL,
            "form_data" JSONB NOT NULL DEFAULT '{}',
            "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
            "applicant_id" INT,
            "applicant_name" VARCHAR(100),
            "department_name" VARCHAR(100),
            "notes" TEXT,
            "submitted_at" TIMESTAMPTZ,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_form_req_code"
            ON "apps_kuaioa_form_requests" ("tenant_id", "request_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_training_plans" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "plan_code" VARCHAR(50) NOT NULL,
            "plan_name" VARCHAR(200) NOT NULL,
            "plan_type" VARCHAR(50) NOT NULL DEFAULT 'quality',
            "department_name" VARCHAR(100),
            "planned_start_date" DATE,
            "planned_end_date" DATE,
            "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
            "description" TEXT,
            "reminder_days" INT NOT NULL DEFAULT 7,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_training_plan_code"
            ON "apps_kuaioa_training_plans" ("tenant_id", "plan_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_training_records" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "record_code" VARCHAR(50) NOT NULL,
            "plan_id" INT,
            "training_name" VARCHAR(200) NOT NULL,
            "trainee_id" INT,
            "trainee_name" VARCHAR(100),
            "trainer_name" VARCHAR(100),
            "training_date" DATE,
            "theory_score" NUMERIC(8,2),
            "practice_score" NUMERIC(8,2),
            "is_passed" BOOLEAN NOT NULL DEFAULT FALSE,
            "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_training_record_code"
            ON "apps_kuaioa_training_records" ("tenant_id", "record_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_work_licenses" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "license_code" VARCHAR(50) NOT NULL,
            "license_name" VARCHAR(200) NOT NULL,
            "license_type" VARCHAR(50) NOT NULL DEFAULT 'work',
            "holder_id" INT,
            "holder_name" VARCHAR(100),
            "department_name" VARCHAR(100),
            "issue_date" DATE,
            "expiry_date" DATE,
            "status" VARCHAR(30) NOT NULL DEFAULT 'active',
            "reminder_days" INT NOT NULL DEFAULT 30,
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_work_license_code"
            ON "apps_kuaioa_work_licenses" ("tenant_id", "license_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_licenses" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "license_code" VARCHAR(50) NOT NULL,
            "license_name" VARCHAR(200) NOT NULL,
            "license_type" VARCHAR(50) NOT NULL DEFAULT 'business',
            "issuing_authority" VARCHAR(200),
            "holder_name" VARCHAR(100),
            "issue_date" DATE,
            "expiry_date" DATE,
            "status" VARCHAR(30) NOT NULL DEFAULT 'valid',
            "reminder_days" INT NOT NULL DEFAULT 30,
            "file_uuid" VARCHAR(36),
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_license_code"
            ON "apps_kuaioa_licenses" ("tenant_id", "license_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_asset_purchases" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "purchase_code" VARCHAR(50) NOT NULL,
            "title" VARCHAR(200) NOT NULL,
            "asset_category" VARCHAR(50),
            "quantity" INT NOT NULL DEFAULT 1,
            "estimated_amount" NUMERIC(18,2),
            "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
            "applicant_id" INT,
            "applicant_name" VARCHAR(100),
            "department_name" VARCHAR(100),
            "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
            "purpose" TEXT,
            "submitted_at" TIMESTAMPTZ,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_asset_purchase_code"
            ON "apps_kuaioa_asset_purchases" ("tenant_id", "purchase_code")
            WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "apps_kuaioa_assets" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "asset_code" VARCHAR(50) NOT NULL,
            "asset_name" VARCHAR(200) NOT NULL,
            "asset_category" VARCHAR(50),
            "purchase_id" INT,
            "purchase_amount" NUMERIC(18,2),
            "purchase_date" DATE,
            "custodian_id" INT,
            "custodian_name" VARCHAR(100),
            "department_name" VARCHAR(100),
            "location" VARCHAR(200),
            "status" VARCHAR(30) NOT NULL DEFAULT 'in_stock',
            "notes" TEXT,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaioa_asset_code"
            ON "apps_kuaioa_assets" ("tenant_id", "asset_code")
            WHERE "deleted_at" IS NULL;

        INSERT INTO core_applications (
            uuid, tenant_id, code, name, description, version,
            entry_point, route_path, sort_order,
            is_system, is_active, is_installed,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            t.id,
            'kuaioa',
            '轻办公',
            '制造业行政协同与审批办公平台',
            '1.0.0',
            '../apps/kuaioa/index.tsx',
            '/apps/kuaioa',
            145,
            FALSE, TRUE, TRUE,
            NOW(), NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_applications
            WHERE code = 'kuaioa' AND tenant_id = t.id AND deleted_at IS NULL
        );

        UPDATE core_applications
        SET sort_order = 145,
            name = '轻办公',
            description = '制造业行政协同与审批办公平台',
            entry_point = '../apps/kuaioa/index.tsx',
            route_path = '/apps/kuaioa',
            is_installed = TRUE,
            is_active = TRUE,
            updated_at = NOW()
        WHERE code = 'kuaioa' AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaioa_assets" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaioa_asset_purchases" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaioa_licenses" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaioa_work_licenses" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaioa_training_records" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaioa_training_plans" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaioa_form_requests" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaioa_form_templates" CASCADE;
        DELETE FROM core_applications
        WHERE code = 'kuaioa' AND is_installed = TRUE AND deleted_at IS NULL;
    """
