"""好力 GO — 试模单不合格处理方式"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "failure_handling" VARCHAR(16);
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "pending_notify_user_ids" JSONB DEFAULT '[]';
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "repair_warehouse_id" INT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "repair_warehouse_id";
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "pending_notify_user_ids";
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "failure_handling";
    """
