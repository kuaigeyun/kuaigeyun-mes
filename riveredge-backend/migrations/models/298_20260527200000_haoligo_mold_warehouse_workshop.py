"""好力 GO — 模具仓库所属车间"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_warehouse"
        ADD COLUMN IF NOT EXISTS "workshop_id" INT REFERENCES "haoligo_workshop"("id") ON DELETE RESTRICT;
        ALTER TABLE "haoligo_mold_warehouse"
        ADD COLUMN IF NOT EXISTS "workshop_code" VARCHAR(64);
        ALTER TABLE "haoligo_mold_warehouse"
        ADD COLUMN IF NOT EXISTS "workshop_name" VARCHAR(200);
        CREATE INDEX IF NOT EXISTS "idx_haoligo_mold_warehouse_workshop"
            ON "haoligo_mold_warehouse" ("workshop_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_haoligo_mold_warehouse_workshop";
        ALTER TABLE "haoligo_mold_warehouse" DROP COLUMN IF EXISTS "workshop_name";
        ALTER TABLE "haoligo_mold_warehouse" DROP COLUMN IF EXISTS "workshop_code";
        ALTER TABLE "haoligo_mold_warehouse" DROP COLUMN IF EXISTS "workshop_id";
    """
