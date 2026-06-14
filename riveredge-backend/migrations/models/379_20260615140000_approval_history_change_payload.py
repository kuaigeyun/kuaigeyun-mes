"""approval history change_payload for document_edit during approval"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_approval_histories"
        ADD COLUMN IF NOT EXISTS "change_payload" JSONB;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_approval_histories"
        DROP COLUMN IF EXISTS "change_payload";
    """
