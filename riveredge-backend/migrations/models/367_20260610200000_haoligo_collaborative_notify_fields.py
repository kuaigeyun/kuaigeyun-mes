from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_sheet"
        ADD COLUMN IF NOT EXISTS "submitted_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE "haoligo_mold_maintenance_sheet"
        ADD COLUMN IF NOT EXISTS "complete_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
        ADD COLUMN IF NOT EXISTS "submitted_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
        ADD COLUMN IF NOT EXISTS "complete_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE "haoligo_equipment_upkeep_sheet"
        ADD COLUMN IF NOT EXISTS "complete_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_maintenance_sheet"
        DROP COLUMN IF EXISTS "submitted_notify_user_ids";
        ALTER TABLE "haoligo_mold_maintenance_sheet"
        DROP COLUMN IF EXISTS "complete_notify_user_ids";
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
        DROP COLUMN IF EXISTS "submitted_notify_user_ids";
        ALTER TABLE "haoligo_mold_outsource_maintenance_sheet"
        DROP COLUMN IF EXISTS "complete_notify_user_ids";
        ALTER TABLE "haoligo_equipment_upkeep_sheet"
        DROP COLUMN IF EXISTS "complete_notify_user_ids";
    """
