"""
专业包 pro-data-center 编码规范化为 kuaiconnect（快连接，kuai* 族）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    # infra_license_keys 属专业包；开源仓可能无此表，须存在性保护后再 UPDATE
    return """
        UPDATE core_applications
        SET
            code = 'kuaiconnect',
            entry_point = COALESCE(NULLIF(entry_point, ''), '../apps/kuaiconnect/index.tsx'),
            route_path = COALESCE(NULLIF(route_path, ''), '/apps/kuaiconnect'),
            updated_at = NOW()
        WHERE code = 'pro-data-center' AND deleted_at IS NULL;

        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'infra_license_keys'
            ) THEN
                UPDATE infra_license_keys
                SET app_code = 'kuaiconnect', updated_at = NOW()
                WHERE app_code = 'pro-data-center';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
