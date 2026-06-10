from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
        ADD COLUMN IF NOT EXISTS "complete_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet"
        ADD COLUMN IF NOT EXISTS "complete_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet"
        ADD COLUMN IF NOT EXISTS "complete_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_complete_sheet"
        DROP COLUMN IF EXISTS "complete_notify_user_ids";
        ALTER TABLE "haoligo_mold_outsource_maintenance_complete_sheet"
        DROP COLUMN IF EXISTS "complete_notify_user_ids";
        ALTER TABLE "haoligo_equipment_upkeep_complete_sheet"
        DROP COLUMN IF EXISTS "complete_notify_user_ids";
    """
