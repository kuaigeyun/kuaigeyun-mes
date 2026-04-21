"""
移除供应商「级别/评级」字段：apps_master_data_suppliers.supplier_level_code

主数据供应商仅保留基础档案能力，不再存储字典分级列。
不可逆：downgrade 返回空字符串。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_suppliers" DROP COLUMN IF EXISTS "supplier_level_code";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
