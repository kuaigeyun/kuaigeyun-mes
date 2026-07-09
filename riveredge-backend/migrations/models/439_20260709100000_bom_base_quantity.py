"""
工程 BOM 增加版本级基准数量（base_quantity）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom"
        ADD COLUMN IF NOT EXISTS "base_quantity" DECIMAL(18,4) NOT NULL DEFAULT 1;
        COMMENT ON COLUMN "apps_master_data_bom"."base_quantity"
            IS '基准数量（本版本用量对应的成品基数）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom"
        DROP COLUMN IF EXISTS "base_quantity";
    """
