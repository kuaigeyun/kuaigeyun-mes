"""好力 GO — 设备台账增加运行状态 operational_status。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment"
            ADD COLUMN IF NOT EXISTS "operational_status" VARCHAR(16);
        COMMENT ON COLUMN "haoligo_equipment"."operational_status" IS '运行状态：running/repair/shutdown/standby';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment" DROP COLUMN IF EXISTS "operational_status";
    """
