"""好力 GO — 设备运行状态变更日志表。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_equipment_operational_status_log" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "equipment_id" INT NOT NULL REFERENCES "haoligo_equipment"("id") ON DELETE CASCADE,
            "old_status" VARCHAR(16),
            "new_status" VARCHAR(16) NOT NULL,
            "changed_by_user_id" INT NOT NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eosl_tenant"
            ON "haoligo_equipment_operational_status_log" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eosl_eq"
            ON "haoligo_equipment_operational_status_log" ("equipment_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_eosl_created"
            ON "haoligo_equipment_operational_status_log" ("created_at");
        COMMENT ON TABLE "haoligo_equipment_operational_status_log" IS '好力GO - 设备运行状态变更日志';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_equipment_operational_status_log";
    """
