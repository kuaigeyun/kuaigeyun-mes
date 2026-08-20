"""重新注册日语 / 越南语系统语言（不删记录）。

语言包已在前端 locales 就绪。存量租户恢复 is_active；
没有记录的租户按 SYSTEM_LANGUAGES 补建。
"""

from tortoise import BaseDBAsyncClient

_TABLE = "core_languages"
_REGISTERED = (
    ("ja-JP", "日本語", "日本語", 3),
    ("vi-VN", "Tiếng Việt", "Tiếng Việt", 4),
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    updates = []
    inserts = []
    for code, name, native_name, sort_order in _REGISTERED:
        name_sql = name.replace("'", "''")
        native_sql = native_name.replace("'", "''")
        updates.append(
            f"""
        UPDATE {_TABLE}
           SET is_active = TRUE,
               is_default = FALSE,
               deleted_at = NULL,
               name = '{name_sql}',
               native_name = '{native_sql}',
               sort_order = {sort_order},
               updated_at = NOW()
         WHERE code = '{code}';
"""
        )
        inserts.append(
            f"""
        INSERT INTO {_TABLE} (
            uuid, tenant_id, code, name, native_name, translations,
            is_default, is_active, sort_order, created_at, updated_at
        )
        SELECT
            gen_random_uuid()::text,
            t.tenant_id,
            '{code}',
            '{name_sql}',
            '{native_sql}',
            '{{}}'::jsonb,
            FALSE,
            TRUE,
            {sort_order},
            NOW(),
            NOW()
        FROM (
            SELECT DISTINCT tenant_id
              FROM {_TABLE}
             WHERE tenant_id IS NOT NULL
        ) t
        WHERE NOT EXISTS (
            SELECT 1
              FROM {_TABLE} r
             WHERE r.tenant_id = t.tenant_id
               AND r.code = '{code}'
        );
"""
        )
    body = "\n".join(updates + inserts)
    return f"""
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '{_TABLE}'
    ) THEN
{body}
    END IF;
END $$;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    codes = ", ".join(f"'{code}'" for code, *_ in _REGISTERED)
    return f"""
UPDATE {_TABLE}
   SET is_active = FALSE,
       is_default = FALSE,
       updated_at = NOW()
 WHERE code IN ({codes})
   AND deleted_at IS NULL;
"""
