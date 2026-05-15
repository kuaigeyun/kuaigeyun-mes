"""好力 GO — 隐患单可选关联设备。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_hazard_report"
            ADD COLUMN IF NOT EXISTS "equipment_id" INT NULL
            REFERENCES "haoligo_equipment"("id") ON DELETE SET NULL;
        COMMENT ON COLUMN "haoligo_hazard_report"."equipment_id" IS '关联设备（可选）';
        CREATE INDEX IF NOT EXISTS "idx_haoligo_hr_equipment"
            ON "haoligo_hazard_report" ("equipment_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_hr_equipment";
        ALTER TABLE "haoligo_hazard_report" DROP COLUMN IF EXISTS "equipment_id";
    """
