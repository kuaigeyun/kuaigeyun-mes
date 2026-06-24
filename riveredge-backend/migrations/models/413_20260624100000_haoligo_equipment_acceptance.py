"""好力 GO — 设备验收单头/轮次表。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_equipment_acceptance_sheet" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "sheet_no" VARCHAR(64),
            "manufacturer_id" INT,
            "manufacturer_name" VARCHAR(200),
            "arrived_at" TIMESTAMPTZ,
            "install_location" VARCHAR(500),
            "equipment_name" VARCHAR(200),
            "commissioning_user_ids" JSONB NOT NULL DEFAULT '[]',
            "submitted_notify_user_ids" JSONB NOT NULL DEFAULT '[]',
            "equipment_id" INT REFERENCES "haoligo_equipment" ("id") ON DELETE SET NULL,
            "workflow_status" VARCHAR(32) NOT NULL DEFAULT 'draft',
            "current_round" INT NOT NULL DEFAULT 1,
            "accepted_at" TIMESTAMPTZ,
            "accepted_by_user_id" INT,
            "ledger_action" VARCHAR(16) NOT NULL DEFAULT 'none',
            "reporter_user_id" INT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equip_accept_sheet_tenant"
            ON "haoligo_equipment_acceptance_sheet" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equip_accept_sheet_no"
            ON "haoligo_equipment_acceptance_sheet" ("sheet_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equip_accept_sheet_status"
            ON "haoligo_equipment_acceptance_sheet" ("workflow_status");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equip_accept_sheet_equipment"
            ON "haoligo_equipment_acceptance_sheet" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equip_accept_sheet_manufacturer"
            ON "haoligo_equipment_acceptance_sheet" ("manufacturer_id");
        COMMENT ON TABLE "haoligo_equipment_acceptance_sheet" IS '好力GO - 设备验收单';

        CREATE TABLE IF NOT EXISTS "haoligo_equipment_acceptance_round" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "header_id" INT NOT NULL REFERENCES "haoligo_equipment_acceptance_sheet" ("id") ON DELETE CASCADE,
            "round_no" INT NOT NULL,
            "commissioning_content" TEXT,
            "commissioning_result" VARCHAR(16),
            "commissioning_submitted_at" TIMESTAMPTZ,
            "product_name" VARCHAR(200),
            "material_no" VARCHAR(128),
            "quantity" DECIMAL(20,4),
            "defect_qty" DECIMAL(20,4),
            "defect_reason" TEXT,
            "running_time" DECIMAL(12,2),
            "fault_time" DECIMAL(12,2),
            "capacity_per_hour" DECIMAL(20,4),
            "trial_result" VARCHAR(16),
            UNIQUE ("header_id", "round_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equip_accept_round_tenant"
            ON "haoligo_equipment_acceptance_round" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equip_accept_round_header"
            ON "haoligo_equipment_acceptance_round" ("header_id");
        COMMENT ON TABLE "haoligo_equipment_acceptance_round" IS '好力GO - 设备验收轮次';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_equipment_acceptance_round";
        DROP TABLE IF EXISTS "haoligo_equipment_acceptance_sheet";
    """
