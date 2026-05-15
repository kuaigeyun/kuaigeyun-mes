"""好力 GO — 设备台账增加重要等级（A/B/C）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment"
            ADD COLUMN IF NOT EXISTS "criticality" VARCHAR(8);
        COMMENT ON COLUMN "haoligo_equipment"."criticality" IS '设备重要等级：A/B/C';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment" DROP COLUMN IF EXISTS "criticality";
    """
