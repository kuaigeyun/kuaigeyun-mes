"""
还入单表字段与移动端截图对齐：制令单、领用单、领出部门；制造数量非空默认 0。
（承接 221 初版列名 source_order_no / department_*）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_return_sheet" ADD COLUMN IF NOT EXISTS "production_order_no" VARCHAR(128);
        ALTER TABLE "haoligo_mold_return_sheet" ADD COLUMN IF NOT EXISTS "borrow_sheet_no" VARCHAR(128);
        ALTER TABLE "haoligo_mold_return_sheet" ADD COLUMN IF NOT EXISTS "issue_department_uuid" VARCHAR(36);
        ALTER TABLE "haoligo_mold_return_sheet" ADD COLUMN IF NOT EXISTS "issue_department_name" VARCHAR(200);

        UPDATE "haoligo_mold_return_sheet" SET "production_order_no" = "source_order_no";

        UPDATE "haoligo_mold_return_sheet"
        SET "issue_department_uuid" = "department_uuid",
            "issue_department_name" = "department_name";

        UPDATE "haoligo_mold_return_sheet" SET "manufacture_qty" = 0 WHERE "manufacture_qty" IS NULL;
        ALTER TABLE "haoligo_mold_return_sheet" ALTER COLUMN "manufacture_qty" SET DEFAULT 0;
        ALTER TABLE "haoligo_mold_return_sheet" ALTER COLUMN "manufacture_qty" SET NOT NULL;

        DROP INDEX IF EXISTS "idx_haoligo_mrs_src";

        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "source_order_no";
        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "department_uuid";
        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "department_name";

        CREATE INDEX IF NOT EXISTS "idx_haoligo_mrs_prod" ON "haoligo_mold_return_sheet" ("production_order_no");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_return_sheet" ADD COLUMN IF NOT EXISTS "source_order_no" VARCHAR(128);
        ALTER TABLE "haoligo_mold_return_sheet" ADD COLUMN IF NOT EXISTS "department_uuid" VARCHAR(36);
        ALTER TABLE "haoligo_mold_return_sheet" ADD COLUMN IF NOT EXISTS "department_name" VARCHAR(200);

        UPDATE "haoligo_mold_return_sheet" SET "source_order_no" = "production_order_no";
        UPDATE "haoligo_mold_return_sheet"
        SET "department_uuid" = "issue_department_uuid",
            "department_name" = COALESCE(NULLIF(TRIM("issue_department_name"), ''), '-');

        ALTER TABLE "haoligo_mold_return_sheet" ALTER COLUMN "department_name" SET NOT NULL;

        DROP INDEX IF EXISTS "idx_haoligo_mrs_prod";

        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "production_order_no";
        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "borrow_sheet_no";
        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "issue_department_uuid";
        ALTER TABLE "haoligo_mold_return_sheet" DROP COLUMN IF EXISTS "issue_department_name";

        ALTER TABLE "haoligo_mold_return_sheet" ALTER COLUMN "manufacture_qty" DROP NOT NULL;
        ALTER TABLE "haoligo_mold_return_sheet" ALTER COLUMN "manufacture_qty" DROP DEFAULT;

        CREATE INDEX IF NOT EXISTS "idx_haoligo_mrs_src" ON "haoligo_mold_return_sheet" ("source_order_no");
    """
