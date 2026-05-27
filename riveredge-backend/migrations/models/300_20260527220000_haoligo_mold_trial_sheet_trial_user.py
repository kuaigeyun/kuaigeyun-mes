"""好力 GO — 试模单试模人员"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "trial_user_id" INT;
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "trial_user_name" VARCHAR(100);
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_trial_sheet_trial_user"
            ON "haoligo_mold_trial_sheet" ("trial_user_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_mold_trial_sheet_trial_user";
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "trial_user_name";
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "trial_user_id";
    """
