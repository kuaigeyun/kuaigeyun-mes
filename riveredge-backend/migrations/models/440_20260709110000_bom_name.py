"""
工程 BOM 增加版本级 BOM 名称（bom_name，可空）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom"
        ADD COLUMN IF NOT EXISTS "bom_name" VARCHAR(200);
        COMMENT ON COLUMN "apps_master_data_bom"."bom_name"
            IS 'BOM名称（版本级，可空）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom"
        DROP COLUMN IF EXISTS "bom_name";
    """
