"""停用日语 / 越南语系统语言注册（不删除记录）。

语言包仍保留；需要时把 code 加回 SYSTEM_LANGUAGES 并设 is_active=True。
若某租户因此没有默认语言，把 zh-CN 设为默认。
"""

from tortoise import BaseDBAsyncClient

_TABLE = "core_languages"
_UNREGISTERED = ("ja-JP", "vi-VN")


async def upgrade(db: BaseDBAsyncClient) -> str:
    codes = ", ".join(f"'{code}'" for code in _UNREGISTERED)
    return f"""
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '{_TABLE}'
    ) THEN
        UPDATE {_TABLE}
           SET is_active = FALSE,
               is_default = FALSE
         WHERE code IN ({codes})
           AND deleted_at IS NULL
           AND (is_active = TRUE OR is_default = TRUE);

        UPDATE {_TABLE} c
           SET is_default = TRUE,
               is_active = TRUE
         WHERE c.code = 'zh-CN'
           AND c.deleted_at IS NULL
           AND NOT EXISTS (
               SELECT 1
                 FROM {_TABLE} d
                WHERE d.tenant_id = c.tenant_id
                  AND d.is_default = TRUE
                  AND d.is_active = TRUE
                  AND d.deleted_at IS NULL
           );
    END IF;
END $$;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: re-enable ja-JP / vi-VN from language management or SYSTEM_LANGUAGES"
