from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" ALTER COLUMN "tenant_id" DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_data_backups" ALTER COLUMN "tenant_id" SET NOT NULL;
    """
