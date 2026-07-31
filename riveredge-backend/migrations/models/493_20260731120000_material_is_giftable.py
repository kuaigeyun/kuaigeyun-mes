from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials"
            ADD COLUMN IF NOT EXISTS "is_giftable" BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_master_data_materials"."is_giftable" IS '是否允许作为销售赠品';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "is_giftable";
    """
