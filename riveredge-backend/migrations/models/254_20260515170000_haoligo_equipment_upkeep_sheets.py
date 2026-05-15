"""好力 GO — 设备保养单、设备保养完成单表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_equipment_upkeep_sheet" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sheet_no" VARCHAR(64),
            "applicant_user_id" INT,
            "applicant_name" VARCHAR(100),
            "department_uuid" VARCHAR(36),
            "department_name" VARCHAR(200),
            "header_attachment_file_uuids" JSONB,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment"("id") ON DELETE RESTRICT,
            "description" TEXT NOT NULL,
            "reporter_user_id" INT NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eus_tenant" ON "haoligo_equipment_upkeep_sheet" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eus_eq" ON "haoligo_equipment_upkeep_sheet" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eus_sheet" ON "haoligo_equipment_upkeep_sheet" ("sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eus_dept" ON "haoligo_equipment_upkeep_sheet" ("department_uuid");
        COMMENT ON TABLE "haoligo_equipment_upkeep_sheet" IS '好力GO - 设备保养单';

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_upkeep_complete_sheet" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sheet_no" VARCHAR(64),
            "source_upkeep_sheet_id" INT REFERENCES "haoligo_equipment_upkeep_sheet"("id") ON DELETE SET NULL,
            "source_order_no" VARCHAR(128) NOT NULL,
            "applicant_user_id" INT,
            "applicant_name" VARCHAR(100),
            "department_uuid" VARCHAR(36),
            "department_name" VARCHAR(200),
            "header_attachment_file_uuids" JSONB,
            "completion_content" TEXT NOT NULL,
            "reporter_user_id" INT NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eucs_tenant" ON "haoligo_equipment_upkeep_complete_sheet" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eucs_src" ON "haoligo_equipment_upkeep_complete_sheet" ("source_upkeep_sheet_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eucs_sheet" ON "haoligo_equipment_upkeep_complete_sheet" ("sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eucs_srcno" ON "haoligo_equipment_upkeep_complete_sheet" ("source_order_no");
        COMMENT ON TABLE "haoligo_equipment_upkeep_complete_sheet" IS '好力GO - 设备保养完成单';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_equipment_upkeep_complete_sheet";
        DROP TABLE IF EXISTS "haoligo_equipment_upkeep_sheet";
    """
