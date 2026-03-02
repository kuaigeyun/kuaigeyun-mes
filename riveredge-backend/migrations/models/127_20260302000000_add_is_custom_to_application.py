from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_applications" ADD COLUMN IF NOT EXISTS "is_custom_name" bool NOT NULL DEFAULT false;
        ALTER TABLE "core_applications" ADD COLUMN IF NOT EXISTS "is_custom_sort" bool NOT NULL DEFAULT false;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_applications" DROP COLUMN IF EXISTS "is_custom_name";
        ALTER TABLE "core_applications" DROP COLUMN IF EXISTS "is_custom_sort";"""
