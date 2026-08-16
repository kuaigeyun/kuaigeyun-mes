"""订单评审审计操作人一次性回填。

创建路径曾只写 created_by/updated_by、未写 *_name，列表「更新时间」叠列
只读 updated_by_name / created_by_name，因而显示「-」。本迁移仅回填可溯源数据。
"""

from tortoise import BaseDBAsyncClient

_TABLE = "apps_kuaizhizao_sales_reviews"


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '{_TABLE}'
    ) THEN
        UPDATE {_TABLE} x
           SET created_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
          FROM core_users u
         WHERE x.created_by IS NOT NULL
           AND CAST(x.created_by AS TEXT) = CAST(u.id AS TEXT)
           AND (
                x.created_by_name IS NULL
                OR BTRIM(x.created_by_name) = ''
                OR BTRIM(x.created_by_name) = CAST(x.created_by AS TEXT)
           );

        UPDATE {_TABLE} x
           SET updated_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
          FROM core_users u
         WHERE x.updated_by IS NOT NULL
           AND CAST(x.updated_by AS TEXT) = CAST(u.id AS TEXT)
           AND (
                x.updated_by_name IS NULL
                OR BTRIM(x.updated_by_name) = ''
                OR BTRIM(x.updated_by_name) = CAST(x.updated_by AS TEXT)
           );

        UPDATE {_TABLE}
           SET updated_by = created_by,
               updated_by_name = created_by_name
         WHERE created_by IS NOT NULL
           AND (
                updated_by IS NULL
                OR (
                    (updated_by_name IS NULL OR BTRIM(updated_by_name) = '')
                    AND created_by_name IS NOT NULL
                    AND BTRIM(created_by_name) <> ''
                )
           );
    END IF;
END $$;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: audit name backfill is irreversible"
