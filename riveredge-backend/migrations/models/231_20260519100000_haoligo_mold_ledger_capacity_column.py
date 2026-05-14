"""
好力 GO — 模具台账数据集绑定增加「模具产能」结果列映射。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_ledger_dataset_binding"
        ADD COLUMN IF NOT EXISTS "mold_capacity_column" VARCHAR(128);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_mold_ledger_dataset_binding"
        DROP COLUMN IF EXISTS "mold_capacity_column";
    """
