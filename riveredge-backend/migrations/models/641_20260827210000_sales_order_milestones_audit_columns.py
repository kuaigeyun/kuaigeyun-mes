from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_milestones"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "deleted_by" INT,
            ADD COLUMN IF NOT EXISTS "deleted_by_name" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_milestones"
            DROP COLUMN IF EXISTS "created_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "deleted_at",
            DROP COLUMN IF EXISTS "deleted_by",
            DROP COLUMN IF EXISTS "deleted_by_name";
    """
