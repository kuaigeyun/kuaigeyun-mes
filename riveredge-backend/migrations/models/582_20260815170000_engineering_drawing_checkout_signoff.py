"""
工程图纸：检出锁字段 + 签审状态 Editing/Pending。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_engineering_drawings"
    ADD COLUMN IF NOT EXISTS "checked_out_by" INT;
ALTER TABLE "apps_master_data_engineering_drawings"
    ADD COLUMN IF NOT EXISTS "checked_out_by_name" VARCHAR(100);
ALTER TABLE "apps_master_data_engineering_drawings"
    ADD COLUMN IF NOT EXISTS "checked_out_at" TIMESTAMPTZ;
ALTER TABLE "apps_master_data_engineering_drawings"
    ADD COLUMN IF NOT EXISTS "checkout_comment" TEXT;
CREATE INDEX IF NOT EXISTS "idx_eng_drawing_checked_out_by"
    ON "apps_master_data_engineering_drawings" ("checked_out_by");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_eng_drawing_checked_out_by";
ALTER TABLE "apps_master_data_engineering_drawings" DROP COLUMN IF EXISTS "checkout_comment";
ALTER TABLE "apps_master_data_engineering_drawings" DROP COLUMN IF EXISTS "checked_out_at";
ALTER TABLE "apps_master_data_engineering_drawings" DROP COLUMN IF EXISTS "checked_out_by_name";
ALTER TABLE "apps_master_data_engineering_drawings" DROP COLUMN IF EXISTS "checked_out_by";
"""
