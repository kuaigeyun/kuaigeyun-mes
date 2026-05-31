from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_upkeep_param"
            ADD COLUMN IF NOT EXISTS "value_type" VARCHAR(32) NOT NULL DEFAULT 'text';
        ALTER TABLE "haoligo_mold_upkeep_param"
            ADD COLUMN IF NOT EXISTS "default_value" TEXT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_upkeep_param" DROP COLUMN IF EXISTS "default_value";
        ALTER TABLE "haoligo_mold_upkeep_param" DROP COLUMN IF EXISTS "value_type";
    """
