"""
质量管理 1期：8D / OQC / SPC
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quality_8d_reports" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "report_code" VARCHAR(50) NOT NULL,
            "quality_exception_id" INT,
            "title" VARCHAR(200) NOT NULL,
            "status" VARCHAR(30) NOT NULL DEFAULT 'd1_team',
            "severity" VARCHAR(20) NOT NULL DEFAULT 'major',
            "owner_id" INT,
            "owner_name" VARCHAR(100),
            "due_date" TIMESTAMPTZ,
            "closed_at" TIMESTAMPTZ,
            "d1_team" TEXT,
            "d2_problem" TEXT,
            "d3_containment" TEXT,
            "d4_root_cause" TEXT,
            "d5_corrective_action" TEXT,
            "d6_implement_result" TEXT,
            "d7_prevent_recurrence" TEXT,
            "d8_team_congratulation" TEXT,
            "verification_result" TEXT,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizhizao_quality_8d_reports_tenant_report_code" UNIQUE ("tenant_id", "report_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quality_8d_reports_tenant_id" ON "apps_kuaizhizao_quality_8d_reports" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quality_8d_reports_report_code" ON "apps_kuaizhizao_quality_8d_reports" ("report_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quality_8d_reports_quality_exception_id" ON "apps_kuaizhizao_quality_8d_reports" ("quality_exception_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quality_8d_reports_status" ON "apps_kuaizhizao_quality_8d_reports" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quality_8d_reports_owner_id" ON "apps_kuaizhizao_quality_8d_reports" ("owner_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_quality_8d_reports_due_date" ON "apps_kuaizhizao_quality_8d_reports" ("due_date");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_oqc_inspections" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "inspection_code" VARCHAR(50) NOT NULL,
            "source_type" VARCHAR(20) NOT NULL DEFAULT 'shipment_notice',
            "source_id" INT NOT NULL,
            "source_code" VARCHAR(50) NOT NULL,
            "shipment_notice_id" INT,
            "shipment_notice_code" VARCHAR(50),
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "batch_number" VARCHAR(50),
            "inspection_quantity" DECIMAL(12,2) NOT NULL,
            "qualified_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "unqualified_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "inspection_result" VARCHAR(20) NOT NULL DEFAULT '待检验',
            "quality_status" VARCHAR(20) NOT NULL DEFAULT '合格',
            "release_decision" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "release_note" TEXT,
            "inspector_id" INT,
            "inspector_name" VARCHAR(100),
            "inspection_time" TIMESTAMPTZ,
            "reviewer_id" INT,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "status" VARCHAR(20) NOT NULL DEFAULT '待检验',
            "notes" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizhizao_oqc_inspections_tenant_inspection_code" UNIQUE ("tenant_id", "inspection_code")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_oqc_inspections_tenant_id" ON "apps_kuaizhizao_oqc_inspections" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_oqc_inspections_inspection_code" ON "apps_kuaizhizao_oqc_inspections" ("inspection_code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_oqc_inspections_source" ON "apps_kuaizhizao_oqc_inspections" ("source_type", "source_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_oqc_inspections_material_id" ON "apps_kuaizhizao_oqc_inspections" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_oqc_inspections_status" ON "apps_kuaizhizao_oqc_inspections" ("status");

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_spc_samples" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "chart_type" VARCHAR(20) NOT NULL DEFAULT 'imr',
            "characteristic_name" VARCHAR(100) NOT NULL,
            "sample_time" TIMESTAMPTZ NOT NULL,
            "sample_value" DECIMAL(18,6) NOT NULL,
            "sample_size" INT NOT NULL DEFAULT 1,
            "sample_group" VARCHAR(50),
            "source_type" VARCHAR(30),
            "source_id" INT,
            "source_code" VARCHAR(50),
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spc_samples_tenant_id" ON "apps_kuaizhizao_spc_samples" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spc_samples_characteristic_name" ON "apps_kuaizhizao_spc_samples" ("characteristic_name");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spc_samples_chart_type" ON "apps_kuaizhizao_spc_samples" ("chart_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spc_samples_sample_time" ON "apps_kuaizhizao_spc_samples" ("sample_time");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spc_samples_source" ON "apps_kuaizhizao_spc_samples" ("source_type", "source_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_spc_samples";
        DROP TABLE IF EXISTS "apps_kuaizhizao_oqc_inspections";
        DROP TABLE IF EXISTS "apps_kuaizhizao_quality_8d_reports";
    """
