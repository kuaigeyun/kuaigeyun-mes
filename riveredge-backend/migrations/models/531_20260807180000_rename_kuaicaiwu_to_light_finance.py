"""
快财务显示名改为轻财务（code 保持 kuaicaiwu）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications
        SET name = '轻财务', updated_at = NOW()
        WHERE code = 'kuaicaiwu'
          AND deleted_at IS NULL
          AND (is_custom_name IS NULL OR is_custom_name = FALSE);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications
        SET name = '快财务', updated_at = NOW()
        WHERE code = 'kuaicaiwu'
          AND deleted_at IS NULL
          AND (is_custom_name IS NULL OR is_custom_name = FALSE);
    """
