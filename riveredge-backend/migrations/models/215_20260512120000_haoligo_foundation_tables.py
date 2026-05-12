"""
好力 GO（haoligo）基础表：设备主数据、模具主数据、隐患单。

与 kuaizhizao 设备/模具表完全分离；表名前缀 haoligo_。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_workshop" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_workshop_tenant" ON "haoligo_workshop" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_workshop_tenant_code"
            ON "haoligo_workshop" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_manufacturer" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_manufacturer_tenant" ON "haoligo_manufacturer" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_manufacturer_tenant_code"
            ON "haoligo_manufacturer" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_inspection_param_set" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_ips_tenant" ON "haoligo_inspection_param_set" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_ips_tenant_code"
            ON "haoligo_inspection_param_set" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_inspection_param" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "unit" VARCHAR(32),
            "value_type" VARCHAR(32) NOT NULL DEFAULT 'numeric',
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_ip_tenant" ON "haoligo_inspection_param" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_ip_tenant_code"
            ON "haoligo_inspection_param" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_inspection_param_set_item" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_required" BOOLEAN NOT NULL DEFAULT TRUE,
            "param_id" INT NOT NULL REFERENCES "haoligo_inspection_param"("id") ON DELETE CASCADE,
            "set_id" INT NOT NULL REFERENCES "haoligo_inspection_param_set"("id") ON DELETE CASCADE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_ipset_item_tenant" ON "haoligo_inspection_param_set_item" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_ipset_item_set" ON "haoligo_inspection_param_set_item" ("set_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_ipset_item_set_param"
            ON "haoligo_inspection_param_set_item" ("set_id", "param_id") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_category" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "default_inspection_param_set_id" INT REFERENCES "haoligo_inspection_param_set"("id") ON DELETE SET NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eq_cat_tenant" ON "haoligo_equipment_category" ("tenant_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_eq_cat_tenant_code"
            ON "haoligo_equipment_category" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_equipment" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "asset_code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "manufacture_date" DATE,
            "remark" TEXT,
            "category_id" INT NOT NULL REFERENCES "haoligo_equipment_category"("id") ON DELETE RESTRICT,
            "workshop_id" INT NOT NULL REFERENCES "haoligo_workshop"("id") ON DELETE RESTRICT,
            "manufacturer_id" INT REFERENCES "haoligo_manufacturer"("id") ON DELETE SET NULL,
            "inspection_param_set_id" INT REFERENCES "haoligo_inspection_param_set"("id") ON DELETE SET NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eq_tenant" ON "haoligo_equipment" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eq_category" ON "haoligo_equipment" ("category_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eq_workshop" ON "haoligo_equipment" ("workshop_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_eq_tenant_asset"
            ON "haoligo_equipment" ("tenant_id", "asset_code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_patrol_route" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "workshop_id" INT REFERENCES "haoligo_workshop"("id") ON DELETE SET NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_pr_tenant" ON "haoligo_patrol_route" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_pr_workshop" ON "haoligo_patrol_route" ("workshop_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_pr_tenant_code"
            ON "haoligo_patrol_route" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_patrol_route_step" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sequence" INT NOT NULL DEFAULT 0,
            "route_id" INT NOT NULL REFERENCES "haoligo_patrol_route"("id") ON DELETE CASCADE,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment"("id") ON DELETE CASCADE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_prs_tenant" ON "haoligo_patrol_route_step" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_prs_route" ON "haoligo_patrol_route_step" ("route_id");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_prs_route_eq"
            ON "haoligo_patrol_route_step" ("route_id", "equipment_id") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_mold" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "mold_code" VARCHAR(64) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '待用',
            "total_manufacture_qty" NUMERIC(18,0) NOT NULL DEFAULT 0,
            "outsource_vendor_code" VARCHAR(64),
            "outsource_vendor_name" VARCHAR(200),
            "erp_material_code" VARCHAR(64),
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_tenant" ON "haoligo_mold" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_status" ON "haoligo_mold" ("status");
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_haoligo_mold_tenant_code"
            ON "haoligo_mold" ("tenant_id", "mold_code") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_hazard_report" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "workshop_area" VARCHAR(200),
            "reported_at" TIMESTAMPTZ,
            "issue_type_code" VARCHAR(64),
            "problem_summary" TEXT,
            "solution_note" TEXT,
            "status" VARCHAR(32) NOT NULL DEFAULT '检查中',
            "before_image_file_ids" JSONB,
            "after_image_file_ids" JSONB,
            "handler_name" VARCHAR(100),
            "handled_at" TIMESTAMPTZ,
            "workshop_id" INT REFERENCES "haoligo_workshop"("id") ON DELETE SET NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_hr_tenant" ON "haoligo_hazard_report" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_hr_status" ON "haoligo_hazard_report" ("status");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_hr_ws" ON "haoligo_hazard_report" ("workshop_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_hr_reported" ON "haoligo_hazard_report" ("reported_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_hazard_report";
        DROP TABLE IF EXISTS "haoligo_mold";
        DROP TABLE IF EXISTS "haoligo_patrol_route_step";
        DROP TABLE IF EXISTS "haoligo_patrol_route";
        DROP TABLE IF EXISTS "haoligo_equipment";
        DROP TABLE IF EXISTS "haoligo_equipment_category";
        DROP TABLE IF EXISTS "haoligo_inspection_param_set_item";
        DROP TABLE IF EXISTS "haoligo_inspection_param";
        DROP TABLE IF EXISTS "haoligo_inspection_param_set";
        DROP TABLE IF EXISTS "haoligo_manufacturer";
        DROP TABLE IF EXISTS "haoligo_workshop";
    """
