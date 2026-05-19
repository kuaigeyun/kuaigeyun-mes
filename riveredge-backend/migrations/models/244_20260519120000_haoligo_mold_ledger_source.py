"""好力 GO 模具台账：来源（同步 / 手工创建）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" ADD COLUMN IF NOT EXISTS "ledger_source" VARCHAR(16) NOT NULL DEFAULT 'manual';
        COMMENT ON COLUMN "haoligo_mold"."ledger_source" IS '来源：sync=数据集同步，manual=手工创建/导入';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" DROP COLUMN IF EXISTS "ledger_source";
    """
