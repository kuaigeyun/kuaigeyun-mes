"""
设备运营扩展表：点检/巡检/保养主数据与业务单据。

并扩展 equipment_faults、maintenance_executions 字段。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- equipment_faults 扩展
        ALTER TABLE "apps_kuaizhizao_equipment_faults"
            ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(50) NULL;
        ALTER TABLE "apps_kuaizhizao_equipment_faults"
            ADD COLUMN IF NOT EXISTS "source_uuid" VARCHAR(36) NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."source_type" IS '来源类型（spot_check/route_patrol 等）';
        COMMENT ON COLUMN "apps_kuaizhizao_equipment_faults"."source_uuid" IS '来源单据 UUID';

        -- maintenance_executions 扩展
        ALTER TABLE "apps_kuaizhizao_maintenance_executions"
            ADD COLUMN IF NOT EXISTS "maintenance_scheme_id" INT NULL;
        ALTER TABLE "apps_kuaizhizao_maintenance_executions"
            ADD COLUMN IF NOT EXISTS "executed_items" JSONB NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."maintenance_scheme_id" IS '保养方案ID';
        COMMENT ON COLUMN "apps_kuaizhizao_maintenance_executions"."executed_items" IS '已执行保养项（JSON）';

        -- 点检项
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_inspection_items" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "requirement" TEXT NULL,
            "value_type" VARCHAR(32) NOT NULL DEFAULT 'boolean',
            "unit" VARCHAR(32) NULL,
            "numeric_min" DECIMAL(20,6) NULL,
            "numeric_max" DECIMAL(20,6) NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_equipment_inspection_items_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_inspection_items_tenant_id"
            ON "apps_kuaizhizao_equipment_inspection_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_inspection_items_code"
            ON "apps_kuaizhizao_equipment_inspection_items" ("code");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_inspection_items" IS '快格轻制造 - 点检项';

        -- 点检方案
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_inspection_schemes" (
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
            CONSTRAINT "uid_apps_kuaizhizao_equipment_inspection_schemes_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_inspection_schemes_tenant_id"
            ON "apps_kuaizhizao_equipment_inspection_schemes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_inspection_schemes_code"
            ON "apps_kuaizhizao_equipment_inspection_schemes" ("code");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_inspection_schemes" IS '快格轻制造 - 点检方案';

        -- 点检方案行
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_inspection_scheme_lines" (
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
            "value_type" VARCHAR(32) NULL,
            "unit" VARCHAR(32) NULL,
            "numeric_min" DECIMAL(20,6) NULL,
            "numeric_max" DECIMAL(20,6) NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_inspection_scheme_lines_tenant_id"
            ON "apps_kuaizhizao_equipment_inspection_scheme_lines" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_inspection_scheme_lines_scheme_id"
            ON "apps_kuaizhizao_equipment_inspection_scheme_lines" ("scheme_id");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_inspection_scheme_lines" IS '快格轻制造 - 点检方案行';

        -- 设备方案绑定
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_scheme_bindings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "scheme_id" INT NOT NULL,
            "scheme_type" VARCHAR(32) NOT NULL DEFAULT 'spot_check',
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_scheme_bindings_tenant_id"
            ON "apps_kuaizhizao_equipment_scheme_bindings" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_scheme_bindings_equipment_id"
            ON "apps_kuaizhizao_equipment_scheme_bindings" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_scheme_bindings_scheme_type"
            ON "apps_kuaizhizao_equipment_scheme_bindings" ("scheme_type");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_scheme_bindings" IS '快格轻制造 - 设备方案绑定';

        -- 巡检路线
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_patrol_routes" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "workshop_id" INT NULL,
            "workshop_name" VARCHAR(200) NULL,
            "description" TEXT NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_equipment_patrol_routes_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_patrol_routes_tenant_id"
            ON "apps_kuaizhizao_equipment_patrol_routes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_patrol_routes_code"
            ON "apps_kuaizhizao_equipment_patrol_routes" ("code");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_patrol_routes" IS '快格轻制造 - 巡检路线';

        -- 巡检路线步骤
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_patrol_route_steps" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "route_id" INT NOT NULL,
            "sort_order" INT NOT NULL DEFAULT 0,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_code" VARCHAR(50) NULL,
            "equipment_name" VARCHAR(200) NULL,
            "scheme_id" INT NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_patrol_route_steps_tenant_id"
            ON "apps_kuaizhizao_equipment_patrol_route_steps" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_patrol_route_steps_route_id"
            ON "apps_kuaizhizao_equipment_patrol_route_steps" ("route_id");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_patrol_route_steps" IS '快格轻制造 - 巡检路线步骤';

        -- 保养项
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_maintenance_items" (
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
            CONSTRAINT "uid_apps_kuaizhizao_equipment_maintenance_items_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_maintenance_items_tenant_id"
            ON "apps_kuaizhizao_equipment_maintenance_items" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_maintenance_items_code"
            ON "apps_kuaizhizao_equipment_maintenance_items" ("code");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_maintenance_items" IS '快格轻制造 - 保养项';

        -- 保养方案
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_maintenance_schemes" (
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
            CONSTRAINT "uid_apps_kuaizhizao_equipment_maintenance_schemes_tenant_code"
                UNIQUE ("tenant_id", "code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_maintenance_schemes_tenant_id"
            ON "apps_kuaizhizao_equipment_maintenance_schemes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_maintenance_schemes_code"
            ON "apps_kuaizhizao_equipment_maintenance_schemes" ("code");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_maintenance_schemes" IS '快格轻制造 - 保养方案';

        -- 保养方案行
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_maintenance_scheme_lines" (
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
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_maintenance_scheme_lines_tenant_id"
            ON "apps_kuaizhizao_equipment_maintenance_scheme_lines" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_maintenance_scheme_lines_scheme_id"
            ON "apps_kuaizhizao_equipment_maintenance_scheme_lines" ("scheme_id");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_maintenance_scheme_lines" IS '快格轻制造 - 保养方案行';

        -- 设备点检单
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_spot_checks" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_code" VARCHAR(50) NULL,
            "equipment_name" VARCHAR(200) NULL,
            "scheme_id" INT NULL,
            "check_date" DATE NOT NULL,
            "inspector_id" INT NULL,
            "inspector_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '已完成',
            "has_abnormality" BOOLEAN NOT NULL DEFAULT FALSE,
            "abnormality_description" TEXT NULL,
            "fault_report_uuid" VARCHAR(36) NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_equipment_spot_checks_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_spot_checks_tenant_id"
            ON "apps_kuaizhizao_equipment_spot_checks" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_spot_checks_equipment_id"
            ON "apps_kuaizhizao_equipment_spot_checks" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_spot_checks_status"
            ON "apps_kuaizhizao_equipment_spot_checks" ("status");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_spot_checks" IS '快格轻制造 - 设备点检单';

        -- 设备点检单行
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_spot_check_lines" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "spot_check_id" INT NOT NULL,
            "line_no" INT NOT NULL DEFAULT 1,
            "item_id" INT NULL,
            "item_code" VARCHAR(64) NULL,
            "item_name" VARCHAR(200) NULL,
            "requirement" TEXT NULL,
            "value_type" VARCHAR(32) NULL,
            "unit" VARCHAR(32) NULL,
            "measured_value" TEXT NULL,
            "is_pass" BOOLEAN NOT NULL DEFAULT TRUE,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_spot_check_lines_tenant_id"
            ON "apps_kuaizhizao_equipment_spot_check_lines" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_spot_check_lines_spot_check_id"
            ON "apps_kuaizhizao_equipment_spot_check_lines" ("spot_check_id");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_spot_check_lines" IS '快格轻制造 - 设备点检单行';

        -- 设备巡检单
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_route_patrols" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "document_no" VARCHAR(64) NOT NULL,
            "route_id" INT NOT NULL,
            "route_code" VARCHAR(64) NULL,
            "route_name" VARCHAR(200) NULL,
            "patrol_date" DATE NOT NULL,
            "inspector_id" INT NULL,
            "inspector_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '已完成',
            "has_abnormality" BOOLEAN NOT NULL DEFAULT FALSE,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_equipment_route_patrols_tenant_document_no"
                UNIQUE ("tenant_id", "document_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_route_patrols_tenant_id"
            ON "apps_kuaizhizao_equipment_route_patrols" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_route_patrols_route_id"
            ON "apps_kuaizhizao_equipment_route_patrols" ("route_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_route_patrols_status"
            ON "apps_kuaizhizao_equipment_route_patrols" ("status");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_route_patrols" IS '快格轻制造 - 设备巡检单';

        -- 设备巡检单行
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_route_patrol_lines" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "route_patrol_id" INT NOT NULL,
            "step_no" INT NOT NULL DEFAULT 1,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_code" VARCHAR(50) NULL,
            "equipment_name" VARCHAR(200) NULL,
            "item_id" INT NULL,
            "item_code" VARCHAR(64) NULL,
            "item_name" VARCHAR(200) NULL,
            "measured_value" TEXT NULL,
            "is_pass" BOOLEAN NOT NULL DEFAULT TRUE,
            "fault_report_uuid" VARCHAR(36) NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_route_patrol_lines_tenant_id"
            ON "apps_kuaizhizao_equipment_route_patrol_lines" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_route_patrol_lines_route_patrol_id"
            ON "apps_kuaizhizao_equipment_route_patrol_lines" ("route_patrol_id");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_route_patrol_lines" IS '快格轻制造 - 设备巡检单行';

        -- 设备报废申请
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_scrap_applications" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "application_no" VARCHAR(64) NOT NULL,
            "equipment_id" INT NOT NULL,
            "equipment_uuid" VARCHAR(36) NOT NULL,
            "equipment_code" VARCHAR(50) NULL,
            "equipment_name" VARCHAR(200) NULL,
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
            CONSTRAINT "uid_apps_kuaizhizao_equipment_scrap_applications_tenant_application_no"
                UNIQUE ("tenant_id", "application_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_scrap_applications_tenant_id"
            ON "apps_kuaizhizao_equipment_scrap_applications" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_scrap_applications_equipment_id"
            ON "apps_kuaizhizao_equipment_scrap_applications" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_scrap_applications_status"
            ON "apps_kuaizhizao_equipment_scrap_applications" ("status");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_scrap_applications" IS '快格轻制造 - 设备报废申请';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_scrap_applications";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_route_patrol_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_route_patrols";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_spot_check_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_spot_checks";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_maintenance_scheme_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_maintenance_schemes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_maintenance_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_patrol_route_steps";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_patrol_routes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_scheme_bindings";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_inspection_scheme_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_inspection_schemes";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_inspection_items";

        ALTER TABLE "apps_kuaizhizao_maintenance_executions"
            DROP COLUMN IF EXISTS "executed_items";
        ALTER TABLE "apps_kuaizhizao_maintenance_executions"
            DROP COLUMN IF EXISTS "maintenance_scheme_id";

        ALTER TABLE "apps_kuaizhizao_equipment_faults"
            DROP COLUMN IF EXISTS "source_uuid";
        ALTER TABLE "apps_kuaizhizao_equipment_faults"
            DROP COLUMN IF EXISTS "source_type";
    """
