"""
为套餐表补充激活状态字段
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_packages"
        ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;

        COMMENT ON COLUMN "infra_packages"."is_active" IS '是否激活';

        UPDATE "infra_packages"
        SET "is_active" = TRUE
        WHERE "is_active" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "infra_packages" DROP COLUMN IF EXISTS "is_active";
    """
