"""好力 GO — 维保完修单增加保养内容、维修内容、维修结果。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "upkeep_content" TEXT;
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "repair_content" TEXT;
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
            ADD COLUMN IF NOT EXISTS "repair_result" VARCHAR(32);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" DROP COLUMN IF EXISTS "upkeep_content";
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" DROP COLUMN IF EXISTS "repair_content";
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet" DROP COLUMN IF EXISTS "repair_result";
    """
