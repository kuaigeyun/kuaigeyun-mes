"""好力 GO — 设备点检 / 路线巡检 / 维保 / 产出事实表与产出数据集绑定。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_equipment_output_dataset_binding" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "dataset_uuid" VARCHAR(36),
            "work_order_param_key" VARCHAR(64),
            "customer_column" VARCHAR(128),
            "product_name_column" VARCHAR(128),
            "planned_qty_column" VARCHAR(128),
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "ux_haoligo_eq_out_ds_bind_tenant"
            ON "haoligo_equipment_output_dataset_binding" ("tenant_id") WHERE "deleted_at" IS NULL;

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_spot_check" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sheet_no" VARCHAR(64),
            "recorded_at" TIMESTAMPTZ NOT NULL,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment"("id") ON DELETE RESTRICT,
            "reporter_user_id" INT NOT NULL,
            "abnormal_description" TEXT,
            "handling_shutdown" BOOLEAN NOT NULL DEFAULT FALSE,
            "handling_report" BOOLEAN NOT NULL DEFAULT FALSE,
            "handling_supervised" BOOLEAN NOT NULL DEFAULT FALSE,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_esc_tenant" ON "haoligo_equipment_spot_check" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_esc_eq" ON "haoligo_equipment_spot_check" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_esc_recorded" ON "haoligo_equipment_spot_check" ("recorded_at");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_esc_sheet" ON "haoligo_equipment_spot_check" ("sheet_no");

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_spot_check_line" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "header_id" INT NOT NULL REFERENCES "haoligo_equipment_spot_check"("id") ON DELETE CASCADE,
            "inspection_param_id" INT REFERENCES "haoligo_inspection_param"("id") ON DELETE SET NULL,
            "param_code" VARCHAR(64) NOT NULL,
            "param_name" VARCHAR(200) NOT NULL,
            "result" VARCHAR(16) NOT NULL,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_escl_tenant" ON "haoligo_equipment_spot_check_line" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_escl_header" ON "haoligo_equipment_spot_check_line" ("header_id");

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_route_patrol" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sheet_no" VARCHAR(64),
            "recorded_at" TIMESTAMPTZ NOT NULL,
            "patrol_route_id" INT NOT NULL REFERENCES "haoligo_patrol_route"("id") ON DELETE RESTRICT,
            "reporter_user_id" INT NOT NULL,
            "report_required" BOOLEAN NOT NULL DEFAULT FALSE,
            "report_to_user_id" INT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_erp_tenant" ON "haoligo_equipment_route_patrol" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_erp_route" ON "haoligo_equipment_route_patrol" ("patrol_route_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_erp_recorded" ON "haoligo_equipment_route_patrol" ("recorded_at");

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_route_patrol_line" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "header_id" INT NOT NULL REFERENCES "haoligo_equipment_route_patrol"("id") ON DELETE CASCADE,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment"("id") ON DELETE RESTRICT,
            "asset_code" VARCHAR(64) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "sequence" INT NOT NULL DEFAULT 0,
            "is_normal" BOOLEAN NOT NULL DEFAULT TRUE,
            "abnormal_description" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_erpl_tenant" ON "haoligo_equipment_route_patrol_line" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_erpl_header" ON "haoligo_equipment_route_patrol_line" ("header_id");

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_maintenance_report" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sheet_no" VARCHAR(64),
            "recorded_at" TIMESTAMPTZ NOT NULL,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment"("id") ON DELETE RESTRICT,
            "description" TEXT NOT NULL,
            "attachment_file_ids" JSONB,
            "reporter_user_id" INT NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_emr_tenant" ON "haoligo_equipment_maintenance_report" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_emr_eq" ON "haoligo_equipment_maintenance_report" ("equipment_id");

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_output_record" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sheet_no" VARCHAR(64),
            "recorded_at" TIMESTAMPTZ NOT NULL,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment"("id") ON DELETE RESTRICT,
            "work_order_no" VARCHAR(128) NOT NULL,
            "customer_name" VARCHAR(200),
            "product_name" VARCHAR(200),
            "planned_qty" NUMERIC(18,4),
            "completed_qty" NUMERIC(18,4) NOT NULL DEFAULT 0,
            "startup_at" TIMESTAMPTZ,
            "completed_at" TIMESTAMPTZ,
            "operator_name" VARCHAR(100),
            "team_leader_name" VARCHAR(100),
            "reporter_user_id" INT NOT NULL,
            "dataset_snapshot" JSONB,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eor_tenant" ON "haoligo_equipment_output_record" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eor_eq" ON "haoligo_equipment_output_record" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eor_wo" ON "haoligo_equipment_output_record" ("work_order_no");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_equipment_output_record" CASCADE;
        DROP TABLE IF EXISTS "haoligo_equipment_maintenance_report" CASCADE;
        DROP TABLE IF EXISTS "haoligo_equipment_route_patrol_line" CASCADE;
        DROP TABLE IF EXISTS "haoligo_equipment_route_patrol" CASCADE;
        DROP TABLE IF EXISTS "haoligo_equipment_spot_check_line" CASCADE;
        DROP TABLE IF EXISTS "haoligo_equipment_spot_check" CASCADE;
        DROP TABLE IF EXISTS "haoligo_equipment_output_dataset_binding" CASCADE;
    """
