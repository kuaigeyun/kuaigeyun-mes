"""好力 GO 设备台账保养周期 + 维保完成单清空产量标记"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment" ADD COLUMN IF NOT EXISTS "maintenance_cycle_by_yield" NUMERIC(18,4);
        ALTER TABLE "haoligo_equipment" ADD COLUMN IF NOT EXISTS "maintenance_cycle_by_days" INT;
        ALTER TABLE "haoligo_equipment" ADD COLUMN IF NOT EXISTS "used_yield" NUMERIC(18,4) NOT NULL DEFAULT 0;
        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet"
            ADD COLUMN IF NOT EXISTS "clear_total_production" BOOLEAN NOT NULL DEFAULT FALSE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet" DROP COLUMN IF EXISTS "clear_total_production";
        ALTER TABLE "haoligo_equipment" DROP COLUMN IF EXISTS "used_yield";
        ALTER TABLE "haoligo_equipment" DROP COLUMN IF EXISTS "maintenance_cycle_by_days";
        ALTER TABLE "haoligo_equipment" DROP COLUMN IF EXISTS "maintenance_cycle_by_yield";
    """
