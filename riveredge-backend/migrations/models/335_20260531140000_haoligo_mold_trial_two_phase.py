from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "workflow_phase" VARCHAR(32) NOT NULL DEFAULT '试模';
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "production_trial_result" VARCHAR(16);
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "production_trial_user_id" INT;
        ALTER TABLE "haoligo_mold_trial_sheet"
        ADD COLUMN IF NOT EXISTS "production_trial_user_name" VARCHAR(100);
        UPDATE "haoligo_mold_trial_sheet"
        SET "workflow_phase" = '已结案'
        WHERE COALESCE("sheet_status", '') = '已通过'
          AND COALESCE("trial_result", '') = '不合格';
        UPDATE "haoligo_mold_trial_sheet"
        SET "workflow_phase" = '试模合格待试产'
        WHERE COALESCE("sheet_status", '') = '已通过'
          AND COALESCE("trial_result", '') = '合格'
          AND ("production_trial_result" IS NULL OR TRIM("production_trial_result") = '');
        UPDATE "haoligo_mold_trial_sheet"
        SET "workflow_phase" = '已结案',
            "sheet_status" = '待审核'
        WHERE "workflow_phase" = '试模合格待试产';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "production_trial_user_name";
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "production_trial_user_id";
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "production_trial_result";
        ALTER TABLE "haoligo_mold_trial_sheet" DROP COLUMN IF EXISTS "workflow_phase";
    """
