"""轻办公审计操作人一次性回填。

创建/审批路径曾只写 created_by/updated_by、未写 *_name，列表「更新时间」叠列
只读 updated_by_name / created_by_name，因而显示「-」。本迁移仅回填可溯源数据。
"""

from tortoise import BaseDBAsyncClient

_TABLES = (
    "apps_kuaioa_form_templates",
    "apps_kuaioa_form_requests",
    "apps_kuaioa_training_plans",
    "apps_kuaioa_training_records",
    "apps_kuaioa_work_licenses",
    "apps_kuaioa_licenses",
    "apps_kuaioa_asset_purchases",
    "apps_kuaioa_assets",
)

_APPLICANT_TABLES = (
    "apps_kuaioa_form_requests",
    "apps_kuaioa_asset_purchases",
)


def _backfill_sql(table: str) -> str:
    return f"""
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = '{table}'
        ) THEN
            UPDATE {table} x
               SET created_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
              FROM core_users u
             WHERE x.created_by IS NOT NULL
               AND CAST(x.created_by AS TEXT) = CAST(u.id AS TEXT)
               AND (
                    x.created_by_name IS NULL
                    OR BTRIM(x.created_by_name) = ''
                    OR BTRIM(x.created_by_name) = CAST(x.created_by AS TEXT)
               );

            UPDATE {table} x
               SET updated_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
              FROM core_users u
             WHERE x.updated_by IS NOT NULL
               AND CAST(x.updated_by AS TEXT) = CAST(u.id AS TEXT)
               AND (
                    x.updated_by_name IS NULL
                    OR BTRIM(x.updated_by_name) = ''
                    OR BTRIM(x.updated_by_name) = CAST(x.updated_by AS TEXT)
               );

            UPDATE {table}
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
    """


def _applicant_fallback_sql(table: str) -> str:
    return f"""
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = '{table}'
        ) THEN
            UPDATE {table}
               SET created_by_name = applicant_name
             WHERE BTRIM(COALESCE(applicant_name, '')) <> ''
               AND (created_by_name IS NULL OR BTRIM(created_by_name) = '');

            UPDATE {table}
               SET updated_by_name = applicant_name
             WHERE BTRIM(COALESCE(applicant_name, '')) <> ''
               AND (updated_by_name IS NULL OR BTRIM(updated_by_name) = '');
        END IF;
    """


async def upgrade(db: BaseDBAsyncClient) -> str:
    body = "".join(_backfill_sql(table) for table in _TABLES)
    body += "".join(_applicant_fallback_sql(table) for table in _APPLICANT_TABLES)
    return f"""
DO $$
BEGIN
{body}
END $$;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: audit name backfill is irreversible"
