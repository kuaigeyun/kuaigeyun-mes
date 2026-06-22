"""好力 GO — 模具台账增加入厂时间；数据集绑定增加入厂时间列映射。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold"
        ADD COLUMN IF NOT EXISTS "factory_entry_at" DATE;

        ALTER TABLE "haoligo_mold_ledger_dataset_binding"
        ADD COLUMN IF NOT EXISTS "factory_entry_at_column" VARCHAR(128);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold"
        DROP COLUMN IF EXISTS "factory_entry_at";

        ALTER TABLE "haoligo_mold_ledger_dataset_binding"
        DROP COLUMN IF EXISTS "factory_entry_at_column";
    """
