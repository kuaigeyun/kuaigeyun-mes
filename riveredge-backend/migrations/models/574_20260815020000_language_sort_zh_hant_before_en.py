"""界面语言顺序：简体中文、繁體中文、English。"""

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
        UPDATE {_TABLE} SET sort_order = 0 WHERE code = 'zh-CN' AND deleted_at IS NULL;
        UPDATE {_TABLE} SET sort_order = 1 WHERE code = 'zh-Hant' AND deleted_at IS NULL;
        UPDATE {_TABLE} SET sort_order = 2 WHERE code = 'en-US' AND deleted_at IS NULL;
    END IF;
END $$;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
UPDATE {_TABLE} SET sort_order = 1 WHERE code = 'en-US' AND deleted_at IS NULL;
UPDATE {_TABLE} SET sort_order = 2 WHERE code = 'zh-Hant' AND deleted_at IS NULL;
"""
