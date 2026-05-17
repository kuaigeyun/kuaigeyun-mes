"""好力 GO — 设备状态调整单表。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_equipment_status_adjustment" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "sheet_no" VARCHAR(64),
            "recorded_at" TIMESTAMPTZ NOT NULL,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment" ("id") ON DELETE RESTRICT,
            "old_operational_status" VARCHAR(32),
            "new_operational_status" VARCHAR(32) NOT NULL,
            "remark" TEXT,
            "reporter_user_id" INT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equipment_status_adj_tenant"
            ON "haoligo_equipment_status_adjustment" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equipment_status_adj_equipment"
            ON "haoligo_equipment_status_adjustment" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equipment_status_adj_recorded"
            ON "haoligo_equipment_status_adjustment" ("recorded_at");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_equipment_status_adj_sheet_no"
            ON "haoligo_equipment_status_adjustment" ("sheet_no");
        COMMENT ON TABLE "haoligo_equipment_status_adjustment" IS '好力GO - 设备状态调整单';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_equipment_status_adjustment";
    """
