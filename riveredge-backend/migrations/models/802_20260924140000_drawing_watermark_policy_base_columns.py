"""图纸水印策略表补齐 BaseModel 列。

801 建表漏 uuid / created_by / created_by_name，查询会报 column created_by does not exist。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_drawing_watermark_policies"
    ADD COLUMN IF NOT EXISTS "uuid" VARCHAR(36),
    ADD COLUMN IF NOT EXISTS "created_by" INT,
    ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100);

UPDATE "apps_master_data_drawing_watermark_policies"
SET "uuid" = gen_random_uuid()::text
WHERE "uuid" IS NULL;

ALTER TABLE "apps_master_data_drawing_watermark_policies"
    ALTER COLUMN "uuid" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uidx_drawing_watermark_policies_uuid"
    ON "apps_master_data_drawing_watermark_policies" ("uuid");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "uidx_drawing_watermark_policies_uuid";
ALTER TABLE "apps_master_data_drawing_watermark_policies"
    DROP COLUMN IF EXISTS "created_by_name",
    DROP COLUMN IF EXISTS "created_by",
    DROP COLUMN IF EXISTS "uuid";
"""
