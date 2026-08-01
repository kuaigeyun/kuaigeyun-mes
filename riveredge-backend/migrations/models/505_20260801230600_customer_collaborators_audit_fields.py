"""客户池协作人表补齐 BaseModel 审计字段（498 建表晚于全库审计回填，缺 created_by/updated_by）。"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_customer_collaborators"
    ADD COLUMN IF NOT EXISTS "created_by" INT,
    ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "updated_by" INT,
    ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);

UPDATE "apps_kuaizhizao_customer_collaborators"
SET
    "created_by" = "added_by",
    "created_by_name" = "added_by_name"
WHERE "created_by" IS NULL
  AND "added_by" IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_customer_collaborators" DROP COLUMN IF EXISTS "updated_by_name";
ALTER TABLE "apps_kuaizhizao_customer_collaborators" DROP COLUMN IF EXISTS "updated_by";
ALTER TABLE "apps_kuaizhizao_customer_collaborators" DROP COLUMN IF EXISTS "created_by_name";
ALTER TABLE "apps_kuaizhizao_customer_collaborators" DROP COLUMN IF EXISTS "created_by";
    """
