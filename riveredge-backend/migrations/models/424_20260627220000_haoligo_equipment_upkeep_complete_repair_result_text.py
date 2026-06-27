"""设备维保完成单 repair_result 支持多项存储（扩大字段长度）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE haoligo_equipment_upkeep_complete_sheet
        ALTER COLUMN repair_result TYPE TEXT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE haoligo_equipment_upkeep_complete_sheet
        ALTER COLUMN repair_result TYPE VARCHAR(32)
        USING LEFT(repair_result, 32);
    """
