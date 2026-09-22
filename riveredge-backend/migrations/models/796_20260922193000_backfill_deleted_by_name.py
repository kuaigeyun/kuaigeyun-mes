"""回填 deleted_by_name（R3 A-01：454 迁移补齐列后未回填姓名）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT t.table_name
        FROM information_schema.tables t
        JOIN information_schema.columns c1
          ON c1.table_schema='public' AND c1.table_name=t.table_name AND c1.column_name='deleted_by'
        JOIN information_schema.columns c2
          ON c2.table_schema='public' AND c2.table_name=t.table_name AND c2.column_name='deleted_by_name'
        WHERE t.table_schema='public'
          AND t.table_type='BASE TABLE'
          AND t.table_name <> 'aerich'
    LOOP
        EXECUTE format(
            'UPDATE %I.%I x
                SET deleted_by_name = COALESCE(NULLIF(u.full_name, ''''), u.username, x.deleted_by_name)
               FROM core_users u
              WHERE x.deleted_by IS NOT NULL
                AND CAST(x.deleted_by AS TEXT) = CAST(u.id AS TEXT)
                AND (x.deleted_by_name IS NULL OR BTRIM(x.deleted_by_name) = '''' OR BTRIM(x.deleted_by_name) = CAST(x.deleted_by AS TEXT));',
            'public',
            r.table_name
        );
    END LOOP;
END$$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
SELECT 1;
    """
