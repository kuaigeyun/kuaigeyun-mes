"""
质量体系三表补齐 attachments JSON 字段（单据附件）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "apps_kuaizhizao_qms_system_documents",
    "apps_kuaizhizao_qms_internal_audits",
    "apps_kuaizhizao_qms_management_reviews",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = [
        f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "attachments" JSONB;'
        for table in _TABLES
    ]
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = [
        f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS "attachments";'
        for table in _TABLES
    ]
    return "\n".join(parts)
