"""好力 GO — 模具台账关联模具仓库"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold"
        ADD COLUMN IF NOT EXISTS "mold_warehouse_id" INT REFERENCES "haoligo_mold_warehouse"("id") ON DELETE SET NULL;
        ALTER TABLE "haoligo_mold"
        ADD COLUMN IF NOT EXISTS "mold_warehouse_code" VARCHAR(64);
        ALTER TABLE "haoligo_mold"
        ADD COLUMN IF NOT EXISTS "mold_warehouse_name" VARCHAR(200);
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_mold_warehouse"
            ON "haoligo_mold" ("mold_warehouse_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_mold_mold_warehouse";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "mold_warehouse_name";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "mold_warehouse_code";
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "mold_warehouse_id";
    """
