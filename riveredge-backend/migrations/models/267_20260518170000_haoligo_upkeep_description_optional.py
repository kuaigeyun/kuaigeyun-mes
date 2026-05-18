"""好力 GO — 设备保养单 description 改为可选（保养要求）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_upkeep_sheet"
            ALTER COLUMN "description" DROP NOT NULL;
        COMMENT ON COLUMN "haoligo_equipment_upkeep_sheet"."description" IS '保养要求（可选）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_equipment_upkeep_sheet"
        SET "description" = ''
        WHERE "description" IS NULL;
        ALTER TABLE "haoligo_equipment_upkeep_sheet"
            ALTER COLUMN "description" SET NOT NULL;
    """
