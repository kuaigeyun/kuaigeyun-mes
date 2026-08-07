"""
主数据应用排序：调至基础应用分组末位（快制造 / 快研发 / 快财务 之后）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications
        SET sort_order = 150, updated_at = NOW()
        WHERE code = 'master-data' AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications
        SET sort_order = 110, updated_at = NOW()
        WHERE code = 'master-data' AND deleted_at IS NULL;
    """
