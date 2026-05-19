"""好力 GO 模具台账来源：允许 NULL（历史数据待同步回填），避免与手工创建混淆。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold" ALTER COLUMN "ledger_source" DROP DEFAULT;
        ALTER TABLE "haoligo_mold" ALTER COLUMN "ledger_source" DROP NOT NULL;
        UPDATE "haoligo_mold" SET "ledger_source" = NULL WHERE "ledger_source" = 'manual';
        COMMENT ON COLUMN "haoligo_mold"."ledger_source" IS '来源：sync=数据集同步，manual=手工创建/导入，NULL=历史或未同步回填';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_mold" SET "ledger_source" = 'manual' WHERE "ledger_source" IS NULL;
        ALTER TABLE "haoligo_mold" ALTER COLUMN "ledger_source" SET DEFAULT 'manual';
        ALTER TABLE "haoligo_mold" ALTER COLUMN "ledger_source" SET NOT NULL;
    """
