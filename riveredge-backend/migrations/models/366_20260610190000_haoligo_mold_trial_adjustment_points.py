from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "adjustment_points" TEXT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        DROP COLUMN IF EXISTS "adjustment_points";
    """
