"""
轻办公表补齐 BaseModel 审计姓名字段

迁移 532 建表时未包含 created_by_name / updated_by_name，
ORM 继承 infra BaseModel 查询时会 SELECT 这些列。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

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


def _alter_table_sql(table: str) -> str:
    return f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(100);
    """


async def upgrade(db: BaseDBAsyncClient) -> str:
    return "".join(_alter_table_sql(table) for table in _TABLES)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
            ALTER TABLE "{table}"
                DROP COLUMN IF EXISTS created_by_name,
                DROP COLUMN IF EXISTS updated_by_name;
            """
        )
    return "".join(parts)
