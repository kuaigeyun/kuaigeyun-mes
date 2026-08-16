"""zh-CN 展示名统一为「简体中文」，不再用「中文」省略。"""

from tortoise import BaseDBAsyncClient

_TABLE = "core_languages"


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '{_TABLE}'
    ) THEN
        UPDATE {_TABLE}
           SET name = '简体中文',
               native_name = '简体中文'
         WHERE code = 'zh-CN'
           AND deleted_at IS NULL
           AND (
                name IS DISTINCT FROM '简体中文'
                OR native_name IS DISTINCT FROM '简体中文'
           );
    END IF;
END $$;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: display name correction is not reverted"
