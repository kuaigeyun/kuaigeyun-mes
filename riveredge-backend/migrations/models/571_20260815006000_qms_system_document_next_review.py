"""
质量体系文件增加 next_review_at（下次复审日期）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return (
        'ALTER TABLE "apps_kuaizhizao_qms_system_documents" '
        'ADD COLUMN IF NOT EXISTS "next_review_at" TIMESTAMPTZ;'
    )


async def downgrade(db: BaseDBAsyncClient) -> str:
    return (
        'ALTER TABLE "apps_kuaizhizao_qms_system_documents" '
        'DROP COLUMN IF EXISTS "next_review_at";'
    )
