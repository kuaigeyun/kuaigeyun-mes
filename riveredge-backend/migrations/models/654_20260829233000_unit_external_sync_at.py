"""物料单位：标记外部同步来源时间 external_sync_at。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_units"
            ADD COLUMN IF NOT EXISTS external_sync_at TIMESTAMPTZ;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_units"
            DROP COLUMN IF EXISTS external_sync_at;
    """
