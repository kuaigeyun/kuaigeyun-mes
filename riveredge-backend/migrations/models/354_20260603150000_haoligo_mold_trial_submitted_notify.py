from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "submitted_notify_user_ids" JSONB NOT NULL DEFAULT '[]';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        DROP COLUMN IF EXISTS "submitted_notify_user_ids";
    """
