"""全库补齐基础审计字段并回填姓名。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1) 为 public 下所有业务表补齐基础审计字段（排除 aerich 元表）
    FOR r IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name <> 'aerich'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS created_by INT,
                ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100),
                ADD COLUMN IF NOT EXISTS updated_by INT,
                ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(100),
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS deleted_by INT,
                ADD COLUMN IF NOT EXISTS deleted_by_name VARCHAR(100);',
            'public',
            r.table_name
        );
    END LOOP;

    -- 2) created_by -> created_by_name 回填（优先 full_name，其次 username）
    FOR r IN
        SELECT t.table_name
        FROM information_schema.tables t
        JOIN information_schema.columns c1
          ON c1.table_schema='public' AND c1.table_name=t.table_name AND c1.column_name='created_by'
        JOIN information_schema.columns c2
          ON c2.table_schema='public' AND c2.table_name=t.table_name AND c2.column_name='created_by_name'
        WHERE t.table_schema='public'
          AND t.table_type='BASE TABLE'
          AND t.table_name <> 'aerich'
    LOOP
        EXECUTE format(
            'UPDATE %I.%I x
                SET created_by_name = COALESCE(NULLIF(u.full_name, ''''), u.username, x.created_by_name)
               FROM core_users u
              WHERE x.created_by IS NOT NULL
                AND CAST(x.created_by AS TEXT) = CAST(u.id AS TEXT)
                AND (x.created_by_name IS NULL OR BTRIM(x.created_by_name) = '''' OR BTRIM(x.created_by_name) = CAST(x.created_by AS TEXT));',
            'public',
            r.table_name
        );
    END LOOP;

    -- 3) updated_by -> updated_by_name 回填（优先 full_name，其次 username）
    FOR r IN
        SELECT t.table_name
        FROM information_schema.tables t
        JOIN information_schema.columns c1
          ON c1.table_schema='public' AND c1.table_name=t.table_name AND c1.column_name='updated_by'
        JOIN information_schema.columns c2
          ON c2.table_schema='public' AND c2.table_name=t.table_name AND c2.column_name='updated_by_name'
        WHERE t.table_schema='public'
          AND t.table_type='BASE TABLE'
          AND t.table_name <> 'aerich'
    LOOP
        EXECUTE format(
            'UPDATE %I.%I x
                SET updated_by_name = COALESCE(NULLIF(u.full_name, ''''), u.username, x.updated_by_name)
               FROM core_users u
              WHERE x.updated_by IS NOT NULL
                AND CAST(x.updated_by AS TEXT) = CAST(u.id AS TEXT)
                AND (x.updated_by_name IS NULL OR BTRIM(x.updated_by_name) = '''' OR BTRIM(x.updated_by_name) = CAST(x.updated_by AS TEXT));',
            'public',
            r.table_name
        );
    END LOOP;
END$$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 全库补齐型迁移不做回退，避免误删线上有效列。
SELECT 1;
    """
