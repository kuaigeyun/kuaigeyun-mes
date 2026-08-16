"""
补齐质量体系 / FAI 建表时漏掉的 BaseModel 审计字段。

566/567 CREATE 未含 created_by / created_by_name / updated_by / updated_by_name，
ORM SELECT 会引用这些列导致列表 500。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "apps_kuaizhizao_qms_system_documents",
    "apps_kuaizhizao_qms_internal_audits",
    "apps_kuaizhizao_qms_management_reviews",
    "apps_kuaizhizao_fai_orders",
    "apps_kuaizhizao_fai_characteristics",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
ALTER TABLE "{table}"
    ADD COLUMN IF NOT EXISTS "created_by" INT,
    ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "updated_by" INT,
    ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
"""
        )
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
ALTER TABLE "{table}"
    DROP COLUMN IF EXISTS "updated_by_name",
    DROP COLUMN IF EXISTS "updated_by",
    DROP COLUMN IF EXISTS "created_by_name",
    DROP COLUMN IF EXISTS "created_by";
"""
        )
    return "\n".join(parts)
