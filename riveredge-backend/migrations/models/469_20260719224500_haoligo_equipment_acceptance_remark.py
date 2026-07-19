"""
好力 GO — 设备验收单头增加备注。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_acceptance_sheet"
            ADD COLUMN IF NOT EXISTS "remark" TEXT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "haoligo_equipment_acceptance_sheet"
            DROP COLUMN IF EXISTS "remark";
    """
