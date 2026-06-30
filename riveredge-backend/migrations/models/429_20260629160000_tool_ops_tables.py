"""
工装运营扩展表：保养/维修主数据与业务单据。

并扩展 tools 表字段，迁移 status 与历史领用/维保/校验记录。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """

        ALTER TABLE "apps_kuaizhizao_tools"
            ADD COLUMN IF NOT EXISTS "storage_location" VARCHAR(200) NULL;
        ALTER TABLE "apps_kuaizhizao_tools"
            ADD COLUMN IF NOT EXISTS "maintenance_scheme_id" INT NULL;
        ALTER TABLE "apps_kuaizhizao_tools"
            ADD COLUMN IF NOT EXISTS "repair_scheme_id" INT NULL;
        ALTER TABLE "apps_kuaizhizao_tools"
            ADD COLUMN IF NOT EXISTS "last_maintenance_date" DATE NULL;
        ALTER TABLE "apps_kuaizhizao_tools"
            ADD COLUMN IF NOT EXISTS "allow_repeated_borrow" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_tools"
            ALTER COLUMN "status" SET DEFAULT '待启用';
        UPDATE "apps_kuaizhizao_tools" SET "status" = '待用' WHERE "status" = '正常';
        UPDATE "apps_kuaizhizao_tools" SET "status" = '在用' WHERE "status" = '领用中';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_maintenance_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "requirement" TEXT NULL,
            "standard_hours" DECIMAL(10,2) NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_maintenance_items_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_maintenance_items_tenant_id"
            ON "apps_kuaizhizao_tool_maintenance_items" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_maintenance_schemes" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT NULL,
            "trigger_type" VARCHAR(32) NOT NULL DEFAULT 'usage_count',
            "trigger_interval_days" INT NULL,
            "trigger_interval_usage" INT NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_maintenance_schemes_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_maintenance_schemes_tenant_id"
            ON "apps_kuaizhizao_tool_maintenance_schemes" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_maintenance_scheme_lines" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "scheme_id" INT NOT NULL,
            "item_id" INT NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "item_code" VARCHAR(64) NULL,
            "item_name" VARCHAR(200) NULL,
            "requirement" TEXT NULL,
            "standard_hours" DECIMAL(10,2) NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_maintenance_scheme_lines_scheme_id"
            ON "apps_kuaizhizao_tool_maintenance_scheme_lines" ("scheme_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_repair_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "requirement" TEXT NULL,
            "standard_hours" DECIMAL(10,2) NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_repair_items_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_repair_items_tenant_id"
            ON "apps_kuaizhizao_tool_repair_items" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_repair_schemes" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_repair_schemes_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_repair_schemes_tenant_id"
            ON "apps_kuaizhizao_tool_repair_schemes" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_repair_scheme_lines" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "scheme_id" INT NOT NULL,
            "item_id" INT NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "item_code" VARCHAR(64) NULL,
            "item_name" VARCHAR(200) NULL,
            "requirement" TEXT NULL,
            "standard_hours" DECIMAL(10,2) NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_repair_scheme_lines_scheme_id"
            ON "apps_kuaizhizao_tool_repair_scheme_lines" ("scheme_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_scheme_bindings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "scheme_id" INT NOT NULL,
            "scheme_type" VARCHAR(32) NOT NULL DEFAULT 'maintenance',
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_scheme_bindings_tool_id"
            ON "apps_kuaizhizao_tool_scheme_bindings" ("tool_id");



        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_ops_calibrations" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "tool_code" VARCHAR(50) NULL,
            "tool_name" VARCHAR(200) NULL,
            "calibration_date" DATE NOT NULL,
            "calibration_org" VARCHAR(200) NULL,
            "certificate_no" VARCHAR(100) NULL,
            "result" VARCHAR(50) NOT NULL,
            "expiry_date" DATE NULL,
            "operator_id" INT NULL,
            "operator_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '进行中',
            "attachment_uuid" VARCHAR(36) NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_ops_calibrations_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_ops_calibrations_tool_id"
            ON "apps_kuaizhizao_tool_ops_calibrations" ("tool_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_borrows" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "tool_code" VARCHAR(50) NULL,
            "tool_name" VARCHAR(200) NULL,
            "borrow_date" TIMESTAMPTZ NOT NULL,
            "borrower_id" INT NULL,
            "borrower_name" VARCHAR(100) NULL,
            "department_name" VARCHAR(200) NULL,
            "expected_return_date" DATE NULL,
            "source_type" VARCHAR(50) NULL,
            "source_id" INT NULL,
            "source_no" VARCHAR(100) NULL,
            "legacy_usage_no" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '领用中',
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_borrows_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_borrows_tool_id"
            ON "apps_kuaizhizao_tool_borrows" ("tool_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_returns" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "tool_code" VARCHAR(50) NULL,
            "tool_name" VARCHAR(200) NULL,
            "borrow_id" INT NULL,
            "return_date" TIMESTAMPTZ NOT NULL,
            "usage_count" INT NOT NULL DEFAULT 1,
            "operator_id" INT NULL,
            "operator_name" VARCHAR(100) NULL,
            "source_type" VARCHAR(50) NULL,
            "source_id" INT NULL,
            "source_no" VARCHAR(100) NULL,
            "reporting_record_id" INT NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '已完成',
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_returns_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_returns_tool_id"
            ON "apps_kuaizhizao_tool_returns" ("tool_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_returns_reporting_record_id"
            ON "apps_kuaizhizao_tool_returns" ("reporting_record_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_ops_maintenances" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "tool_code" VARCHAR(50) NULL,
            "tool_name" VARCHAR(200) NULL,
            "scheme_id" INT NULL,
            "planned_date" DATE NULL,
            "maintenance_date" DATE NULL,
            "applicant_id" INT NULL,
            "applicant_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '草稿',
            "approver_id" INT NULL,
            "approver_name" VARCHAR(100) NULL,
            "approved_at" TIMESTAMPTZ NULL,
            "reject_reason" TEXT NULL,
            "completed_at" TIMESTAMPTZ NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_ops_maintenances_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_ops_maintenances_tool_id"
            ON "apps_kuaizhizao_tool_ops_maintenances" ("tool_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_ops_maintenance_lines" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "maintenance_id" INT NOT NULL,
            "line_no" INT NOT NULL DEFAULT 1,
            "item_id" INT NULL,
            "item_code" VARCHAR(64) NULL,
            "item_name" VARCHAR(200) NULL,
            "requirement" TEXT NULL,
            "standard_hours" DECIMAL(10,2) NULL,
            "is_done" BOOLEAN NOT NULL DEFAULT FALSE,
            "result_value" TEXT NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_ops_maintenance_lines_maintenance_id"
            ON "apps_kuaizhizao_tool_ops_maintenance_lines" ("maintenance_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_ops_repairs" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "tool_code" VARCHAR(50) NULL,
            "tool_name" VARCHAR(200) NULL,
            "scheme_id" INT NULL,
            "fault_description" TEXT NULL,
            "planned_date" DATE NULL,
            "repair_date" DATE NULL,
            "applicant_id" INT NULL,
            "applicant_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '草稿',
            "approver_id" INT NULL,
            "approver_name" VARCHAR(100) NULL,
            "approved_at" TIMESTAMPTZ NULL,
            "reject_reason" TEXT NULL,
            "completed_at" TIMESTAMPTZ NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_ops_repairs_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_ops_repairs_tool_id"
            ON "apps_kuaizhizao_tool_ops_repairs" ("tool_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_ops_repair_lines" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "repair_id" INT NOT NULL,
            "line_no" INT NOT NULL DEFAULT 1,
            "item_id" INT NULL,
            "item_code" VARCHAR(64) NULL,
            "item_name" VARCHAR(200) NULL,
            "requirement" TEXT NULL,
            "standard_hours" DECIMAL(10,2) NULL,
            "is_done" BOOLEAN NOT NULL DEFAULT FALSE,
            "result_value" TEXT NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_ops_repair_lines_repair_id"
            ON "apps_kuaizhizao_tool_ops_repair_lines" ("repair_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_tool_ops_scrap_applications" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "application_no" VARCHAR(64) NOT NULL,
            "tool_id" INT NOT NULL,
            "tool_uuid" VARCHAR(36) NOT NULL,
            "tool_code" VARCHAR(50) NULL,
            "tool_name" VARCHAR(200) NULL,
            "reason" TEXT NOT NULL,
            "scrap_date" DATE NULL,
            "applicant_id" INT NULL,
            "applicant_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '草稿',
            "approver_id" INT NULL,
            "approver_name" VARCHAR(100) NULL,
            "approved_at" TIMESTAMPTZ NULL,
            "reject_reason" TEXT NULL,
            "attachments" JSONB NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_tool_ops_scrap_applications_tenant_application_no"
                UNIQUE ("tenant_id", "application_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_tool_ops_scrap_applications_tool_id"
            ON "apps_kuaizhizao_tool_ops_scrap_applications" ("tool_id");


        INSERT INTO "apps_kuaizhizao_tool_borrows" (
            "uuid", "tenant_id", "created_at", "updated_at", "document_no",
            "tool_id", "tool_uuid", "tool_code", "tool_name",
            "borrow_date", "borrower_id", "borrower_name", "department_name",
            "source_type", "source_no", "legacy_usage_no", "status", "remark", "deleted_at"
        )
        SELECT
            u."uuid", u."tenant_id", u."created_at", u."updated_at",
            COALESCE(u."usage_no", 'LEGACY-' || u."id"::text),
            u."tool_id", u."tool_uuid", t."code", t."name",
            u."checkout_date", u."operator_id", u."operator_name", u."department_name",
            u."source_type", u."source_no", u."usage_no",
            CASE WHEN u."status" = '使用中' THEN '领用中' ELSE '已归还' END,
            u."remark", u."deleted_at"
        FROM "apps_kuaizhizao_tool_usages" u
        LEFT JOIN "apps_kuaizhizao_tools" t ON t."id" = u."tool_id"
        WHERE NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_tool_borrows" b
            WHERE b."tenant_id" = u."tenant_id" AND b."legacy_usage_no" IS NOT DISTINCT FROM u."usage_no"
        );

        INSERT INTO "apps_kuaizhizao_tool_returns" (
            "uuid", "tenant_id", "created_at", "updated_at", "document_no",
            "tool_id", "tool_uuid", "tool_code", "tool_name", "borrow_id",
            "return_date", "usage_count", "operator_id", "operator_name",
            "status", "remark", "deleted_at"
        )
        SELECT
            gen_random_uuid()::text, u."tenant_id", COALESCE(u."checkin_date", u."updated_at"), u."updated_at",
            COALESCE(u."usage_no", 'LEGACY-R-' || u."id"::text) || '-R',
            u."tool_id", u."tool_uuid", t."code", t."name", b."id",
            COALESCE(u."checkin_date", u."updated_at"), 1, u."operator_id", u."operator_name",
            '已完成', u."remark", u."deleted_at"
        FROM "apps_kuaizhizao_tool_usages" u
        LEFT JOIN "apps_kuaizhizao_tools" t ON t."id" = u."tool_id"
        LEFT JOIN "apps_kuaizhizao_tool_borrows" b
            ON b."tenant_id" = u."tenant_id" AND b."legacy_usage_no" IS NOT DISTINCT FROM u."usage_no"
        WHERE u."status" = '已归还' AND u."checkin_date" IS NOT NULL;

        INSERT INTO "apps_kuaizhizao_tool_ops_maintenances" (
            "uuid", "tenant_id", "created_at", "updated_at", "document_no",
            "tool_id", "tool_uuid", "tool_code", "tool_name",
            "maintenance_date", "status", "remark", "deleted_at"
        )
        SELECT
            m."uuid", m."tenant_id", m."created_at", m."updated_at",
            'LEGACY-MM-' || m."id"::text,
            m."tool_id", m."tool_uuid", t."code", t."name",
            m."maintenance_date", '已完成',
            COALESCE(m."content", '') || CASE WHEN m."executor" IS NOT NULL THEN ' 执行人:' || m."executor" ELSE '' END,
            m."deleted_at"
        FROM "apps_kuaizhizao_tool_maintenances" m
        LEFT JOIN "apps_kuaizhizao_tools" t ON t."id" = m."tool_id"
        WHERE NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_tool_ops_maintenances" om
            WHERE om."document_no" = 'LEGACY-MM-' || m."id"::text
        );

        INSERT INTO "apps_kuaizhizao_tool_ops_calibrations" (
            "uuid", "tenant_id", "created_at", "updated_at", "document_no",
            "tool_id", "tool_uuid", "tool_code", "tool_name",
            "calibration_date", "calibration_org", "certificate_no", "result",
            "expiry_date", "status", "attachment_uuid", "remark", "deleted_at"
        )
        SELECT
            c."uuid", c."tenant_id", c."created_at", c."updated_at",
            'LEGACY-TC-' || c."id"::text,
            c."tool_id", c."tool_uuid", t."code", t."name",
            c."calibration_date", c."calibration_org", c."certificate_no", c."result",
            c."expiry_date", '已完成', c."attachment_uuid", c."remark", c."deleted_at"
        FROM "apps_kuaizhizao_tool_calibrations" c
        LEFT JOIN "apps_kuaizhizao_tools" t ON t."id" = c."tool_id"
        WHERE NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_tool_ops_calibrations" oc
            WHERE oc."document_no" = 'LEGACY-TC-' || c."id"::text
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_ops_scrap_applications";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_ops_calibrations";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_ops_repair_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_ops_repairs";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_ops_maintenance_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_ops_maintenances";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_returns";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_borrows";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_scheme_bindings";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_repair_scheme_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_repair_schemes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_repair_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_maintenance_scheme_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_maintenance_schemes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_tool_maintenance_items";
        ALTER TABLE "apps_kuaizhizao_tools" DROP COLUMN IF EXISTS "allow_repeated_borrow";
        ALTER TABLE "apps_kuaizhizao_tools" DROP COLUMN IF EXISTS "last_maintenance_date";
        ALTER TABLE "apps_kuaizhizao_tools" DROP COLUMN IF EXISTS "repair_scheme_id";
        ALTER TABLE "apps_kuaizhizao_tools" DROP COLUMN IF EXISTS "maintenance_scheme_id";
        ALTER TABLE "apps_kuaizhizao_tools" DROP COLUMN IF EXISTS "storage_location";
    """
