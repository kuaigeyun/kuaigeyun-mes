"""P2 EAM: spare part requisitions + equipment transfers."""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_spare_part_requisitions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "requisition_no" VARCHAR(64) NOT NULL,
            "equipment_id" INT NULL,
            "equipment_uuid" VARCHAR(36) NULL,
            "equipment_code" VARCHAR(50) NULL,
            "equipment_name" VARCHAR(200) NULL,
            "purpose" TEXT NULL,
            "applicant_id" INT NULL,
            "applicant_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '草稿',
            "approver_id" INT NULL,
            "approver_name" VARCHAR(100) NULL,
            "approved_at" TIMESTAMPTZ NULL,
            "reject_reason" TEXT NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_spare_part_requisitions_tenant_requisition_no"
                UNIQUE ("tenant_id", "requisition_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spare_part_requisitions_tenant_id"
            ON "apps_kuaizhizao_spare_part_requisitions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spare_part_requisitions_status"
            ON "apps_kuaizhizao_spare_part_requisitions" ("status");
        COMMENT ON TABLE "apps_kuaizhizao_spare_part_requisitions" IS '快格轻制造 - 备件领用单';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_spare_part_requisition_lines" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "requisition_id" INT NOT NULL,
            "line_no" INT NOT NULL DEFAULT 1,
            "spare_part_id" INT NOT NULL,
            "spare_part_uuid" VARCHAR(36) NULL,
            "part_no" VARCHAR(100) NULL,
            "part_name" VARCHAR(200) NULL,
            "quantity" INT NOT NULL DEFAULT 1,
            "warehouse_location" VARCHAR(100) NULL DEFAULT '默认库位',
            "unit" VARCHAR(20) NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spare_part_requisition_lines_tenant_id"
            ON "apps_kuaizhizao_spare_part_requisition_lines" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_spare_part_requisition_lines_requisition_id"
            ON "apps_kuaizhizao_spare_part_requisition_lines" ("requisition_id");
        COMMENT ON TABLE "apps_kuaizhizao_spare_part_requisition_lines" IS '快格轻制造 - 备件领用单行';

        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_equipment_transfer_applications" (
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
            "from_workshop_id" INT NULL,
            "from_workshop_name" VARCHAR(200) NULL,
            "from_workstation_id" INT NULL,
            "from_workstation_name" VARCHAR(200) NULL,
            "to_workshop_id" INT NULL,
            "to_workshop_name" VARCHAR(200) NULL,
            "to_workstation_id" INT NULL,
            "to_workstation_name" VARCHAR(200) NULL,
            "to_status" VARCHAR(50) NULL,
            "reason" TEXT NOT NULL,
            "transfer_date" DATE NULL,
            "applicant_id" INT NULL,
            "applicant_name" VARCHAR(100) NULL,
            "status" VARCHAR(32) NOT NULL DEFAULT '草稿',
            "approver_id" INT NULL,
            "approver_name" VARCHAR(100) NULL,
            "approved_at" TIMESTAMPTZ NULL,
            "reject_reason" TEXT NULL,
            "remark" TEXT NULL,
            "deleted_at" TIMESTAMPTZ NULL,
            CONSTRAINT "uid_apps_kuaizhizao_equipment_transfer_applications_tenant_application_no"
                UNIQUE ("tenant_id", "application_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_transfer_applications_tenant_id"
            ON "apps_kuaizhizao_equipment_transfer_applications" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_transfer_applications_equipment_id"
            ON "apps_kuaizhizao_equipment_transfer_applications" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_equipment_transfer_applications_status"
            ON "apps_kuaizhizao_equipment_transfer_applications" ("status");
        COMMENT ON TABLE "apps_kuaizhizao_equipment_transfer_applications" IS '快格轻制造 - 设备调拨单';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_spare_part_requisition_lines";
        DROP TABLE IF EXISTS "apps_kuaizhizao_spare_part_requisitions";
        DROP TABLE IF EXISTS "apps_kuaizhizao_equipment_transfer_applications";
    """
