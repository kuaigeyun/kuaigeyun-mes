"""
模具运营扩展表：保养/维修主数据与业务单据。

并扩展 molds 表字段，迁移 status 正常→待用。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_molds"
            ADD COLUMN IF NOT EXISTS "storage_location" VARCHAR(200) NULL;
        ALTER TABLE "apps_kuaizhizao_molds"
            ADD COLUMN IF NOT EXISTS "maintenance_scheme_id" INT NULL;
        ALTER TABLE "apps_kuaizhizao_molds"
            ADD COLUMN IF NOT EXISTS "repair_scheme_id" INT NULL;
        ALTER TABLE "apps_kuaizhizao_molds"
            ADD COLUMN IF NOT EXISTS "last_maintenance_date" DATE NULL;
        ALTER TABLE "apps_kuaizhizao_molds"
            ADD COLUMN IF NOT EXISTS "allow_repeated_borrow" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_molds"
            ALTER COLUMN "status" SET DEFAULT '待启用';
        UPDATE "apps_kuaizhizao_molds" SET "status" = '待用' WHERE "status" = '正常';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_maintenance_items" (
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
            CONSTRAINT "uid_apps_kuaizhizao_mold_maintenance_items_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_maintenance_items_tenant_id"
            ON "apps_kuaizhizao_mold_maintenance_items" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_maintenance_schemes" (
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
            CONSTRAINT "uid_apps_kuaizhizao_mold_maintenance_schemes_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_maintenance_schemes_tenant_id"
            ON "apps_kuaizhizao_mold_maintenance_schemes" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_maintenance_scheme_lines" (
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
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_maintenance_scheme_lines_scheme_id"
            ON "apps_kuaizhizao_mold_maintenance_scheme_lines" ("scheme_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_repair_items" (
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
            CONSTRAINT "uid_apps_kuaizhizao_mold_repair_items_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_repair_items_tenant_id"
            ON "apps_kuaizhizao_mold_repair_items" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_repair_schemes" (
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
            CONSTRAINT "uid_apps_kuaizhizao_mold_repair_schemes_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_repair_schemes_tenant_id"
            ON "apps_kuaizhizao_mold_repair_schemes" ("tenant_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_repair_scheme_lines" (
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
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_repair_scheme_lines_scheme_id"
            ON "apps_kuaizhizao_mold_repair_scheme_lines" ("scheme_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_scheme_bindings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "mold_id" INT NOT NULL,
            "mold_uuid" VARCHAR(36) NOT NULL,
            "scheme_id" INT NOT NULL,
            "scheme_type" VARCHAR(32) NOT NULL DEFAULT 'maintenance',
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_scheme_bindings_mold_id"
            ON "apps_kuaizhizao_mold_scheme_bindings" ("mold_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_trials" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "mold_id" INT NOT NULL,
            "mold_uuid" VARCHAR(36) NOT NULL,
            "mold_code" VARCHAR(50) NULL,
            "mold_name" VARCHAR(200) NULL,
            "trial_date" DATE NOT NULL,
            "trial_result" VARCHAR(50) NULL,
            "operator_id" INT NULL,
            "operator_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '进行中',
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_mold_trials_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_trials_mold_id"
            ON "apps_kuaizhizao_mold_trials" ("mold_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_borrows" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "mold_id" INT NOT NULL,
            "mold_uuid" VARCHAR(36) NOT NULL,
            "mold_code" VARCHAR(50) NULL,
            "mold_name" VARCHAR(200) NULL,
            "borrow_date" TIMESTAMPTZ NOT NULL,
            "borrower_id" INT NULL,
            "borrower_name" VARCHAR(100) NULL,
            "department_name" VARCHAR(200) NULL,
            "expected_return_date" DATE NULL,
            "source_type" VARCHAR(50) NULL,
            "source_id" INT NULL,
            "source_no" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '领用中',
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_mold_borrows_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_borrows_mold_id"
            ON "apps_kuaizhizao_mold_borrows" ("mold_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_returns" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "mold_id" INT NOT NULL,
            "mold_uuid" VARCHAR(36) NOT NULL,
            "mold_code" VARCHAR(50) NULL,
            "mold_name" VARCHAR(200) NULL,
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
            CONSTRAINT "uid_apps_kuaizhizao_mold_returns_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_returns_mold_id"
            ON "apps_kuaizhizao_mold_returns" ("mold_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_returns_reporting_record_id"
            ON "apps_kuaizhizao_mold_returns" ("reporting_record_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_maintenances" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "mold_id" INT NOT NULL,
            "mold_uuid" VARCHAR(36) NOT NULL,
            "mold_code" VARCHAR(50) NULL,
            "mold_name" VARCHAR(200) NULL,
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
            CONSTRAINT "uid_apps_kuaizhizao_mold_maintenances_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_maintenances_mold_id"
            ON "apps_kuaizhizao_mold_maintenances" ("mold_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_maintenance_lines" (
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
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_maintenance_lines_maintenance_id"
            ON "apps_kuaizhizao_mold_maintenance_lines" ("maintenance_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_repairs" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "mold_id" INT NOT NULL,
            "mold_uuid" VARCHAR(36) NOT NULL,
            "mold_code" VARCHAR(50) NULL,
            "mold_name" VARCHAR(200) NULL,
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
            CONSTRAINT "uid_apps_kuaizhizao_mold_repairs_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_repairs_mold_id"
            ON "apps_kuaizhizao_mold_repairs" ("mold_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_mold_repair_lines" (
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
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_repair_lines_repair_id"
            ON "apps_kuaizhizao_mold_repair_lines" ("repair_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_repair_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_repairs";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_maintenance_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_maintenances";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_returns";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_borrows";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_trials";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_scheme_bindings";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_repair_scheme_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_repair_schemes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_repair_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_maintenance_scheme_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_maintenance_schemes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_mold_maintenance_items";
        ALTER TABLE "apps_kuaizhizao_molds" DROP COLUMN IF EXISTS "allow_repeated_borrow";
        ALTER TABLE "apps_kuaizhizao_molds" DROP COLUMN IF EXISTS "last_maintenance_date";
        ALTER TABLE "apps_kuaizhizao_molds" DROP COLUMN IF EXISTS "repair_scheme_id";
        ALTER TABLE "apps_kuaizhizao_molds" DROP COLUMN IF EXISTS "maintenance_scheme_id";
        ALTER TABLE "apps_kuaizhizao_molds" DROP COLUMN IF EXISTS "storage_location";
    """
