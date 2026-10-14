from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_engineering_drawings"
            ADD COLUMN IF NOT EXISTS "drawing_format" VARCHAR(10);
        COMMENT ON COLUMN "apps_master_data_engineering_drawings"."drawing_format" IS '图档格式：2d/3d';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_engineering_drawings" DROP COLUMN IF EXISTS "drawing_format";
    """
