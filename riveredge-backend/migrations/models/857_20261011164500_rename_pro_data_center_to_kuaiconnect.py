"""
专业包 pro-data-center 编码规范化为 kuaiconnect（快连接，kuai* 族）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications
        SET
            code = 'kuaiconnect',
            entry_point = COALESCE(NULLIF(entry_point, ''), '../apps/kuaiconnect/index.tsx'),
            route_path = COALESCE(NULLIF(route_path, ''), '/apps/kuaiconnect'),
            updated_at = NOW()
        WHERE code = 'pro-data-center' AND deleted_at IS NULL;

        UPDATE infra_license_keys
        SET app_code = 'kuaiconnect', updated_at = NOW()
        WHERE app_code = 'pro-data-center';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
