"""废弃客户 is_public；修复 pool_status 与 salesman 不一致的脏数据。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers"
            DROP COLUMN IF EXISTS "is_public";

        UPDATE "apps_master_data_customers"
           SET "pool_status" = 'pool',
               "salesman_id" = NULL,
               "salesman_name" = NULL,
               "assigned_at" = NULL,
               "recycle_at" = NULL
         WHERE "deleted_at" IS NULL
           AND "pool_status" = 'owned'
           AND "salesman_id" IS NULL;

        UPDATE "apps_master_data_customers"
           SET "pool_status" = 'owned'
         WHERE "deleted_at" IS NULL
           AND "pool_status" = 'pool'
           AND "salesman_id" IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_customers"
            ADD COLUMN IF NOT EXISTS "is_public" BOOL NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_master_data_customers"."is_public" IS '是否公共（false=私有，true=公共）';
    """
